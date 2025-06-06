require('dotenv').config();
const {
    Client,
    GatewayIntentBits,
    Events,
    Partials,
    ChannelType,
    quote,
    AttachmentBuilder
} = require("discord.js");
const { getFirebase, collection, getDocs, query, where, orderBy } = require('./firebase');
const { createExcelFile } = require('./create-excel-file');
const { playerInfo } = require('./helpers/excel-header');
const fs = require('fs');
const { birthdayMemes, generateBirthdayMessage } = require('./birthday');
const { formatTime, parseDurationToSeconds } = require('./helpers/timer-format');

const activeCountdowns = new Map();

try {
    const GeminiChat = require("./gemini");
    const translate = require("google-translate-api-x");
    const fetch = require("node-fetch");
    const { discordToken, channelWithImage, channelData, channelDataTest, geminiApiKey } = require("./env-variables");
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

    const client = new Client({ intents, partials });

    const geminiChat = new GeminiChat(geminiApiKey);
    geminiChat.init();

    client.on(Events.MessageCreate, async (message) => {
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

        if (message.channel.id === channelDataTest || message.channel.id === channelData) {
            if (message.content === "!commands") {
                await message.channel.send("Commands available: `!players-info yyyy-mm-dd`, `!players-info-merits yyyy-mm-dd`");
                return;
            }

            if (message.content.startsWith("!players-info")) {
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

                const fileName = `players_info_${dateFilter ? args[0].replace(/-/g, '') + '_' : ''}${Date.now()}.xlsx`;
                const filePath = await createExcelFile(playerInfo, data, fileName, `Players Info${dateFilter ? ' from ' + args[0] : ''}`);

                if (filePath) {
                    const attachment = new AttachmentBuilder(filePath, { name: fileName });
                    await message.channel.send({
                        content: `Here is the players information${dateFilter ? ' from ' + args[0] : ''} as Excel file:`,
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

            
        } if (message.content === "!commands") {
            await message.channel.send("Commands available: `!happy_birthday @username`, `!bastions_countdown live_points damage_per_second`, `!countdown time message`, `!stop_countdown`, `!ICE message`, `!resume`");
            return;
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

                const response = await geminiChat.chat(userMessage, conversationId);

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

        if (!isInDevelopment && message.channel.type === ChannelType.DM && !message.author.bot) {
            try {
                const conversationId = `dm_${message.author.id}`;
                const response = await geminiChat.chat(message.content, conversationId);
                message.author.send(response).catch(dmError => console.log("Error sending DM response to user:", message.author.id, dmError));
            } catch (chatError) {
                console.log("Error getting response from Gemini:", chatError);
                message.author.send("Sorry, I couldn't process your message at the moment.").catch(dmError => console.log("Error sending DM error message to user:", message.author.id, dmError));
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

    client.login(discordToken);
    console.log("Bot is logged in and ready.");

} catch (e) {
    console.log("The bot crashed: ", e);
}
