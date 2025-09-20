require('dotenv').config();
const {
    Client,
    GatewayIntentBits,
    Events,
    Partials,
    ChannelType,
    quote,
    AttachmentBuilder,
    EmbedBuilder
} = require("discord.js");
const { getFirebase, collection, getDocs, query, where, orderBy } = require('./firebase');
const { analyzePlayerTimezones } = require('./helpers/timezone-analyzer');
const { createExcelFile } = require('./create-excel-file');
const { playerInfo } = require('./helpers/excel-header');
const fs = require('fs');
const { birthdayMemes, generateBirthdayMessage } = require('./birthday');
const { formatTime, parseDurationToSeconds } = require('./helpers/timer-format');

const activeCountdowns = new Map();

try {
    const GeminiChat = require("./gemini");
    const GoogleCalendarHelper = require("./helpers/google-calendar");
    const translate = require("google-translate-api-x");
    const fetch = require("node-fetch");
    const { discordToken, channelWithImage, channelData, channelDataTest, geminiApiKey, googleClientEmail, googlePrivateKey, googleCalendarId, discordOwnerId } = require("./env-variables");
    const { ocrImageToText, filterResponse, writePlayerInfoToGoogleSheet } = require('./ocr-image-to-text');
    const { richMessage } = require('./discord-custom-messages');
    const countries = require("./countries");

    const isInDevelopment = process.env.NODE_ENV === "development";

    const intents = [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMembers,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.GuildMessageReactions,
        GatewayIntentBits.MessageContent,
        GatewayIntentBits.DirectMessages,
    ];
    const partials = [Partials.Message, Partials.Channel, Partials.Reaction];

    const client = new Client({ intents, partials }); const geminiChat = new GeminiChat(geminiApiKey);
    geminiChat.init();

    let calendarHelper = null;
    if (googleClientEmail && googlePrivateKey && googleCalendarId) {
        try {
            calendarHelper = new GoogleCalendarHelper(googleClientEmail, googlePrivateKey, googleCalendarId);
            console.log("Google Calendar integration initialized successfully");
        } catch (error) {
            console.error("Error initializing Google Calendar:", error);
        }
    } else {
        console.log("Google Calendar credentials not configured - calendar commands will be disabled");
    }

    client.on(Events.MessageCreate, async (message) => {
        try {
            if (!isInDevelopment && message.author.bot) return;

            if (message.channel.id === channelWithImage) {
                if (message.attachments.size > 0) {
                    const originalChannel = client.channels.cache.get(channelWithImage);

                    message.attachments.forEach(async (attachment) => {
                        if (!attachment.contentType || !attachment.contentType.startsWith('image')) return;

                        try {
                            const resp = await ocrImageToText(attachment.name, attachment.url);
                            const result = await translate(resp, {
                                to: "en",
                                forceBatch: false,
                                autoCorrect: false,
                                requestFunction: fetch,
                            });

                            const translationText = result.text;
                            const responseFilterAndClean = filterResponse(translationText); writePlayerInfoToGoogleSheet(responseFilterAndClean);
                        } catch (e) {
                            const userName = message.author.username;
                            const errorMessage = e instanceof Error ? e.message : "An unknown error occurred during OCR/translation.";

                            if (originalChannel) {
                                originalChannel.send(richMessage(userName, errorMessage)).catch(err => console.log("Error sending message to channel: ", channelWithImage, "\n\n", err));
                            } else {
                                console.log("Original channel not found for sending error message.");
                            }
                        }
                    });
                }
            }

            if (!isInDevelopment && message.channel.type === ChannelType.DM && !message.author.bot) {
                try {
                    const conversationId = `dm_${message.author.id}`;
                    const response = await geminiChat.chat(message.content, conversationId);
                    message.author.send(response).catch(dmError => console.log("Error sending DM response to user:", message.author.id, dmError));
                } catch (chatError) {
                    console.log("Error getting response from Gemini:", chatError);
                    message.author.send("Sorry, I couldn't process your message at the moment.").catch(dmError => console.log("Error sending DM error message to user:", message.author.id, dmError));
                }
                return;
            }

            if (message.channel.id === channelDataTest || message.channel.id === channelData) {
                if (message.content === "!commands") {
                    let commands = "**Data Commands:**\n";
                    commands += "`!players-info [yyyy-mm-dd]` - Latest entry per user (default)\n";
                    commands += "`!players-info-latest [yyyy-mm-dd]` - Latest entry per user (explicit)\n";
                    commands += "`!players-info-all [yyyy-mm-dd]` - All entries (bulk operations)\n";
                    commands += "`!players-info-merits [yyyy-mm-dd]` - Player merits data\n";
                    commands += "`!player_time_zone` - Timezone analysis\n";
                    commands += "`!clan-summary` - Complete clan capabilities summary\n";

                    if (message.author.id === discordOwnerId) {
                        commands += "\n**Admin Commands:** `!conversations_stats`, `!save_conversations`";
                    }

                    await safeSendMessage(message.channel, commands, { fallbackUser: message.author });
                    return;
                }

                if (message.content.startsWith("!players-info-latest")) {
                    // Command to get the latest entry per user
                    const args = message.content.split(" ");
                    args.shift();

                    let dateFilter;
                    const dateRegex = /^\d{4}-\d{2}-\d{2}$/;

                    if (args.length > 0 && dateRegex.test(args[0])) {
                        const dateArg = args[0];
                        const parsedDate = new Date(dateArg + "T00:00:00.000Z");
                        if (!isNaN(parsedDate.getTime())) {
                            dateFilter = parsedDate;
                        } else {
                            await message.channel.send("Invalid date format. Please use YYYY-MM-DD. Fetching all latest data.");
                        }
                    }

                    const db = await getFirebase();
                    let playersQueryRef;

                    if (dateFilter) {
                        playersQueryRef = query(collection(db, "playersInfo"), where("timestamp", ">=", dateFilter.toISOString()), orderBy("timestamp", "desc"));
                    } else {
                        playersQueryRef = query(collection(db, "playersInfo"), orderBy("timestamp", "desc"));
                    }

                    const querySnapshot = await getDocs(playersQueryRef);
                    const allData = querySnapshot.docs.map(doc => doc.data());

                    if (allData.length === 0) {
                        await message.channel.send(dateFilter ? `No player information found from ${args[0]} onwards.` : "No player information found.");
                        return;
                    }

                    // Filter to get only the latest entry per userId
                    const latestPerUser = new Map();
                    allData.forEach(entry => {
                        if (!latestPerUser.has(entry.userId) || 
                            new Date(entry.timestamp) > new Date(latestPerUser.get(entry.userId).timestamp)) {
                            latestPerUser.set(entry.userId, entry);
                        }
                    });

                    const latestData = Array.from(latestPerUser.values());

                    const fileName = `players_info_latest_${dateFilter ? args[0].replace(/-/g, '') + '_' : ''}${Date.now()}.xlsx`;
                    const filePath = await createExcelFile(playerInfo, latestData, fileName, `Players Latest Info${dateFilter ? ' from ' + args[0] : ''} (${latestData.length} unique users)`);

                    if (filePath) {
                        const attachment = new AttachmentBuilder(filePath, { name: fileName });
                        await message.channel.send({
                            content: `Here is the latest players information per user${dateFilter ? ' from ' + args[0] : ''} as Excel file:\n📊 **${latestData.length}** unique users (from ${allData.length} total entries)`,
                            files: [attachment]
                        });
                        fs.unlinkSync(filePath);
                    } else {
                        await message.channel.send('Error generating Excel file. Please try again later.');
                    }
                }

                if (message.content.startsWith("!players-info-all")) {
                    // Command to get ALL entries (no filtering by user)
                    const args = message.content.split(" ");
                    args.shift();

                    let dateFilter;
                    const dateRegex = /^\d{4}-\d{2}-\d{2}$/;

                    if (args.length > 0 && dateRegex.test(args[0])) {
                        const dateArg = args[0];
                        const parsedDate = new Date(dateArg + "T00:00:00.000Z");
                        if (!isNaN(parsedDate.getTime())) {
                            dateFilter = parsedDate;
                        } else {
                            await message.channel.send("Invalid date format. Please use YYYY-MM-DD. Fetching all data.");
                        }
                    }

                    const db = await getFirebase();
                    let playersQueryRef;

                    if (dateFilter) {
                        playersQueryRef = query(collection(db, "playersInfo"), where("timestamp", ">=", dateFilter.toISOString()), orderBy("timestamp", "desc"));
                    } else {
                        playersQueryRef = query(collection(db, "playersInfo"), orderBy("timestamp", "desc"));
                    }

                    const querySnapshot = await getDocs(playersQueryRef);
                    const data = querySnapshot.docs.map(doc => doc.data());

                    if (data.length === 0) {
                        await message.channel.send(dateFilter ? `No player information found from ${args[0]} onwards.` : "No player information found.");
                        return;
                    }

                    // Get unique user count for display
                    const uniqueUsers = new Set(data.map(entry => entry.userId)).size;

                    const fileName = `players_info_all_${dateFilter ? args[0].replace(/-/g, '') + '_' : ''}${Date.now()}.xlsx`;
                    const filePath = await createExcelFile(playerInfo, data, fileName, `All Players Info${dateFilter ? ' from ' + args[0] : ''} (${data.length} entries)`);

                    if (filePath) {
                        const attachment = new AttachmentBuilder(filePath, { name: fileName });
                        await message.channel.send({
                            content: `Here is ALL players information${dateFilter ? ' from ' + args[0] : ''} as Excel file:\n📊 **${data.length}** total entries from **${uniqueUsers}** unique users`,
                            files: [attachment]
                        });
                        fs.unlinkSync(filePath);
                    } else {
                        await message.channel.send('Error generating Excel file. Please try again later.');
                    }
                }

                // Keep the original command for backward compatibility (now defaults to latest per user)
                if (message.content.startsWith("!players-info") && !message.content.startsWith("!players-info-")) {
                    const args = message.content.split(" ");
                    args.shift();

                    let dateFilter;
                    const dateRegex = /^\d{4}-\d{2}-\d{2}$/;

                    if (args.length > 0 && dateRegex.test(args[0])) {
                        const dateArg = args[0];
                        const parsedDate = new Date(dateArg + "T00:00:00.000Z");
                        if (!isNaN(parsedDate.getTime())) {
                            dateFilter = parsedDate;
                        } else {
                            await message.channel.send("Invalid date format. Please use YYYY-MM-DD. Fetching all data.");
                        }
                    }

                    const db = await getFirebase();
                    let playersQueryRef;

                    if (dateFilter) {
                        playersQueryRef = query(collection(db, "playersInfo"), where("timestamp", ">=", dateFilter.toISOString()), orderBy("timestamp", "desc"));
                    } else {
                        playersQueryRef = query(collection(db, "playersInfo"), orderBy("timestamp", "desc"));
                    }

                    const querySnapshot = await getDocs(playersQueryRef);
                    const allData = querySnapshot.docs.map(doc => doc.data());

                    if (allData.length === 0) {
                        await message.channel.send(dateFilter ? `No player information found from ${args[0]} onwards.` : "No player information found.");
                        return;
                    }

                    // Default behavior: show latest per user (same as !players-info-latest)
                    const latestPerUser = new Map();
                    allData.forEach(entry => {
                        if (!latestPerUser.has(entry.userId) || 
                            new Date(entry.timestamp) > new Date(latestPerUser.get(entry.userId).timestamp)) {
                            latestPerUser.set(entry.userId, entry);
                        }
                    });

                    const data = Array.from(latestPerUser.values());

                    const fileName = `players_info_${dateFilter ? args[0].replace(/-/g, '') + '_' : ''}${Date.now()}.xlsx`;
                    const filePath = await createExcelFile(playerInfo, data, fileName, `Players Info${dateFilter ? ' from ' + args[0] : ''}`);

                    if (filePath) {
                        const attachment = new AttachmentBuilder(filePath, { name: fileName });
                        await message.channel.send({
                            content: `Here is the players information${dateFilter ? ' from ' + args[0] : ''} as Excel file:\n💡 *Showing latest entry per user. Use \`!players-info-all\` for all entries.*`,
                            files: [attachment]
                        });
                        fs.unlinkSync(filePath);
                    } else {
                        await message.channel.send('Error generating Excel file. Please try again later.');
                    }
                }

                if (message.content.startsWith("!players-info-merits")) {
                    const args = message.content.split(" ");
                    args.shift();

                    let dateFilterMerits;
                    const dateRegexMerits = /^\d{4}-\d{2}-\d{2}$/;

                    if (args.length > 0 && dateRegexMerits.test(args[0])) {
                        const dateArg = args[0];
                        const parsedDate = new Date(dateArg + "T00:00:00.000Z");
                        if (!isNaN(parsedDate.getTime())) {
                            dateFilterMerits = parsedDate;
                        } else {
                            await message.channel.send("Invalid date format for merits. Please use YYYY-MM-DD. Fetching all data.");
                        }
                    }

                    const db = await getFirebase();
                    const playersCollectionRef = collection(db, "playersInfo");

                    let meritsQueryRef;
                    if (dateFilterMerits) {
                        meritsQueryRef = query(collection(db, "playersMerits"), where("timestamp", ">=", dateFilterMerits.toISOString()), orderBy("timestamp", "desc"));
                    } else {
                        meritsQueryRef = query(collection(db, "playersMerits"), orderBy("timestamp", "desc"));
                    }

                    const querySnapshotPlayers = await getDocs(playersCollectionRef);
                    const querySnapshotMerits = await getDocs(meritsQueryRef);

                    const playersData = querySnapshotPlayers.docs.map(doc => doc.data());
                    const meritsData = querySnapshotMerits.docs.map(doc => doc.data());

                    if (meritsData.length === 0) {
                        await message.channel.send(dateFilterMerits ? `No player merits information found from ${args[0]} onwards.` : "No player merits information found.");
                        return;
                    }

                    const dataMeritsFiltered = meritsData.map((item) => {
                        const player = playersData.find((p) => p.userId === item.userId);
                        const power = player && player.power ? Number(player.power) : 0;
                        const merits = item.merits ? Number(item.merits) : 0;
                        let percentage = "N/A";
                        if (power > 0 && merits > 0) {
                            percentage = `${Math.round((merits / power) * 10000) / 100}%`;
                        }

                        return ({
                            userId: item.userId,
                            userName: player ? player.userName : "Unknown",
                            power: player ? player.power : "Unknown",
                            merits: item.merits,
                            percentageMeritsDividePower: percentage,
                            timestamp: item.timestamp,
                        })
                    });

                    const headerFormatted = {
                        userId: undefined,
                        userName: '',
                        power: undefined,
                        merits: undefined,
                        percentageMeritsDividePower: '',
                        timestamp: ''
                    };

                    const fileName = `players_merits_${dateFilterMerits ? args[0].replace(/-/g, '') + '_' : ''}${Date.now()}.xlsx`;
                    const filePath = await createExcelFile(headerFormatted, dataMeritsFiltered, fileName, `Players Merits Info${dateFilterMerits ? ' from ' + args[0] : ''}`);

                    if (filePath) {
                        const attachment = new AttachmentBuilder(filePath, { name: fileName });
                        await message.channel.send({
                            content: `Here is the players Merits information${dateFilterMerits ? ' from ' + args[0] : ''} as Excel file:`,
                            files: [attachment]
                        });
                        fs.unlinkSync(filePath);
                    } else {
                        await message.channel.send('Error generating Excel file for merits. Please try again later.');
                    }
                }

                if (message.content === "!player_time_zone") {
                    try {
                        await message.channel.sendTyping();

                        const db = await getFirebase();
                        const playersQueryRef = query(collection(db, "playersInfo"), orderBy("timestamp", "desc"));
                        const querySnapshot = await getDocs(playersQueryRef);
                        const allPlayersData = querySnapshot.docs.map(doc => doc.data());

                        if (allPlayersData.length === 0) {
                            await message.channel.send("No player data found in the database.");
                            return;
                        }

                        // Filter to get only the latest entry per userId
                        const latestPerUser = new Map();
                        allPlayersData.forEach(entry => {
                            if (!latestPerUser.has(entry.userId) || 
                                new Date(entry.timestamp) > new Date(latestPerUser.get(entry.userId).timestamp)) {
                                latestPerUser.set(entry.userId, entry);
                            }
                        });

                        const playersData = Array.from(latestPerUser.values());
                        const analysis = analyzePlayerTimezones(playersData);

                        let responseMessage = `🌍 **ICE Clan Timezone Analysis** 🌍\n\n`;
                        responseMessage += `📊 **Data Overview:**\n`;
                        responseMessage += `• Unique players analyzed: ${analysis.totalPlayers} (from ${allPlayersData.length} total entries)\n`;
                        responseMessage += `• Players with timezone data: ${analysis.playersWithTimezone}\n\n`;

                        if (analysis.playersWithTimezone === 0) {
                            responseMessage += `❌ No timezone information available for analysis.\n`;
                            responseMessage += `Please make sure players update their timezone information in the database.`;
                        } else {
                            responseMessage += `🏆 **Top Timezones:**\n`;
                            analysis.topTimezones.forEach((tz, index) => {
                                const percentage = Math.round((tz[1] / analysis.playersWithTimezone) * 100);
                                responseMessage += `${index + 1}. ${tz[0]}: ${tz[1]} players (${percentage}%)\n`;
                            });

                            if (analysis.optimalTimes.length > 0) {
                                responseMessage += `\n⏰ **Best Coordination Times:**\n`;
                                analysis.optimalTimes.forEach((time, index) => {
                                    responseMessage += `${index + 1}. **${time.utcTime}** - ${time.activePlayersCount} players likely active\n`;
                                    if (time.localTimes.length > 0 && time.localTimes.length <= 5) {
                                        responseMessage += `   Local times: ${time.localTimes.slice(0, 3).join(', ')}\n`;
                                    }
                                });
                            }

                            responseMessage += `\n💡 **Recommendations:**\n`;
                            analysis.recommendations.forEach(rec => {
                                responseMessage += `• ${rec}\n`;
                            });
                        }

                        if (responseMessage.length > 2000) {
                            const chunks = responseMessage.match(/.{1,1900}/g) || [responseMessage];
                            for (const chunk of chunks) {
                                await message.channel.send(chunk);
                            }
                        } else {
                            await message.channel.send(responseMessage);
                        }

                    } catch (error) {
                        console.error("Error in !player_time_zone command:", error);
                        await message.channel.send("Sorry, an error occurred while analyzing timezone data. Please try again.");
                    }
                }

                if (message.content === "!clan-summary") {
                    try {
                        await message.channel.sendTyping();

                        const db = await getFirebase();
                        const playersQueryRef = query(collection(db, "playersInfo"), orderBy("timestamp", "desc"));
                        const querySnapshot = await getDocs(playersQueryRef);
                        const allPlayersData = querySnapshot.docs.map(doc => doc.data());

                        if (allPlayersData.length === 0) {
                            await message.channel.send("No player data found in the database.");
                            return;
                        }

                        // Filter to get only the latest entry per userId, ignoring 0/null values
                        const latestPerUser = new Map();
                        allPlayersData.forEach(entry => {
                            if (!latestPerUser.has(entry.userId) || 
                                new Date(entry.timestamp) > new Date(latestPerUser.get(entry.userId).timestamp)) {
                                latestPerUser.set(entry.userId, entry);
                            }
                        });

                        const playersData = Array.from(latestPerUser.values());

                        // Helper function to safely parse numbers and ignore 0/null
                        const safeParseNumber = (value) => {
                            const num = parseInt(value) || 0;
                            return num > 0 ? num : 0;
                        };

                        // Calculate T5 soldiers summary
                        const t5Summary = {
                            infantry: 0,
                            mages: 0,
                            archers: 0,
                            cavalry: 0,
                            flying: 0
                        };

                        // Calculate all troop types
                        const troopSummary = {
                            t1: { infantry: 0, mages: 0, archers: 0, cavalry: 0, flying: 0 },
                            t2: { infantry: 0, mages: 0, archers: 0, cavalry: 0, flying: 0 },
                            t3: { infantry: 0, mages: 0, archers: 0, cavalry: 0, flying: 0 },
                            t4: { infantry: 0, mages: 0, archers: 0, cavalry: 0, flying: 0 },
                            t5: { infantry: 0, mages: 0, archers: 0, cavalry: 0, flying: 0 }
                        };

                        // Other statistics
                        let totalPower = 0;
                        let totalMana = 0;
                        let activePlayers = 0;
                        const factions = {};
                        const timeZones = {};
                        const playersWithT5 = [];

                        playersData.forEach(player => {
                            const power = safeParseNumber(player.power);
                            if (power > 0) {
                                totalPower += power;
                                activePlayers++;
                            }

                            const mana = safeParseNumber(player.mana);
                            if (mana > 0) totalMana += mana;

                            // Count factions
                            if (player.faction && player.faction !== '') {
                                factions[player.faction] = (factions[player.faction] || 0) + 1;
                            }

                            // Count timezones
                            if (player.timeZone && player.timeZone !== '') {
                                timeZones[player.timeZone] = (timeZones[player.timeZone] || 0) + 1;
                            }

                            // Calculate troop counts for each tier
                            ['t1', 't2', 't3', 't4', 't5'].forEach(tier => {
                                ['Infantry', 'Mages', 'Archers', 'Cavalry', 'Flying'].forEach(type => {
                                    const fieldName = `${tier}${type}Count`;
                                    const count = safeParseNumber(player[fieldName]);
                                    if (count > 0) {
                                        const troopType = type.toLowerCase();
                                        troopSummary[tier][troopType] += count;
                                        
                                        // Track T5 specifically
                                        if (tier === 't5') {
                                            t5Summary[troopType] += count;
                                            if (!playersWithT5.find(p => p.userId === player.userId)) {
                                                playersWithT5.push({
                                                    userName: player.userName || 'Unknown',
                                                    userId: player.userId,
                                                    totalT5: count
                                                });
                                            } else {
                                                const existingPlayer = playersWithT5.find(p => p.userId === player.userId);
                                                existingPlayer.totalT5 += count;
                                            }
                                        }
                                    }
                                });
                            });
                        });

                        // Calculate total T5
                        const totalT5 = Object.values(t5Summary).reduce((sum, count) => sum + count, 0);

                        // Sort timezones and factions by count
                        const topTimezones = Object.entries(timeZones)
                            .sort(([,a], [,b]) => b - a)
                            .slice(0, 5);
                        const topFactions = Object.entries(factions)
                            .sort(([,a], [,b]) => b - a)
                            .slice(0, 3);

                        // Sort players with T5 by total T5 count
                        playersWithT5.sort((a, b) => b.totalT5 - a.totalT5);

                        // Create main summary embed
                        const mainEmbed = new EmbedBuilder()
                            .setTitle("🏰 ICE CLAN - Complete Summary")
                            .setDescription(`**Comprehensive clan capabilities analysis**\n*Based on latest data per player*`)
                            .addFields(
                                {
                                    name: "👥 Clan Overview",
                                    value: `• **Active Players:** ${activePlayers}/${playersData.length}\n• **Total Power:** ${totalPower.toLocaleString()}\n• **Average Power:** ${Math.round(totalPower/activePlayers || 0).toLocaleString()}\n• **Total Mana:** ${totalMana.toLocaleString()}`,
                                    inline: false
                                },
                                {
                                    name: "⚔️ T5 Forces Overview",
                                    value: `• **Total T5 Soldiers:** ${totalT5.toLocaleString()}\n• **Players with T5:** ${playersWithT5.length}\n• **Infantry:** ${t5Summary.infantry.toLocaleString()}\n• **Mages:** ${t5Summary.mages.toLocaleString()}\n• **Archers:** ${t5Summary.archers.toLocaleString()}\n• **Cavalry:** ${t5Summary.cavalry.toLocaleString()}\n• **Flying:** ${t5Summary.flying.toLocaleString()}`,
                                    inline: false
                                }
                            )
                            .setColor(0x00FF00)
                            .setTimestamp();

                        if (topFactions.length > 0) {
                            const factionsText = topFactions.map(([faction, count]) => 
                                `• **${faction}:** ${count} players`).join('\n');
                            mainEmbed.addFields({
                                name: "🏛️ Top Factions",
                                value: factionsText,
                                inline: true
                            });
                        }

                        if (topTimezones.length > 0) {
                            const timezonesText = topTimezones.map(([tz, count]) => 
                                `• **${tz}:** ${count} players`).join('\n');
                            mainEmbed.addFields({
                                name: "🌍 Top Timezones",
                                value: timezonesText,
                                inline: true
                            });
                        }

                        // Send main summary with permission handling
                        try {
                            await message.channel.send({ embeds: [mainEmbed] });
                        } catch (embedError) {
                            if (embedError.code === 50013) {
                                // Fallback to plain text if no embed permissions
                                let fallbackText = "🏰 **ICE CLAN - Complete Summary**\n\n";
                                fallbackText += `👥 **Clan Overview:**\n`;
                                fallbackText += `• Active Players: ${activePlayers}/${playersData.length}\n`;
                                fallbackText += `• Total Power: ${totalPower.toLocaleString()}\n`;
                                fallbackText += `• Average Power: ${Math.round(totalPower/activePlayers || 0).toLocaleString()}\n`;
                                fallbackText += `• Total Mana: ${totalMana.toLocaleString()}\n\n`;
                                
                                fallbackText += `⚔️ **T5 Forces Overview:**\n`;
                                fallbackText += `• Total T5 Soldiers: ${totalT5.toLocaleString()}\n`;
                                fallbackText += `• Players with T5: ${playersWithT5.length}\n`;
                                fallbackText += `• Infantry: ${t5Summary.infantry.toLocaleString()}\n`;
                                fallbackText += `• Mages: ${t5Summary.mages.toLocaleString()}\n`;
                                fallbackText += `• Archers: ${t5Summary.archers.toLocaleString()}\n`;
                                fallbackText += `• Cavalry: ${t5Summary.cavalry.toLocaleString()}\n`;
                                fallbackText += `• Flying: ${t5Summary.flying.toLocaleString()}\n\n`;

                                if (topFactions.length > 0) {
                                    fallbackText += `🏛️ **Top Factions:**\n`;
                                    topFactions.forEach(([faction, count]) => {
                                        fallbackText += `• ${faction}: ${count} players\n`;
                                    });
                                    fallbackText += `\n`;
                                }

                                if (topTimezones.length > 0) {
                                    fallbackText += `🌍 **Top Timezones:**\n`;
                                    topTimezones.forEach(([tz, count]) => {
                                        fallbackText += `• ${tz}: ${count} players\n`;
                                    });
                                }

                                await message.channel.send(fallbackText);
                            } else {
                                throw embedError; // Re-throw if not a permission error
                            }
                        }

                        // Create detailed troop breakdown
                        if (totalT5 > 0) {
                            let troopDetails = "```\n🏆 TOP T5 PLAYERS:\n";
                            playersWithT5.slice(0, 10).forEach((player, index) => {
                                troopDetails += `${index + 1}. ${player.userName}: ${player.totalT5.toLocaleString()} T5\n`;
                            });
                            troopDetails += "\n📊 COMPLETE TROOP BREAKDOWN:\n";
                            
                            ['t5', 't4', 't3', 't2', 't1'].forEach(tier => {
                                const tierData = troopSummary[tier];
                                const tierTotal = Object.values(tierData).reduce((sum, count) => sum + count, 0);
                                if (tierTotal > 0) {
                                    troopDetails += `\n${tier.toUpperCase()} TROOPS (${tierTotal.toLocaleString()} total):\n`;
                                    Object.entries(tierData).forEach(([type, count]) => {
                                        if (count > 0) {
                                            troopDetails += `  ${type}: ${count.toLocaleString()}\n`;
                                        }
                                    });
                                }
                            });
                            troopDetails += "```";

                            // Split message if too long
                            if (troopDetails.length > 1950) {
                                const chunks = troopDetails.match(/[\s\S]{1,1900}/g) || [troopDetails];
                                for (const chunk of chunks) {
                                    try {
                                        await message.channel.send(chunk);
                                    } catch (sendError) {
                                        console.error("Error sending troop details chunk:", sendError);
                                        // Continue with next chunk
                                    }
                                }
                            } else {
                                try {
                                    await message.channel.send(troopDetails);
                                } catch (sendError) {
                                    console.error("Error sending troop details:", sendError);
                                }
                            }
                        }

                        // Strategic recommendations
                        const recommendations = [];
                        if (totalT5 < 1000000) {
                            recommendations.push("🔥 Focus on T5 troop training for stronger offensive capabilities");
                        }
                        if (playersWithT5.length < activePlayers * 0.5) {
                            recommendations.push("📈 Encourage more players to build T5 troops");
                        }
                        if (topTimezones.length > 3) {
                            recommendations.push("🌍 Consider timezone coordination for better rally participation");
                        }
                        if (totalPower / activePlayers < 100000000) {
                            recommendations.push("💪 Focus on power growth activities");
                        }

                        if (recommendations.length > 0) {
                            const recEmbed = new EmbedBuilder()
                                .setTitle("💡 Strategic Recommendations")
                                .setDescription(recommendations.join('\n\n'))
                                .setColor(0xFFA500);
                                
                            // Send recommendations with permission handling
                            try {
                                await message.channel.send({ embeds: [recEmbed] });
                            } catch (embedError) {
                                if (embedError.code === 50013) {
                                    // Fallback to plain text for recommendations
                                    let recText = "💡 **Strategic Recommendations:**\n\n";
                                    recommendations.forEach(rec => {
                                        recText += `• ${rec}\n`;
                                    });
                                    await message.channel.send(recText);
                                } else {
                                    throw embedError; // Re-throw if not a permission error
                                }
                            }
                        }

                    } catch (error) {
                        console.error("Error in !clan-summary command:", error);
                        await message.channel.send("Sorry, an error occurred while generating the clan summary. Please try again.");
                    }
                }

                if (message.content === "!conversations_stats" && message.author.id === discordOwnerId) {
                    try {
                        const stats = {
                            totalConversations: geminiChat.conversations.size,
                            memoryUsage: Math.round(JSON.stringify(Object.fromEntries(geminiChat.conversations)).length / 1024),
                            lastSaveTime: new Date(geminiChat.lastSaveTime).toLocaleString(),
                            autoSaveInterval: geminiChat.saveInterval / 1000
                        };

                        const statsMessage = `💾 **Conversation Storage Stats:**\n` +
                            `📊 **Active Conversations:** ${stats.totalConversations}\n` +
                            `🗂️ **Memory Usage:** ~${stats.memoryUsage} KB\n` +
                            `💾 **Last Saved:** ${stats.lastSaveTime}\n` +
                            `⏱️ **Auto-save Interval:** ${stats.autoSaveInterval} seconds\n` +
                            `📂 **Storage File:** conversations.json`;

                        await safeSendMessage(message.channel, statsMessage, { fallbackUser: message.author });
                    } catch (error) {
                        console.error("Error in !conversations_stats command:", error);
                        await safeSendMessage(message.channel, "Error retrieving conversation statistics.", { fallbackUser: message.author });
                    }
                }

                if (message.content === "!save_conversations" && message.author.id === discordOwnerId) {
                    try {
                        geminiChat.saveConversations();
                        await safeSendMessage(message.channel, "✅ **Conversations saved successfully!**", { fallbackUser: message.author });
                    } catch (error) {
                        console.error("Error in !save_conversations command:", error);
                        await safeSendMessage(message.channel, "❌ Error saving conversations.", { fallbackUser: message.author });
                    }
                }
            }

            if (message.content === "!commands") {
                let commandsText = "Commands available: `!happy_birthday @username`, `!bastions_countdown live_points damage_per_second`, `!countdown time message`, `!stop_countdown`, `!ICE message`, `!analyze_images optional_message`, `!resume`";

                if (calendarHelper) {
                    commandsText += ", `!help_game_event`, `!help_calendar_event`";
                }

                await safeSendMessage(message.channel, commandsText, { fallbackUser: message.author });
                return;
            }

            if (message.content.startsWith("!help_game_event")) {
                const helpMessage = `📅 **Game Events Command:**
                    \`!game_event type date time duration\`

                    **Types available:**
                    🏰 \`war\` - Clan war events
                    ⚔️ \`rally\` - Rally events  
                    👑 \`kvk\` - Kingdom vs Kingdom events
                    🎯 \`training\` - Training sessions
                    💬 \`meeting\` - Clan meetings

                    **Examples:**
                    !game_event war 15/06/2025 20:00 2h
                    !game_event rally 16/06/2025 19:30 1h30m
                    !game_event kvk 20/06/2025 21:00 3h
                    !game_event training 18/06/2025 18:00 1h
                    !game_event meeting 17/06/2025 20:00 45m`;

                await message.channel.send(helpMessage);
                return;
            }

            if (message.content.startsWith("!help_calendar_event")) {
                const helpMessage = `📝 **Custom Calendar Event:**
                     \`!calendar_event "title" date time duration "description>"\`

                     **Example:**
                     \`!calendar_event "Strategy Meeting" 15/06/2025 19:00 1h "Weekly clan strategy discussion"\`

                     💡 **Tips:**
                     • Use DD/MM/YYYY format for dates
                     • Duration: 1h, 30m, 1h30m, etc.
                     • Events are automatically added to the ICE Alliance calendar`;

                await message.channel.send(helpMessage);
                return;
            }

            if (message.content.startsWith("!game_event")) {
                if (!calendarHelper) {
                    await safeSendMessage(message.channel, "❌ Google Calendar is not configured. Please contact an administrator.", { fallbackUser: message.author });
                    return;
                }

                const args = message.content.split(" ");
                args.shift();

                if (args.length < 4) {
                    await message.channel.send("Usage: `!game_event type date time duration`\nTypes: war, rally, kvk, training, meeting\nExample: `!game_event war 15/06/2025 20:00 2h`");
                    return;
                }

                const [eventType, dateStr, timeStr, durationStr] = args;
                const validTypes = ['war', 'rally', 'kvk', 'training', 'meeting'];

                if (!validTypes.includes(eventType.toLowerCase())) {
                    await message.channel.send(`❌ Invalid event type. Valid types: ${validTypes.join(', ')}`);
                    return;
                }

                try {
                    await message.channel.sendTyping();

                    const result = await calendarHelper.createGameEvent(
                        eventType.toLowerCase(),
                        dateStr,
                        timeStr,
                        durationStr
                    );

                    if (result.success) {
                        if (result.eventDetails) {
                            await message.channel.send(`✅ **${eventType.toUpperCase()} event created successfully!**\n🗓️ **Date:** ${result.eventDetails.date}\n⏰ **Time:** ${result.eventDetails.time}\n⏱️ **Duration:** ${result.eventDetails.duration}\n`);
                        } else {
                            await message.channel.send(`❌ **Error creating event:** ${result.error}`);
                        }
                    } else {
                        await message.channel.send(`❌ **Error creating event:** ${result.error}`);
                    }
                } catch (error) {
                    console.error("Error in !game_event command:", error);
                    await message.channel.send("❌ An error occurred while creating the calendar event. Please try again.");
                }
            }

            if (message.content.startsWith("!calendar_event")) {
                if (!calendarHelper) {
                    await message.channel.send("❌ Google Calendar is not configured. Please contact an administrator.");
                    return;
                }

                const args = message.content.split(" ");
                args.shift();

                if (args.length < 5) {
                    await message.channel.send("Usage: `!calendar_event \"title\" date time duration \"description\"`\nExample: `!calendar_event \"Clan Meeting\" 15/06/2025 19:00 1h \"Weekly strategy discussion\"`");
                    return;
                }

                const command = message.content;
                const regex = /"([^"]+)"|(\S+)/g;
                const parsedArgs = [];
                let match;

                let firstSpace = command.indexOf(' ');
                if (firstSpace === -1) {
                    await message.channel.send("❌ Missing required parameters. Usage: `!calendar_event \"title\" date time duration \"description\"`");
                    return;
                }

                const argsString = command.substring(firstSpace + 1);
                while ((match = regex.exec(argsString)) !== null) {
                    parsedArgs.push(match[1] || match[2]);
                }

                if (parsedArgs.length < 5) {
                    await message.channel.send(`❌ Missing required parameters. Found ${parsedArgs.length}/5 parameters.\nUsage: \`!calendar_event "title" date time duration "description"\`\nExample: \`!calendar_event "Clan Meeting" 15/06/2025 19:00 1h "Weekly strategy discussion"\``);
                    return;
                }

                const [title, dateStr, timeStr, durationStr, ...descriptionParts] = parsedArgs;
                const description = descriptionParts.join(' ');

                try {
                    await message.channel.sendTyping();
                    const result = await calendarHelper.createGameEvent(
                        'custom',
                        dateStr,
                        timeStr,
                        durationStr,
                        `${title}\n\n${description}`
                    );

                    if (result.success) {
                        if (result.eventDetails) {
                            const successMessage = `✅ **Event "${title}" created successfully!**\n` +
                                `🗓️ **Date:** ${result.eventDetails.date}\n` +
                                `⏰ **Time:** ${result.eventDetails.time}\n` +
                                `⏱️ **Duration:** ${result.eventDetails.duration}\n` +
                                `📝 **Description:** ${description}\n`;
                            await message.channel.send(successMessage);
                        } else {
                            await message.channel.send(`❌ **Error creating event:** ${result.error}`);
                        }
                    } else {
                        await message.channel.send(`❌ **Error creating event:** ${result.error}`);
                    }
                } catch (error) {

                    await message.channel.send("❌ An error occurred while creating the calendar event. Please try again.");
                }
            }

            if (message.content.startsWith("!happy_birthday")) {
                const args = message.content.split(" ");
                args.shift();

                if (args.length === 0) {
                    await message.channel.send("Please specify a player name! Usage: `!happy_birthday @username` or `!happy_birthday Player Name`");
                    return;
                }

                const mentionedUser = message.mentions.users.first();
                let playerName;
                let playerMention;

                if (mentionedUser) {
                    playerName = mentionedUser.username;
                    playerMention = `<@${mentionedUser.id}>`;
                } else {
                    playerName = args.join(" ");
                    playerMention = playerName;
                }

                const randomMeme = birthdayMemes[Math.floor(Math.random() * birthdayMemes.length)];
                const birthdayMessageText = generateBirthdayMessage(playerName);

                try {
                    await message.channel.send({
                        content: birthdayMessageText.replace(playerName, playerMention),
                        files: [randomMeme]
                    });

                    await message.react('🎂');
                    await message.react('🎉');
                } catch (error) {
                    console.error("Error sending birthday message:", error);
                    await message.channel.send("Sorry, I couldn't send the birthday message. Please try again later.");
                }
            }

            if (message.content.startsWith("!bastions_countdown")) {
                if (activeCountdowns.has(message.channel.id)) {
                    await message.channel.send("A countdown is already running in this channel. Use `!stop_countdown` to stop it first.");
                    return;
                }

                const args = message.content.split(" ");
                args.shift();

                if (args.length < 2) {
                    await message.channel.send("Usage: `!bastions_countdown live_points damage_per_second`\nExample: `!bastions_countdown 5000 25` (5000 live, losing 25 per second)");
                    return;
                }

                const live = Number(args[0]);
                const damagePerSecond = Number(args[1]);

                if (isNaN(live) || live <= 0) {
                    await message.channel.send("Please specify a valid number of live points (greater than 0)!");
                    return;
                }

                if (isNaN(damagePerSecond) || damagePerSecond <= 0) {
                    await message.channel.send("Please specify a valid damage per second (greater than 0)!");
                    return;
                } let countdownMessage = await message.channel.send(`Starting bastion countdown from **${live}** live points, losing **${damagePerSecond}** per second...`);

                activeCountdowns.set(message.channel.id, {
                    type: 'bastion',
                    message: countdownMessage,
                    timerId: null,
                    currentLive: live,
                    damagePerSecond: damagePerSecond
                });

                const timer = () => {
                    const countdownData = activeCountdowns.get(message.channel.id);

                    if (!countdownData || countdownData.type !== 'bastion') {
                        if (countdownData && countdownData.timerId) clearTimeout(countdownData.timerId);
                        if (countdownData) activeCountdowns.delete(message.channel.id);
                        return;
                    }

                    let currentLivePoints = countdownData.currentLive;
                    const timeoutId = setTimeout(async () => {
                        const updatedCountdownData = activeCountdowns.get(message.channel.id);
                        if (!updatedCountdownData || updatedCountdownData.type !== 'bastion') {
                            if (updatedCountdownData && updatedCountdownData.timerId) clearTimeout(updatedCountdownData.timerId);
                            if (updatedCountdownData) activeCountdowns.delete(message.channel.id);
                            return;
                        }

                        currentLivePoints = Math.max(0, currentLivePoints - updatedCountdownData.damagePerSecond);
                        updatedCountdownData.currentLive = currentLivePoints;

                        const secondsRemaining = currentLivePoints > 0 ? Math.ceil(currentLivePoints / updatedCountdownData.damagePerSecond) : 0;
                        const hours = Math.floor(secondsRemaining / 3600);
                        const minutes = Math.floor((secondsRemaining % 3600) / 60);
                        const seconds = secondsRemaining % 60;
                        const timeRemainingString = `${hours}h ${minutes}m ${seconds}s`;

                        let messageToSend;
                        if (currentLivePoints > 0) {
                            messageToSend = `**${currentLivePoints}** live points left (losing **${updatedCountdownData.damagePerSecond}**/sec)\n\n**Estimated time remaining:** ${timeRemainingString}`;
                        } else {
                            messageToSend = `**Bastion destroyed!** Countdown finished.`;
                        }

                        try {
                            let msgToEdit = updatedCountdownData.message;
                            if (msgToEdit && !msgToEdit.deleted) {
                                updatedCountdownData.message = await msgToEdit.edit(messageToSend);
                            } else {
                                console.log("Bastion countdown message was deleted or not found.");
                                activeCountdowns.delete(message.channel.id);
                                return;
                            }
                        } catch (error) {
                            console.error("Error editing bastion countdown message:", error);
                            activeCountdowns.delete(message.channel.id);
                            return;
                        }

                        if (currentLivePoints > 0) {
                            timer();
                        } else {
                            activeCountdowns.delete(message.channel.id);
                        }
                    }, 1000);

                    if (countdownData) {
                        countdownData.timerId = timeoutId;
                    }
                };
                timer();
            }

            if (message.content.startsWith("!countdown")) {
                if (activeCountdowns.has(message.channel.id)) {
                    await message.channel.send("A countdown is already running in this channel. Use `!stop_countdown` to stop it first.");
                    return;
                }

                const args = message.content.split(" ");
                args.shift();
                if (args.length < 2) {
                    await message.channel.send("Usage: `!countdown <time> <message>` (e.g., `!countdown 1m30s My event starts soon!`) \nTime format examples: `10s`, `5m`, `1h`, `1h30m`, `30m10s`");
                    return;
                }

                const timeArg = args[0];
                const countdownText = args.slice(1).join(" ");

                const durationSeconds = parseDurationToSeconds(timeArg);

                if (durationSeconds === null || durationSeconds <= 0) {
                    await message.channel.send("Invalid time format or duration. Use format like `1h30m10s`, `10m`, `30s`. Time must be greater than 0.");
                    return;
                }

                const endTime = Date.now() + durationSeconds * 1000;
                let countdownMessage;

                try {
                    countdownMessage = await message.channel.send(`Timer set for **${formatTime(durationSeconds)}** for: "${countdownText}"`);
                } catch (sendError) {
                    console.error("Error sending initial countdown message:", sendError);
                    return;
                }

                const countdownData = {
                    type: 'generic',
                    message: countdownMessage,
                    endTime: endTime,
                    originalText: countdownText,
                    channelId: message.channel.id,
                    timerId: null
                };
                activeCountdowns.set(message.channel.id, countdownData);

                const intervalId = setInterval(async () => {
                    const currentCountdown = activeCountdowns.get(message.channel.id);

                    if (!currentCountdown || currentCountdown.type !== 'generic' || currentCountdown.timerId !== intervalId) {
                        clearInterval(intervalId);

                        if (currentCountdown && currentCountdown.timerId === intervalId) {
                            activeCountdowns.delete(message.channel.id);
                        }
                        return;
                    }

                    const remainingMs = currentCountdown.endTime - Date.now();
                    if (remainingMs <= 0) {
                        clearInterval(intervalId);
                        activeCountdowns.delete(message.channel.id);
                        try {
                            if (currentCountdown.message && !currentCountdown.message.deleted) {
                                await currentCountdown.message.edit(`**Finished!** "${currentCountdown.originalText}"`);
                            } else {
                                await message.channel.send(`**Finished!** "${currentCountdown.originalText}" (Original timer message was deleted)`);
                            }
                        } catch (editError) {
                            console.error("Error editing countdown finished message:", editError);

                            try {
                                await message.channel.send(`**Finished!** "${currentCountdown.originalText}" (Timer message update failed)`);
                            } catch (finalSendError) {
                                console.error("Error sending final countdown finished message:", finalSendError);
                            }
                        }
                    } else {
                        const remainingSeconds = Math.max(0, Math.ceil(remainingMs / 1000));
                        try {
                            if (currentCountdown.message && !currentCountdown.message.deleted) {
                                await currentCountdown.message.edit(`Time remaining: **${formatTime(remainingSeconds)}** for: "${currentCountdown.originalText}"`);
                            } else {
                                console.log("Generic countdown message was deleted. Stopping countdown for:", currentCountdown.originalText);
                                clearInterval(intervalId);
                                activeCountdowns.delete(message.channel.id);

                                await message.channel.send(`Timer for "${currentCountdown.originalText}" stopped as its message was deleted.`);
                            }
                        } catch (editError) {
                            console.error("Error editing generic countdown message:", editError);
                            clearInterval(intervalId);
                            activeCountdowns.delete(message.channel.id);

                            await message.channel.send(`Timer for "${currentCountdown.originalText}" stopped due to an error during update.`);
                        }
                    }
                }, 5000);

                currentCountdownData = activeCountdowns.get(message.channel.id);
                if (currentCountdownData && currentCountdownData.endTime === endTime) {
                    currentCountdownData.timerId = intervalId;
                } else {
                    clearInterval(intervalId);
                }
            }

            if (message.content === "!stop_countdown") {
                const countdownData = activeCountdowns.get(message.channel.id);

                if (countdownData && countdownData.timerId) {
                    let countdownTypeMessage = "Countdown";
                    if (countdownData.type === 'bastion') {
                        clearTimeout(countdownData.timerId);
                        countdownTypeMessage = "Bastion countdown";
                    } else if (countdownData.type === 'generic') {
                        clearInterval(countdownData.timerId);
                        countdownTypeMessage = `Timer for "${countdownData.originalText}"`;
                    } else {
                        clearTimeout(countdownData.timerId);
                        clearInterval(countdownData.timerId);
                        countdownTypeMessage = "Unknown countdown";
                    }

                    activeCountdowns.delete(message.channel.id);

                    let finalStopMessage = `${countdownTypeMessage} stopped manually by ${message.author.tag}.`;
                    let messageUpdatedOrSent = false;

                    if (countdownData.message && !countdownData.message.deleted) {
                        try {
                            await countdownData.message.edit(finalStopMessage);
                            messageUpdatedOrSent = true;
                        } catch (editError) {
                            console.error(`Could not edit original message for ${countdownTypeMessage} stop:`, editError);
                            finalStopMessage += " (Original message update failed)";
                        }
                    } else if (countdownData.type === 'generic' || countdownData.type === 'bastion') {
                        finalStopMessage += " (Original message was deleted or not found)";
                    }

                    if (!messageUpdatedOrSent) {
                        try {
                            await message.channel.send(finalStopMessage);
                        } catch (sendError) {
                            console.error(`Could not send new confirmation for ${countdownTypeMessage} stop:`, sendError);
                            try {
                                await message.channel.send(`${countdownTypeMessage} stopped.`);
                            } catch (absFallbackErr) {
                                console.error("Absolute fallback send error for stop_countdown:", absFallbackErr);
                            }
                        }
                    }
                } else {
                    await message.channel.send("No active countdown found in this channel to stop.");
                }
            }

            if (message.content.startsWith("!ICE")) {
                const args = message.content.split(" ");
                args.shift();

                if (args.length === 0) {
                    await message.channel.send("Please write a message! Usage: `!ICE your message here`");
                    return;
                }

                const userMessage = args.join(" ");
                const conversationId = `channel_${message.channel.id}`;

                try {
                    await message.channel.sendTyping();

                    const recentMessages = await message.channel.messages.fetch({ limit: 5 });
                    const imageAttachments = [];

                    for (const [_, msg] of recentMessages) {
                        if (msg.attachments.size > 0) {
                            for (const attachment of msg.attachments.values()) {
                                if (attachment.contentType && attachment.contentType.startsWith('image/')) {
                                    imageAttachments.push({
                                        url: attachment.url,
                                        name: attachment.name,
                                        author: msg.author.username,
                                        timestamp: msg.createdAt
                                    });
                                }
                            }
                        }
                    }

                    let response;
                    if (imageAttachments.length > 0) {
                        response = await geminiChat.chatWithImages(userMessage, imageAttachments, conversationId);

                        const imageInfo = imageAttachments.length === 1
                            ? `📸 *Analyzing 1 image from the recent messages*\n\n`
                            : `📸 *Analyzing ${imageAttachments.length} images from the recent messages*\n\n`;
                        response = imageInfo + response;
                    } else {
                        response = await geminiChat.chat(userMessage, conversationId);
                    }

                    if (response.length > 2000) {
                        const chunks = response.match(/.{1,1900}/g) || [response]; for (const chunk of chunks) {
                            await message.channel.send(chunk);
                        }
                    } else {
                        await message.channel.send(response);
                    }
                } catch (error) {
                    console.error("Error in !ICE command:", error);
                    await message.channel.send("Sorry, an error occurred while processing your message. Please try again.");
                }
            }

            if (message.content === "!resume") {
                try {
                    await message.channel.sendTyping();

                    const eightHoursAgo = new Date(Date.now() - 8 * 60 * 60 * 1000);
                    const messages = await message.channel.messages.fetch({ limit: 100 });

                    const recentMessages = messages
                        .filter(msg =>
                            msg.createdAt > eightHoursAgo &&
                            !msg.author.bot &&
                            !msg.content.startsWith('!') &&
                            msg.content.length > 0 &&
                            msg.content.length < 500
                        )
                        .map(msg => ({
                            author: msg.author.username,
                            content: msg.content,
                            timestamp: msg.createdAt
                        }))
                        .reverse()
                        .slice(0, 30);

                    if (recentMessages.length === 0) {
                        await message.channel.send("There are not enough messages from the last 8 hours to create a summary.");
                        return;
                    }

                    const summary = await geminiChat.summarizeMessages(recentMessages);

                    if (summary.length > 2000) {
                        const chunks = summary.match(/.{1,1900}/g) || [summary];
                        for (let i = 0; i < chunks.length; i++) {
                            const prefix = i === 0 ? "**📋 Summary of the last 8 hours:**\n\n" : "";
                            await message.channel.send(prefix + chunks[i]);
                        }
                    } else {
                        await message.channel.send(`**📋 Summary of the last 8 hours:**\n\n${summary}`);
                    }
                } catch (error) {
                    console.error("Error in !resume command:", error);
                    await message.channel.send("Sorry, an error occurred while creating the summary. Please try again.");
                }
            }

            if (message.content.startsWith("!analyze_images")) {
                const args = message.content.split(" ");
                args.shift();

                const userMessage = args.length > 0 ? args.join(" ") : "Please analyze these images for Call of Dragons strategy insights.";
                const conversationId = `channel_${message.channel.id}`;

                try {
                    await message.channel.sendTyping();

                    const recentMessages = await message.channel.messages.fetch({ limit: 10 });
                    const imageAttachments = [];

                    for (const [_, msg] of recentMessages) {
                        if (msg.attachments.size > 0) {
                            for (const attachment of msg.attachments.values()) {
                                if (attachment.contentType && attachment.contentType.startsWith('image/')) {
                                    imageAttachments.push({
                                        url: attachment.url,
                                        name: attachment.name,
                                        author: msg.author.username,
                                        timestamp: msg.createdAt
                                    });
                                }
                            }
                        }
                    }

                    if (imageAttachments.length === 0) {
                        await message.channel.send("❌ No images found in the last 10 messages. Please upload an image and try again.");
                        return;
                    }

                    const response = await geminiChat.chatWithImages(userMessage, imageAttachments, conversationId);

                    const imageInfo = imageAttachments.length === 1
                        ? `🔍 **Analyzing 1 image**\n\n`
                        : `🔍 **Analyzing ${imageAttachments.length} images**\n\n`;
                    const finalResponse = imageInfo + response;

                    if (finalResponse.length > 2000) {
                        const chunks = finalResponse.match(/.{1,1900}/g) || [finalResponse];
                        for (const chunk of chunks) {
                            await message.channel.send(chunk);
                        }
                    } else {
                        await message.channel.send(finalResponse);
                    }
                } catch (error) {
                    console.error("Error in !analyze_images command:", error);
                    await message.channel.send("Sorry, an error occurred while analyzing the images. Please try again.");
                }
            }

        } catch (globalError) {
            console.error('Global error in message handler:', globalError);

            try {
                if (message && message.author && !message.author.bot) {
                    await safeSendMessage(message.channel, "❌ Sorry, I encountered an error processing your command. Please try again later.", { fallbackUser: message.author });
                }
            } catch (notificationError) {
                console.error('Failed to send error notification:', notificationError);
            }
        }
    });

    client.on(Events.MessageReactionAdd, async (reaction, user) => {
        if (user.bot) return;

        if (reaction.partial) {
            try {
                await reaction.fetch();
            } catch (error) {
                console.log("Something went wrong when fetching the reaction message: ", error);
                return;
            }
        }

        if (reaction.message.partial) {
            try {
                await reaction.message.fetch();
            } catch (error) {
                console.log("Something went wrong when fetching the partial message: ", error);
                return;
            }
        }

        if (user.partial) {
            try {
                await user.fetch();
            } catch (error) {
                console.log("Something went wrong when fetching the partial user: ", error);
                return;
            }
        }

        if (typeof reaction.emoji.name !== "string") return;

        const reactionName = reaction.emoji.name;
        const countryInformation = countries[reactionName];

        if (!countryInformation) return;

        const messageToTranslate = reaction.message.content;

        if (!messageToTranslate) return;

        try {
            const res = await translate(messageToTranslate, {
                to: countryInformation.langs[0],
                forceBatch: false,
                autoCorrect: true,
                requestFunction: fetch,
            });
            user.send(`${quote(messageToTranslate)}\n\n${res.text}\n\n`).catch(dmError =>
                console.log("Error sending translated message to user DM: ", user.id, dmError)
            );
        } catch (translateError) {
            user.send(
                `${quote(messageToTranslate)}\n\nError: It is not possible to translate to the language for ${countryInformation.name}.\n\n`
            ).catch(dmError => console.log("Error sending translation error to user DM: ", user.id, dmError));
        }
    });


    const canBotSendMessages = (channel) => {
        try {
            if (!channel || !channel.guild) return true;

            const botMember = channel.guild.members.me;
            if (!botMember) return false;

            const permissions = channel.permissionsFor(botMember);
            return permissions && permissions.has(['SendMessages', 'ViewChannel']);
        } catch (error) {
            console.error('Error checking permissions:', error);
            return false;
        }
    }

    const safeSendMessage = async (channel, content, options = {}) => {
        try {
            if (!canBotSendMessages(channel)) {
                console.log(`Bot lacks permissions to send messages in channel: ${channel.id}`);
                if (options.fallbackUser) {
                    try {
                        const fallbackContent = typeof content === 'string' ? content :
                            (content.content || 'Response message');
                        await options.fallbackUser.send(`⚠️ I couldn't send a message in that channel due to permissions. Here's what I wanted to say:\n\n${fallbackContent}`);
                    } catch (dmError) {
                        console.error('Failed to send DM fallback:', dmError.message);
                    }
                }
                return null;
            }

            if (typeof content === 'string') {
                return await channel.send(content);
            } else {
                return await channel.send(content);
            }
        } catch (error) {
            console.error(`Error sending message to channel ${channel.id}:`, error.message);

            if (options.fallbackUser) {
                try {
                    const fallbackContent = typeof content === 'string' ? content :
                        (content.content || 'Response message');
                    await options.fallbackUser.send(`⚠️ I couldn't send a message in that channel due to permissions. Here's what I wanted to say:\n\n${fallbackContent}`);
                } catch (dmError) {
                    console.error('Failed to send DM fallback:', dmError.message);
                }
            }
            return null;
        }
    }

    const gracefulShutdown = () => {
        console.log('Bot is shutting down, saving conversations...');
        if (geminiChat && geminiChat.saveConversations) {
            geminiChat.saveConversations();
        }
        process.exit(0);
    };

    process.on('SIGINT', gracefulShutdown);
    process.on('SIGTERM', gracefulShutdown);
    process.on('SIGUSR2', gracefulShutdown);

    process.on('uncaughtException', (error) => {
        console.error('Uncaught Exception:', error);
    });

    process.on('unhandledRejection', (reason, promise) => {
        console.error('Unhandled Rejection at:', promise, 'reason:', reason);
    });

    client.login(discordToken);
    console.log("Bot is logged in and ready.");

} catch (e) {
    console.log("The bot crashed: ", e);
}
