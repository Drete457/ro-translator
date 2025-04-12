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
const { getFirebase, collection, getDocs } = require('./firebase');
const { createExcelFile } = require('./create-excel-file');
const { playerInfo } = require('./helpers/excel-header');
const fs = require('fs');
const { birthdayMemes, generateBirthdayMessage } = require('./birthday');

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

                const attachment = message.attachments.forEach(async (attachment) => {
                    if (!attachment.contentType.startsWith('image')) return;

                    await ocrImageToText(attachment.name, attachment.url).then(async (resp) => {
                        const result = await translate(resp, {
                            to: "en",
                            forceBatch: false,
                            autoCorrect: false,
                            requestFunction: fetch,
                        })
                            .then((res) => res.text)
                            .catch(() => { throw new Error("It is not possible to translate from your language, please take the print-screen in English") });

                        const responseFilterAndClean = filterResponse(result);

                        writePlayerInfoToGoogleSheet(responseFilterAndClean);
                    }).catch((e) => {
                        const userName = message.author.username;
                        originalChannel.send(richMessage(userName, e.message)).catch(() => console.log("Error sending message to channel: ", canal + " \n\n"))
                    });
                });
            }
        }

        if (message.channel.id === channelDataTest || message.channel.id === channelData) {
            if(message.content === "!commands") {
                await message.channel.send("Commands available: !players-info, !players-info-merits");
                return;
            }

            if (message.content === "!players-info") {
                const db = await getFirebase();
                const playersCollectionRef = collection(db, "playersInfo");
                const querySnapshot = await getDocs(playersCollectionRef);
                const data = querySnapshot.docs.map(doc => doc.data());

                const fileName = `players_info_${Date.now()}.xlsx`;
                const path = await createExcelFile(playerInfo, data, fileName, "Players Info");

                const attachment = new AttachmentBuilder(path, { name: fileName });
                if (attachment !== null || attachment !== undefined) {
                    await message.channel.send({
                        content: 'Here is the players information as Excel file:',
                        files: [attachment]
                    });
                    fs.unlinkSync(path);
                } else {
                    await message.channel.send('Error generating Excel file. Please try again later.');
                }
            }

            if(message.content === "!players-info-merits") {
                const db = await getFirebase();
                const playersCollectionRef = collection(db, "playersInfo");
                const playersCollectionMeritsRef = collection(db, "playersMerits");
                const querySnapshot = await getDocs(playersCollectionRef);
                const querySnapshotMerits = await getDocs(playersCollectionMeritsRef);
                const data = querySnapshot.docs.map(doc => doc.data());
                const dataMerits = querySnapshotMerits.docs.map(doc => doc.data());
                const dataMeritsFiltered = dataMerits.map((item) => {
                    const player = data.find((player) => player.userId === item.userId);
                    
                    return ({
                        userId: item.userId,
                        userName: player ? player.userName : "Unknown",
                        power: player ? player.power : "Unknown",
                        merits: item.merits,
                        percentageMeritsDividePower: `${Math.round((item.merits / player.power) * 10000) / 100}%`,
                        timestamp: item.timestamp,                       
                    })
                });

                const headerFormatted = Object.freeze({
                    userId: undefined,
                    userName: '',
                    power: undefined,
                    merits: undefined,
                    percentageMeritsDividePower: undefined,
                });

                const fileName = `players_merits_${Date.now()}.xlsx`;
                const path = await createExcelFile(headerFormatted, dataMeritsFiltered, fileName, "Players Merits Info");

                const attachment = new AttachmentBuilder(path, { name: fileName });
                if (attachment !== null || attachment !== undefined) {
                    await message.channel.send({
                        content: 'Here is the players Merits as Excel file:',
                        files: [attachment]
                    });
                    fs.unlinkSync(path);
                } else {
                    await message.channel.send('Error generating Excel file. Please try again later.');
                }
            }
        }

        if (message.content.startsWith("!happy_birthday")) {
            const args = message.content.split(" ");
            args.shift();

            if (args.length === 0) {
                await message.channel.send("Please specify a player name! Usage: !happy_birthday [player name]");
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
            const birthdayMessage = generateBirthdayMessage(playerName);

            try {
                await message.channel.send({
                    content: birthdayMessage.replace(playerName, playerMention), 
                    files: [randomMeme]
                });

                await message.react('🎂');
                await message.react('🎉');
            } catch (error) {
                console.error("Error sending birthday message:", error);
                await message.channel.send("Sorry, I couldn't send the birthday message. Please try again later.");
            }
        }

        if (!isInDevelopment && message.channel.type === ChannelType.DM)
            message.author.send(await chat(message.content));
    });

    client.on(Events.MessageReactionAdd, async (reaction, user) => {
        if (!isInDevelopment) {
            if (user.bot) return;
            if (typeof reaction.emoji.name !== "string") return;

            if (reaction.partial) {
                try {
                    await reaction.fetch();
                } catch (error) {
                    console.log("Something went wrong when fetching the message: ", error);
                    return;
                }
            }

            const reactionName = reaction.emoji.name;
            const countryInformation = countries[reactionName];

            if (countryInformation === undefined || countryInformation === null)
                return;

            const messageToTranslate = reaction.message.content;

            if (
                messageToTranslate === undefined ||
                messageToTranslate === null ||
                messageToTranslate === ""
            )
                return;

            await translate(messageToTranslate, {
                to: countryInformation.langs[0],
                forceBatch: false,
                autoCorrect: true,
                requestFunction: fetch,
            })
                .then((res) =>
                    user.send(quote(messageToTranslate) + " \n\n " + res.text + " \n\n ").catch(() => console.log("Error sending message to user: ", user + " \n\n"))
                )
                .catch(() =>
                    user.send(
                        quote(messageToTranslate) +
                        " \n\n " +
                        `Error: It is not possible to translate the language of this country ${countryInformation.name}` +
                        " \n\n "
                    ).catch(() => console.log("Error sending message to user: ", user + " \n\n"))
                );
        }
    });

    client.login(discordToken);
    if (!isInDevelopment)
        init();

} catch (e) {
    console.log("The bot crashed: ", e);
}
