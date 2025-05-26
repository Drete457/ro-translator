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
const activeCountdowns = new Map();

try {
    const { init, chat } = require("./characterai");
    const translate = require("google-translate-api-x");
    const fetch = require("node-fetch");
    const { discordToken, channelWithImage, channelData, channelDataTest } = require("./env-variables");
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
                        const responseFilterAndClean = filterResponse(translationText);
                        writePlayerInfoToGoogleSheet(responseFilterAndClean);
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
                await message.channel.send("Commands available: `!players-info yyyy-mm-dd`, `!players-info-merits yyyy-mm-dd`, `!happy_birthday @username`, `!bastions_countdown [number]`, `!stop_countdown`");
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
            const argumentWithNumber = args.find(arg => !isNaN(arg) && Number(arg) > 0);

            let live = Number(argumentWithNumber);
            if (isNaN(live) || live <= 100) {
                await message.channel.send("Please specify a valid number of live points (e.g., >100)! Usage: `!bastions_countdown [number]`");
                return;
            }

            let countdownMessage = await message.channel.send(`Starting countdown from **${live}** live points...`);
            activeCountdowns.set(message.channel.id, { message: countdownMessage, timerId: null, currentLive: live });

            const timer = () => {
                const countdownData = activeCountdowns.get(message.channel.id);
                if (!countdownData) return; 

                let currentLivePoints = countdownData.currentLive;

                const timerId = setTimeout(async () => {
                    const updatedCountdownData = activeCountdowns.get(message.channel.id); 
                    if (!updatedCountdownData) return;


                    currentLivePoints = Math.max(0, currentLivePoints - 100);
                    updatedCountdownData.currentLive = currentLivePoints; 

                    const numberOfAttack = currentLivePoints / 100; 
                    const timeToFinishAllAttacks = numberOfAttack * 4; 
                    const hours = Math.floor(timeToFinishAllAttacks / 3600);
                    const minutes = Math.floor((timeToFinishAllAttacks % 3600) / 60);
                    const seconds = Math.floor(timeToFinishAllAttacks % 60);
                    const timeToFinishAllAttacksString = `${hours}h ${minutes}m ${seconds}s`;

                    let messageToSend;
                    if (currentLivePoints > 0) {
                        messageToSend = `**${currentLivePoints}** live points left. \n\n **Estimated time remaining:** ${timeToFinishAllAttacksString}`;
                    } else {
                        messageToSend = `**Bastion destroyed!** Countdown finished.`;
                    }

                    try {
                        let msgToEdit = updatedCountdownData.message;
                        if (msgToEdit && !msgToEdit.deleted) {
                            updatedCountdownData.message = await msgToEdit.edit(messageToSend);
                        } else {
                            console.log("Countdown message was deleted or not found.");
                            activeCountdowns.delete(message.channel.id);
                            return;
                        }
                    } catch (error) {
                        console.error("Error editing countdown message:", error);
                        activeCountdowns.delete(message.channel.id);
                        return;
                    }

                    if (currentLivePoints > 0) {
                        timer(); 
                    } else {
                        activeCountdowns.delete(message.channel.id); 
                    }
                }, 4000); 

                if (countdownData) { 
                    countdownData.timerId = timerId;
                }
            };
            timer();
        }

        if (message.content === "!stop_countdown") {
            const countdownData = activeCountdowns.get(message.channel.id);

            if (countdownData && countdownData.timerId) {
                clearTimeout(countdownData.timerId);
                activeCountdowns.delete(message.channel.id);

                try {
                    if (countdownData.message && !countdownData.message.deleted) {
                        await countdownData.message.edit("Countdown stopped manually.");
                    }
                } catch (editError) {
                    console.error("Could not edit message after stopping countdown:", editError);
                }
                await message.channel.send("Bastion countdown stopped.");
            } else {
                await message.channel.send("No active bastion countdown found in this channel.");
            }
        }

        if (!isInDevelopment && message.channel.type === ChannelType.DM && !message.author.bot) {
            try {
                const response = await chat(message.content);
                message.author.send(response).catch(dmError => console.log("Error sending DM response to user:", message.author.id, dmError));
            } catch (chatError) {
                console.log("Error getting response from characterAI:", chatError);
                message.author.send("Sorry, I couldn't process your message right now.").catch(dmError => console.log("Error sending DM error message to user:", message.author.id, dmError));
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
    if (!isInDevelopment) {
        init().then(() => console.log("CharacterAI initialized.")).catch(e => console.error("CharacterAI init error:", e));
    }

} catch (e) {
    console.log("The bot crashed: ", e);
}
