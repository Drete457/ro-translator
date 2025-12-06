require('dotenv').config();
const {
    Client,
    GatewayIntentBits,
    Events,
    Partials,
    ChannelType,
    quote,
    AttachmentBuilder,
    EmbedBuilder,
    ActionRowBuilder,
    ButtonBuilder,
    ButtonStyle,
    MessageFlags,
    GuildScheduledEventPrivacyLevel,
    GuildScheduledEventEntityType
} = require("discord.js");
const { getFirebase, collection, getDocs, query, where, orderBy } = require('./firebase');
const { analyzePlayerTimezones } = require('./helpers/timezone-analyzer');
const { createExcelFile } = require('./create-excel-file');
const { playerInfo } = require('./helpers/excel-header');
const fs = require('fs');
const os = require('os');
const { birthdayMemes, generateBirthdayMessage } = require('./birthday');
const { formatTime, parseDurationToSeconds } = require('./helpers/timer-format');

const activeCountdowns = new Map();

try {
    const GeminiChat = require("./gemini");
    const GoogleCalendarHelper = require("./helpers/google-calendar");
    const translate = require("google-translate-api-x");
    const fetch = require("node-fetch");
    const { discordToken, channelWithImage, channelData, channelDataTest, channelStatus, channelAllianceChat, geminiApiKey, googleClientEmail, googlePrivateKey, googleCalendarId, discordOwnerId } = require("./env-variables");
    const { ocrImageToText, filterResponse, writePlayerInfoToGoogleSheet } = require('./ocr-image-to-text');
    const { richMessage } = require('./discord-custom-messages');
    const countries = require("./countries");
    const { AllianceEntertainment } = require('./helpers/alliance-entertainment');

    const isInDevelopment = process.env.NODE_ENV === "development";

    const intents = [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMembers,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.GuildMessageReactions,
        GatewayIntentBits.MessageContent,
        GatewayIntentBits.DirectMessages,
        GatewayIntentBits.GuildScheduledEvents,
    ];
    const partials = [Partials.Message, Partials.Channel, Partials.Reaction, Partials.GuildScheduledEvent];

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

    // Alliance Entertainment instance (will be initialized after client is ready)
    let allianceEntertainment = null;

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
                    commands += "`!players-final-list <id1> <id2> <id3>...` - Complete player info + merits for specific IDs\n";
                    commands += "`!player_time_zone` - Timezone analysis\n";
                    commands += "`!clan-summary` - Complete clan capabilities summary\n";

                    if (message.author.id === discordOwnerId) {
                        commands += "\n**Admin Commands:** `!conversations_stats`, `!save_conversations`, `!goodbye`, `!sync_calendar`, `!list_calendar`, `!send_meme`";
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

                if (message.content.startsWith("!players-final-list")) {
                    const args = message.content.split(" ");
                    args.shift();

                    if (args.length === 0) {
                        await message.channel.send("Please provide player IDs! Usage: `!players-final-list 312312, 12333, 211222` or `!players-final-list 312312 12333 211222`");
                        return;
                    }

                    // Parse player IDs from args (can be separated by commas, spaces, or both)
                    const playerIds = args.join(" ")
                        .split(/[\s,]+/)
                        .map(id => id.trim())
                        .filter(id => id.length > 0);

                    if (playerIds.length === 0) {
                        await message.channel.send("No valid player IDs found. Please provide at least one player ID.");
                        return;
                    }

                    const db = await getFirebase();
                    
                    // Fetch all players info
                    const playersQueryRef = query(collection(db, "playersInfo"), orderBy("timestamp", "desc"));
                    const querySnapshotPlayers = await getDocs(playersQueryRef);
                    const allPlayersData = querySnapshotPlayers.docs.map(doc => doc.data());

                    // Fetch all merits info
                    const meritsQueryRef = query(collection(db, "playersMerits"), orderBy("timestamp", "desc"));
                    const querySnapshotMerits = await getDocs(meritsQueryRef);
                    const allMeritsData = querySnapshotMerits.docs.map(doc => doc.data());

                    // Filter to get only the latest entry per userId for players info
                    const latestPlayersPerUser = new Map();
                    allPlayersData.forEach(entry => {
                        if (!latestPlayersPerUser.has(entry.userId) || 
                            new Date(entry.timestamp) > new Date(latestPlayersPerUser.get(entry.userId).timestamp)) {
                            latestPlayersPerUser.set(entry.userId, entry);
                        }
                    });

                    // Filter to get only the latest entry per userId for merits
                    const latestMeritsPerUser = new Map();
                    allMeritsData.forEach(entry => {
                        if (!latestMeritsPerUser.has(entry.userId) || 
                            new Date(entry.timestamp) > new Date(latestMeritsPerUser.get(entry.userId).timestamp)) {
                            latestMeritsPerUser.set(entry.userId, entry);
                        }
                    });

                    // Filter data for requested player IDs
                    const finalListData = [];
                    const notFoundIds = [];

                    playerIds.forEach(userId => {

                        let playerData = latestPlayersPerUser.get(userId);
                        if (!playerData && !isNaN(userId)) {
                            playerData = latestPlayersPerUser.get(Number(userId));
                        }
                        if (!playerData) {
                            playerData = latestPlayersPerUser.get(String(userId));
                        }

                        let meritsData = latestMeritsPerUser.get(userId);
                        if (!meritsData && !isNaN(userId)) {
                            meritsData = latestMeritsPerUser.get(Number(userId));
                        }
                        if (!meritsData) {
                            meritsData = latestMeritsPerUser.get(String(userId));
                        }

                        if (playerData) {
                            const power = playerData.power ? Number(playerData.power) : 0;
                            const merits = meritsData && meritsData.merits ? Number(meritsData.merits) : 0;
                            let percentage = "N/A";
                            if (power > 0 && merits > 0) {
                                percentage = `${Math.round((merits / power) * 10000) / 100}%`;
                            }

                            finalListData.push({
                                ...playerData,
                                merits: merits || "N/A",
                                percentageMeritsDividePower: percentage,
                                meritsTimestamp: meritsData ? meritsData.timestamp : "N/A"
                            });
                        } else {
                            notFoundIds.push(userId);
                        }
                    });

                    if (finalListData.length === 0) {
                        await message.channel.send(`No player information found for the provided IDs: ${playerIds.join(", ")}`);
                        return;
                    }

                    // Create combined header with all player info fields plus merits
                    const combinedHeader = {
                        ...playerInfo,
                        merits: undefined,
                        percentageMeritsDividePower: '',
                        meritsTimestamp: ''
                    };

                    const fileName = `players_final_list_${Date.now()}.xlsx`;
                    const filePath = await createExcelFile(combinedHeader, finalListData, fileName, `Final Players List (${finalListData.length} players)`);

                    if (filePath) {
                        const attachment = new AttachmentBuilder(filePath, { name: fileName });
                        let responseMessage = `Here is the final players list with all information including merits:\n📊 **${finalListData.length}** players found`;
                        
                        if (notFoundIds.length > 0) {
                            responseMessage += `\n⚠️ **${notFoundIds.length}** IDs not found: ${notFoundIds.join(", ")}`;
                        }

                        await message.channel.send({
                            content: responseMessage,
                            files: [attachment]
                        });
                        fs.unlinkSync(filePath);
                    } else {
                        await message.channel.send('Error generating Excel file. Please try again later.');
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
                            const current = latestPerUser.get(entry.userId);
                            const tsNew = entry && entry.timestamp ? new Date(entry.timestamp) : null;
                            const tsCur = current && current.timestamp ? new Date(current.timestamp) : null;
                            const isNewer = tsNew && (!tsCur || tsNew > tsCur);
                            if (!current || isNewer) {
                                latestPerUser.set(entry.userId, entry);
                            }
                        });

                        const playersData = Array.from(latestPerUser.values());

                        // Only consider players with >= 45M power for the coordination timer
                        const safeParseNumber = (value) => {
                            if (value === null || value === undefined) return 0;
                            if (typeof value === 'number') {
                                return Number.isFinite(value) && value > 0 ? Math.floor(value) : 0;
                            }
                            if (typeof value === 'string') {
                                const sanitized = value.replace(/[^0-9]/g, '');
                                if (!sanitized) return 0;
                                const num = parseInt(sanitized, 10);
                                return Number.isFinite(num) && num > 0 ? num : 0;
                            }
                            const num = parseInt(value, 10);
                            return Number.isFinite(num) && num > 0 ? num : 0;
                        };

                        const highPowerPlayers = playersData.filter(p => safeParseNumber(p.power) >= 45_000_000);

                        // Overall analysis (all players)
                        const analysisAll = analyzePlayerTimezones(playersData);
                        // Timer analysis (>=45M power)
                        const analysisHigh = analyzePlayerTimezones(highPowerPlayers);

                        let responseMessage = `🌍 **FTS Clan Timezone Analysis** 🌍\n\n`;
                        responseMessage += `📊 **Data Overview:**\n`;
                        responseMessage += `• Unique players analyzed: ${analysisAll.totalPlayers} (from ${allPlayersData.length} total entries)\n`;
                        responseMessage += `• Players with timezone data: ${analysisAll.playersWithTimezone}\n`;
                        responseMessage += `• Players ≥45M power: ${highPowerPlayers.length} (with timezone: ${analysisHigh.playersWithTimezone})\n\n`;

                        if (analysisAll.playersWithTimezone === 0) {
                            responseMessage += `❌ No timezone information available for analysis.\n`;
                            responseMessage += `Please make sure players update their timezone information in the database.`;
                        } else {
                            responseMessage += `🏆 **Top Timezones:**\n`;
                            analysisAll.topTimezones.forEach((tz, index) => {
                                const percentage = Math.round((tz[1] / analysisAll.playersWithTimezone) * 100);
                                responseMessage += `${index + 1}. ${tz[0]}: ${tz[1]} players (${percentage}%)\n`;
                            });

                            // Use only >=45M power players for coordination timer
                            if (analysisHigh.optimalTimes.length > 0) {
                                responseMessage += `\n⏰ **Best Coordination Times (≥45M power):**\n`;
                                analysisHigh.optimalTimes.forEach((time, index) => {
                                    responseMessage += `${index + 1}. **${time.utcTime}** - ${time.activePlayersCount} players likely active\n`;
                                    if (time.localTimes.length > 0 && time.localTimes.length <= 5) {
                                        responseMessage += `   Local times: ${time.localTimes.slice(0, 3).join(', ')}\n`;
                                    }
                                });
                            } else if (analysisAll.optimalTimes.length > 0) {
                                // Fallback: if no >=45M players have timezone data, show overall
                                responseMessage += `\n⏰ **Best Coordination Times (all players - no ≥45M data):**\n`;
                                analysisAll.optimalTimes.forEach((time, index) => {
                                    responseMessage += `${index + 1}. **${time.utcTime}** - ${time.activePlayersCount} players likely active\n`;
                                    if (time.localTimes.length > 0 && time.localTimes.length <= 5) {
                                        responseMessage += `   Local times: ${time.localTimes.slice(0, 3).join(', ')}\n`;
                                    }
                                });
                            }

                            responseMessage += `\n💡 **Recommendations:**\n`;
                            analysisAll.recommendations.forEach(rec => {
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

                        // Helper: safely parse numbers from various formats ("122 000 000", "122,000,000", "122.000.000")
                        const safeParseNumber = (value) => {
                            if (value === null || value === undefined) return 0;
                            if (typeof value === 'number') {
                                return Number.isFinite(value) && value > 0 ? Math.floor(value) : 0;
                            }
                            if (typeof value === 'string') {
                                // Remove all non-digit characters (keep minus and dot only if needed). Power/troops are integers, so strip separators.
                                const sanitized = value.replace(/[^0-9]/g, '');
                                if (!sanitized) return 0;
                                const num = parseInt(sanitized, 10);
                                return Number.isFinite(num) && num > 0 ? num : 0;
                            }
                            const num = parseInt(value, 10);
                            return Number.isFinite(num) && num > 0 ? num : 0;
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
                        let activePlayers = 0; // players with reported power > 0
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
                                                    totalT5: count,
                                                    power: safeParseNumber(player.power) || 0
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

                        // Compute averages
                        const totalPlayers = playersData.length;
                        const avgPowerReported = activePlayers > 0 ? Math.round(totalPower / activePlayers) : 0;
                        const avgPowerAll = totalPlayers > 0 ? Math.round(totalPower / totalPlayers) : 0;

                        // Create main summary embed
                        const mainEmbed = new EmbedBuilder()
                            .setTitle("🏰 FTS CLAN - Complete Summary")
                            .setDescription(`**Comprehensive clan capabilities analysis**\n*Based on latest data per player*`)
                            .addFields(
                                {
                                    name: "👥 Clan Overview",
                                    value: `• **Active Players (reported power):** ${activePlayers}/${totalPlayers}\n• **Total Power:** ${totalPower.toLocaleString()}\n• **Avg Power (reported):** ${avgPowerReported.toLocaleString()}\n• **Avg Power (all players):** ${avgPowerAll.toLocaleString()}\n• **Total Mana:** ${totalMana.toLocaleString()}`,
                                    inline: false
                                },
                                {
                                    name: "⚔️ T5 Forces Overview",
                                    value: `• **Total T5 Soldiers:** ${Number(totalT5).toLocaleString()}\n• **Players with T5:** ${playersWithT5.length}\n• **Infantry:** ${Number(t5Summary.infantry).toLocaleString()}\n• **Mages:** ${Number(t5Summary.mages).toLocaleString()}\n• **Archers:** ${Number(t5Summary.archers).toLocaleString()}\n• **Cavalry:** ${Number(t5Summary.cavalry).toLocaleString()}\n• **Flying:** ${Number(t5Summary.flying).toLocaleString()}`,
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
                                let fallbackText = "🏰 **FTS CLAN - Complete Summary**\n\n";
                                fallbackText += `👥 **Clan Overview:**\n`;
                                fallbackText += `• Active Players (reported power): ${activePlayers}/${totalPlayers}\n`;
                                fallbackText += `• Total Power: ${totalPower.toLocaleString()}\n`;
                                fallbackText += `• Avg Power (reported): ${avgPowerReported.toLocaleString()}\n`;
                                fallbackText += `• Avg Power (all players): ${avgPowerAll.toLocaleString()}\n`;
                                fallbackText += `• Total Mana: ${totalMana.toLocaleString()}\n\n`;
                                
                                fallbackText += `⚔️ **T5 Forces Overview:**\n`;
                                fallbackText += `• Total T5 Soldiers: ${Number(totalT5).toLocaleString()}\n`;
                                fallbackText += `• Players with T5: ${playersWithT5.length}\n`;
                                fallbackText += `• Infantry: ${Number(t5Summary.infantry).toLocaleString()}\n`;
                                fallbackText += `• Mages: ${Number(t5Summary.mages).toLocaleString()}\n`;
                                fallbackText += `• Archers: ${Number(t5Summary.archers).toLocaleString()}\n`;
                                fallbackText += `• Cavalry: ${Number(t5Summary.cavalry).toLocaleString()}\n`;
                                fallbackText += `• Flying: ${Number(t5Summary.flying).toLocaleString()}\n\n`;

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

                // Manual calendar sync command (admin only)
                if (message.content === "!sync_calendar" && message.author.id === discordOwnerId) {
                    if (!calendarHelper) {
                        await message.channel.send("❌ Google Calendar is not configured.");
                        return;
                    }

                    try {
                        await message.channel.send("🔄 Starting manual calendar sync...");

                        const guild = message.guild;
                        if (!guild) {
                            await message.channel.send("❌ This command must be used in a server.");
                            return;
                        }

                        // Check permissions
                        const botMember = guild.members.me;
                        if (!botMember || !botMember.permissions.has('ManageEvents')) {
                            await message.channel.send("❌ Bot doesn't have 'Manage Events' permission.");
                            return;
                        }

                        // Get calendar events
                        const calendarResult = await calendarHelper.getUpcomingEvents(15);
                        if (!calendarResult.success) {
                            await message.channel.send(`❌ Failed to fetch calendar events: ${calendarResult.error}`);
                            return;
                        }

                        // Get Discord events
                        const discordEvents = await guild.scheduledEvents.fetch();

                        await message.channel.send(`📊 **Sync Status:**\n• Calendar events (next 15 days): ${calendarResult.events.length}\n• Discord scheduled events: ${discordEvents.size}\n\nSyncing...`);

                        // Run the sync
                        await syncCalendarToDiscord(guild);

                        await message.channel.send("✅ Calendar sync completed! Check console for details.");
                    } catch (error) {
                        console.error("Error in !sync_calendar command:", error);
                        await message.channel.send(`❌ Error during sync: ${error.message}`);
                    }
                }

                // List calendar events command (admin only)
                if (message.content === "!list_calendar" && message.author.id === discordOwnerId) {
                    if (!calendarHelper) {
                        await message.channel.send("❌ Google Calendar is not configured.");
                        return;
                    }

                    try {
                        const calendarResult = await calendarHelper.getUpcomingEvents(15);
                        if (!calendarResult.success) {
                            await message.channel.send(`❌ Failed to fetch calendar events: ${calendarResult.error}`);
                            return;
                        }

                        if (calendarResult.events.length === 0) {
                            await message.channel.send("📅 No upcoming events in the next 15 days.");
                            return;
                        }

                        let eventList = "📅 **Upcoming Calendar Events (next 15 days):**\n\n";
                        for (const event of calendarResult.events.slice(0, 15)) {
                            const startTime = new Date(event.start.dateTime || event.start.date);
                            const formattedDate = startTime.toLocaleDateString('pt-PT', {
                                day: '2-digit',
                                month: '2-digit',
                                year: 'numeric',
                                hour: '2-digit',
                                minute: '2-digit'
                            });
                            eventList += `• **${event.summary}**\n  📆 ${formattedDate}\n  🆔 ${event.id}\n\n`;
                        }

                        if (eventList.length > 2000) {
                            const chunks = eventList.match(/.{1,1900}/g) || [eventList];
                            for (const chunk of chunks) {
                                await message.channel.send(chunk);
                            }
                        } else {
                            await message.channel.send(eventList);
                        }
                    } catch (error) {
                        console.error("Error in !list_calendar command:", error);
                        await message.channel.send(`❌ Error: ${error.message}`);
                    }
                }

                // Manual trigger for alliance entertainment (admin only)
                if (message.content === "!send_meme" && message.author.id === discordOwnerId) {
                    if (!allianceEntertainment) {
                        await message.channel.send("❌ Alliance entertainment is not configured.");
                        return;
                    }

                    try {
                        await message.channel.send("🎮 Sending random content to alliance chat...");
                        await allianceEntertainment.triggerNow();
                        await message.channel.send("✅ Content sent! Check the alliance chat channel.");
                    } catch (error) {
                        console.error("Error in !send_meme command:", error);
                        await message.channel.send(`❌ Error: ${error.message}`);
                    }
                }
            }

            if (message.content === "!commands") {
                let commandsText = "Commands available: `!happy_birthday @username`, `!bastions_countdown live_points damage_per_second`, `!countdown time message`, `!stop_countdown`, `!FTS message`, `!analyze_images optional_message`, `!resume`";

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
                     • Events are automatically added to the FTS Alliance calendar`;

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

            if (message.content.startsWith("!FTS")) {
                const args = message.content.split(" ");
                args.shift();

                if (args.length === 0) {
                    await message.channel.send("Please write a message! Usage: `!FTS your message here`");
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
                    console.error("Error in !FTS command:", error);
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

            if (message.content === "!goodbye" && message.author.id === discordOwnerId) {
                try {
                    const guild = message.guild;

                    if (!guild) {
                        await message.channel.send("❌ This command can only be used in a server.");
                        return;
                    }

                    const goodbyeMessage = `👋 **Goodbye everyone!**\n\nI'm leaving this server now. It's been a pleasure serving you!\n\n*Farewell from ${client.user.username}* 💙`;

                    await message.channel.send(goodbyeMessage);

                    console.log(`Bot is leaving server: ${guild.name} (ID: ${guild.id})`);

                    // Wait 2 seconds to ensure the message is sent before leaving
                    setTimeout(async () => {
                        try {
                            await guild.leave();
                            console.log(`Successfully left server: ${guild.name}`);
                        } catch (leaveError) {
                            console.error("Error leaving server:", leaveError);
                        }
                    }, 2000);

                } catch (error) {
                    console.error("Error in !goodbye command:", error);
                    await message.channel.send("❌ An error occurred while trying to leave the server.");
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

    // Store pending translations for button interactions
    const pendingTranslations = new Map();

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

            // Translate UI texts to target language
            const uiTexts = {
                viewTranslation: "📖 View Translation",
                translationReady: "Translation is ready! Click the button below to view it (only you will see it).",
                original: "Original",
                translation: "Translation"
            };

            try {
                const uiTranslations = await translate(
                    [uiTexts.viewTranslation, uiTexts.translationReady, uiTexts.original, uiTexts.translation],
                    {
                        to: countryInformation.langs[0],
                        forceBatch: false,
                        autoCorrect: false,
                        requestFunction: fetch,
                    }
                );
                
                if (Array.isArray(uiTranslations)) {
                    uiTexts.viewTranslation = uiTranslations[0]?.text || uiTexts.viewTranslation;
                    uiTexts.translationReady = uiTranslations[1]?.text || uiTexts.translationReady;
                    uiTexts.original = uiTranslations[2]?.text || uiTexts.original;
                    uiTexts.translation = uiTranslations[3]?.text || uiTexts.translation;
                }
            } catch (uiTranslateError) {
                // If UI translation fails, use English defaults
                console.log("UI translation failed, using English defaults");
            }

            // Create a unique ID for this translation
            const translationId = `translate_${Date.now()}_${user.id}`;

            // Store the translation data
            pendingTranslations.set(translationId, {
                originalMessage: messageToTranslate,
                translatedText: res.text,
                countryName: countryInformation.name,
                langCode: countryInformation.langs[0],
                uiTexts: uiTexts,
                requesterId: user.id,
                timestamp: Date.now()
            });

            // Create button for viewing translation
            const row = new ActionRowBuilder()
                .addComponents(
                    new ButtonBuilder()
                        .setCustomId(translationId)
                        .setLabel(uiTexts.viewTranslation)
                        .setStyle(ButtonStyle.Primary)
                );

            // Send message with button
            const buttonMessage = await reaction.message.channel.send({
                content: `<@${user.id}> 🌐 ${uiTexts.translationReady}`,
                components: [row],
                allowedMentions: { users: [user.id] }
            });

            // Auto-delete button message after 60 seconds and clean up stored translation
            setTimeout(async () => {
                try {
                    pendingTranslations.delete(translationId);
                    await buttonMessage.delete();
                } catch (deleteError) {
                    // Message might already be deleted, ignore error
                }
            }, 60000);

        } catch (translateError) {
            const errorMessage = await reaction.message.channel.send({
                content: `<@${user.id}> ❌ Error: It is not possible to translate to ${countryInformation.name}.`,
                allowedMentions: { users: [user.id] }
            });

            // Auto-delete error message after 10 seconds
            setTimeout(async () => {
                try {
                    await errorMessage.delete();
                } catch (deleteError) {
                    // Message might already be deleted, ignore error
                }
            }, 10000);
        }
    });

    // Handle button interactions for translations
    client.on(Events.InteractionCreate, async (interaction) => {
        if (!interaction.isButton()) return;

        // Check if this is a translation button
        if (!interaction.customId.startsWith('translate_')) return;

        const translationData = pendingTranslations.get(interaction.customId);

        if (!translationData) {
            await interaction.reply({
                content: '❌ This translation has expired. Please react again to get a new translation.',
                flags: MessageFlags.Ephemeral
            });
            return;
        }

        // Send ephemeral reply with translation (only the user who clicked sees it)
        const uiTexts = translationData.uiTexts || { original: "Original", translation: "Translation" };
        await interaction.reply({
            content: `🌐 **${uiTexts.translation}:**\n\n**${uiTexts.original}:**\n${quote(translationData.originalMessage)}\n\n**${uiTexts.translation}:**\n${translationData.translatedText}`,
            flags: MessageFlags.Ephemeral
        });
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

    // ==================== BOT MONITORING SYSTEM ====================
    const botStartTime = Date.now();
    let statusMessageCount = 0;

    // Helper function to format bytes to human readable
    const formatBytes = (bytes) => {
        if (bytes === 0) return '0 B';
        const k = 1024;
        const sizes = ['B', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
    };

    // Helper function to format uptime
    const formatUptime = (ms) => {
        const seconds = Math.floor(ms / 1000);
        const minutes = Math.floor(seconds / 60);
        const hours = Math.floor(minutes / 60);
        const days = Math.floor(hours / 24);
        
        if (days > 0) return `${days}d ${hours % 24}h ${minutes % 60}m`;
        if (hours > 0) return `${hours}h ${minutes % 60}m ${seconds % 60}s`;
        if (minutes > 0) return `${minutes}m ${seconds % 60}s`;
        return `${seconds}s`;
    };

    // Function to get system stats
    const getSystemStats = () => {
        const memUsage = process.memoryUsage();
        const totalMem = os.totalmem();
        const freeMem = os.freemem();
        const usedMem = totalMem - freeMem;
        const cpus = os.cpus();
        
        // Calculate CPU usage (average across all cores)
        let totalIdle = 0;
        let totalTick = 0;
        cpus.forEach(cpu => {
            for (const type in cpu.times) {
                totalTick += cpu.times[type];
            }
            totalIdle += cpu.times.idle;
        });
        const cpuUsage = ((1 - totalIdle / totalTick) * 100).toFixed(1);

        return {
            // Process memory
            heapUsed: memUsage.heapUsed,
            heapTotal: memUsage.heapTotal,
            rss: memUsage.rss,
            external: memUsage.external,
            // System memory
            totalMem,
            freeMem,
            usedMem,
            memoryPercent: ((usedMem / totalMem) * 100).toFixed(1),
            // CPU
            cpuUsage,
            cpuCores: cpus.length,
            cpuModel: cpus[0]?.model || 'Unknown',
            // System
            platform: os.platform(),
            nodeVersion: process.version,
            uptime: Date.now() - botStartTime
        };
    };

    // Function to send error to monitoring channel
    const sendErrorToMonitoring = async (errorType, error) => {
        try {
            const monitoringChannel = client.channels.cache.get(channelStatus);
            if (!monitoringChannel) return;

            const errorEmbed = new EmbedBuilder()
                .setTitle(`🚨 ${errorType}`)
                .setDescription(`\`\`\`\n${error.stack || error.message || error}\n\`\`\``)
                .setColor(0xFF0000)
                .setTimestamp()
                .addFields(
                    { name: '⏰ Occurred At', value: new Date().toISOString(), inline: true },
                    { name: '⏱️ Uptime', value: formatUptime(Date.now() - botStartTime), inline: true }
                );

            await monitoringChannel.send({ embeds: [errorEmbed] });
        } catch (sendError) {
            console.error('Failed to send error to monitoring channel:', sendError);
        }
    };

    // Function to send status update
    const sendStatusUpdate = async () => {
        try {
            const monitoringChannel = client.channels.cache.get(channelStatus);
            if (!monitoringChannel) {
                console.log('Monitoring channel not found:', channelStatus);
                return;
            }

            const stats = getSystemStats();
            statusMessageCount++;

            const statusEmbed = new EmbedBuilder()
                .setTitle('🤖 Bot Status Report')
                .setColor(0x00FF00)
                .setTimestamp()
                .addFields(
                    { name: '📊 Status', value: '✅ Online', inline: true },
                    { name: '⏱️ Uptime', value: formatUptime(stats.uptime), inline: true },
                    { name: '📝 Report #', value: `${statusMessageCount}`, inline: true },
                    { name: '💾 Process Memory', value: `Heap: ${formatBytes(stats.heapUsed)} / ${formatBytes(stats.heapTotal)}\nRSS: ${formatBytes(stats.rss)}\nExternal: ${formatBytes(stats.external)}`, inline: false },
                    { name: '🖥️ System Memory', value: `Used: ${formatBytes(stats.usedMem)} / ${formatBytes(stats.totalMem)} (${stats.memoryPercent}%)\nFree: ${formatBytes(stats.freeMem)}`, inline: false },
                    { name: '⚡ CPU', value: `Usage: ${stats.cpuUsage}%\nCores: ${stats.cpuCores}\nModel: ${stats.cpuModel}`, inline: false },
                    { name: '🔧 System Info', value: `Platform: ${stats.platform}\nNode.js: ${stats.nodeVersion}`, inline: false },
                    { name: '📈 Bot Stats', value: `Servers: ${client.guilds.cache.size}\nActive Countdowns: ${activeCountdowns.size}\nPending Translations: ${pendingTranslations.size}\nConversations: ${geminiChat.conversations?.size || 0}`, inline: false }
                )
                .setFooter({ text: 'Next update in 60 minute' });

            await monitoringChannel.send({ embeds: [statusEmbed] });
        } catch (error) {
            console.error('Error sending status update:', error);
        }
    };

    // ==================== CALENDAR TO DISCORD EVENTS SYNC ====================
    
    // Map to track synced events: Google Calendar ID -> Discord Event ID
    const syncedEventsMap = new Map();
    
    /**
     * Generate a unique identifier for matching events
     * Uses title + start time to create a consistent identifier
     */
    const generateEventIdentifier = (title, startTime) => {
        const normalizedTitle = title.toLowerCase().trim();
        const timeStamp = new Date(startTime).getTime();
        return `${normalizedTitle}_${timeStamp}`;
    };

    /**
     * Extract Google Calendar Event ID from Discord event description
     */
    const extractCalendarIdFromDescription = (description) => {
        if (!description) return null;
        const match = description.match(/\[CalendarID:([^\]]+)\]/);
        return match ? match[1] : null;
    };

    /**
     * Sync Google Calendar events to Discord Scheduled Events
     */
    const syncCalendarToDiscord = async (guild) => {
        if (!calendarHelper) {
            console.log('Calendar helper not initialized, skipping sync');
            return;
        }

        try {
            console.log(`Starting calendar sync for guild: ${guild.name}`);

            // Get events from Google Calendar (next 15 days)
            const calendarResult = await calendarHelper.getUpcomingEvents(15);
            
            if (!calendarResult.success) {
                console.error('Failed to fetch calendar events:', calendarResult.error);
                return;
            }

            const calendarEvents = calendarResult.events;
            console.log(`Found ${calendarEvents.length} events in Google Calendar`);

            // Get existing Discord scheduled events
            const discordEvents = await guild.scheduledEvents.fetch();
            console.log(`Found ${discordEvents.size} events in Discord`);

            // Create a map of Discord events by their Calendar ID (stored in description)
            const discordEventsByCalendarId = new Map();
            const discordEventsWithoutCalendarId = [];
            
            discordEvents.forEach(event => {
                const calendarId = extractCalendarIdFromDescription(event.description);
                if (calendarId) {
                    discordEventsByCalendarId.set(calendarId, event);
                } else {
                    discordEventsWithoutCalendarId.push(event);
                }
            });

            // Track which calendar events we've processed
            const processedCalendarIds = new Set();

            // Process each calendar event
            for (const calEvent of calendarEvents) {
                processedCalendarIds.add(calEvent.id);

                const startTime = new Date(calEvent.start.dateTime || calEvent.start.date);
                const endTime = new Date(calEvent.end.dateTime || calEvent.end.date);
                
                // Skip events that have already ended
                if (endTime < new Date()) {
                    continue;
                }

                // Skip events starting in less than 1 minute (Discord requires at least 1 minute in the future)
                if (startTime < new Date(Date.now() + 60000)) {
                    continue;
                }

                const eventDescription = `${calEvent.description || 'No description'}\n\n[CalendarID:${calEvent.id}]`;
                
                // Check if this event already exists in Discord
                const existingDiscordEvent = discordEventsByCalendarId.get(calEvent.id);

                if (existingDiscordEvent) {
                    // Event exists - check if it needs updating
                    const needsUpdate = 
                        existingDiscordEvent.name !== calEvent.summary ||
                        existingDiscordEvent.scheduledStartAt.getTime() !== startTime.getTime() ||
                        existingDiscordEvent.scheduledEndAt?.getTime() !== endTime.getTime();

                    if (needsUpdate) {
                        try {
                            await existingDiscordEvent.edit({
                                name: calEvent.summary,
                                scheduledStartTime: startTime.toISOString(),
                                scheduledEndTime: endTime.toISOString(),
                                description: eventDescription
                            });
                            console.log(`Updated Discord event: ${calEvent.summary}`);
                        } catch (updateError) {
                            console.error(`Failed to update event ${calEvent.summary}:`, updateError.message);
                        }
                    }
                } else {
                    // Event doesn't exist - create it
                    try {
                        const newEvent = await guild.scheduledEvents.create({
                            name: calEvent.summary,
                            scheduledStartTime: startTime.toISOString(),
                            scheduledEndTime: endTime.toISOString(),
                            privacyLevel: GuildScheduledEventPrivacyLevel.GuildOnly,
                            entityType: GuildScheduledEventEntityType.External,
                            entityMetadata: {
                                location: calEvent.location || 'Discord'
                            },
                            description: eventDescription
                        });
                        console.log(`Created Discord event: ${calEvent.summary}`);
                        syncedEventsMap.set(calEvent.id, newEvent.id);
                    } catch (createError) {
                        console.error(`Failed to create event ${calEvent.summary}:`, createError.message);
                    }
                }
            }

            // Delete Discord events that no longer exist in Calendar
            for (const [calendarId, discordEvent] of discordEventsByCalendarId) {
                if (!processedCalendarIds.has(calendarId)) {
                    // This event was deleted from Calendar - delete from Discord too
                    try {
                        await discordEvent.delete();
                        console.log(`Deleted Discord event (removed from calendar): ${discordEvent.name}`);
                        syncedEventsMap.delete(calendarId);
                    } catch (deleteError) {
                        console.error(`Failed to delete event ${discordEvent.name}:`, deleteError.message);
                    }
                }
            }

            console.log(`Calendar sync completed for guild: ${guild.name}`);

        } catch (error) {
            console.error('Error during calendar sync:', error);
            await sendErrorToMonitoring('Calendar Sync Error', error);
        }
    };

    /**
     * Run sync for all guilds the bot is in
     */
    const syncAllGuilds = async () => {
        console.log('Starting calendar sync for all guilds...');
        
        for (const [guildId, guild] of client.guilds.cache) {
            try {
                // Check if bot has permission to manage events
                const botMember = guild.members.me;
                if (botMember && botMember.permissions.has('ManageEvents')) {
                    await syncCalendarToDiscord(guild);
                } else {
                    console.log(`Skipping guild ${guild.name} - missing ManageEvents permission`);
                }
            } catch (error) {
                console.error(`Error syncing guild ${guild.name}:`, error);
            }
        }
        
        console.log('Calendar sync completed for all guilds');
    };

    // Start monitoring when bot is ready
    client.once(Events.ClientReady, async () => {
        console.log(`Bot is ready! Logged in as ${client.user.tag}`);
        
        // Send initial startup message
        try {
            const monitoringChannel = client.channels.cache.get(channelStatus);
            if (monitoringChannel) {
                const startupEmbed = new EmbedBuilder()
                    .setTitle('🚀 Bot Started')
                    .setDescription('The bot has successfully started and is now online!')
                    .setColor(0x00FF00)
                    .setTimestamp()
                    .addFields(
                        { name: '🤖 Bot', value: client.user.tag, inline: true },
                        { name: '🌐 Servers', value: `${client.guilds.cache.size}`, inline: true },
                        { name: '📅 Started At', value: new Date().toISOString(), inline: false }
                    );
                await monitoringChannel.send({ embeds: [startupEmbed] });
            }
        } catch (error) {
            console.error('Error sending startup message:', error);
        }

        // Start status update interval (every 60 minute)
        setInterval(sendStatusUpdate, 3600000);
        
        // Send first status after 5 seconds
        setTimeout(sendStatusUpdate, 5000);

        // ==================== START CALENDAR SYNC ====================
        if (calendarHelper) {
            console.log('Starting Calendar to Discord Events sync system...');
            
            // Run first sync after 60 seconds (give time for everything to initialize)
            setTimeout(async () => {
                console.log('Running initial calendar sync...');
                await syncAllGuilds();
            }, 60000);
            
            // Then sync every 10 minutes (600000 ms)
            setInterval(async () => {
                console.log('Running scheduled calendar sync...');
                await syncAllGuilds();
            }, 600000);
            
            console.log('Calendar sync scheduled: every 10 minutes');
        } else {
            console.log('Calendar helper not available - sync disabled');
        }

        // ==================== START ALLIANCE CHAT ENTERTAINMENT ====================
        if (channelAllianceChat) {
            allianceEntertainment = new AllianceEntertainment(client, channelAllianceChat);
            allianceEntertainment.start(1800000); // Start with 30 min delay
        } else {
            console.log('Alliance chat channel not configured - entertainment disabled');
        }
    });

    const gracefulShutdown = async () => {
        console.log('Bot is shutting down, saving conversations...');
        
        // Send shutdown message to monitoring channel
        try {
            const monitoringChannel = client.channels.cache.get(channelStatus);
            if (monitoringChannel) {
                const shutdownEmbed = new EmbedBuilder()
                    .setTitle('⚠️ Bot Shutting Down')
                    .setDescription('The bot is shutting down gracefully.')
                    .setColor(0xFFA500)
                    .setTimestamp()
                    .addFields(
                        { name: '⏱️ Total Uptime', value: formatUptime(Date.now() - botStartTime), inline: true },
                        { name: '📝 Total Reports', value: `${statusMessageCount}`, inline: true }
                    );
                await monitoringChannel.send({ embeds: [shutdownEmbed] });
            }
        } catch (error) {
            console.error('Error sending shutdown message:', error);
        }

        if (geminiChat && geminiChat.saveConversations) {
            geminiChat.saveConversations();
        }
        process.exit(0);
    };

    process.on('SIGINT', gracefulShutdown);
    process.on('SIGTERM', gracefulShutdown);
    process.on('SIGUSR2', gracefulShutdown);
    
    // Windows-specific: handle when the terminal window is closed
    if (process.platform === 'win32') {
        process.on('SIGHUP', gracefulShutdown);
    }

    process.on('uncaughtException', async (error) => {
        console.error('Uncaught Exception:', error);
        await sendErrorToMonitoring('Uncaught Exception', error);
    });

    process.on('unhandledRejection', async (reason, promise) => {
        console.error('Unhandled Rejection at:', promise, 'reason:', reason);
        await sendErrorToMonitoring('Unhandled Rejection', reason);
    });

    client.login(discordToken);
    console.log("Bot is logging in...");

} catch (e) {
    console.log("The bot crashed: ", e);
    // Note: Cannot send to monitoring channel here as client may not be initialized
}
