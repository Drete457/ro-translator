require('dotenv').config();
const {
    Client,
    GatewayIntentBits,
    Events,
    Partials,
    ChannelType,
    quote,
} = require("discord.js");
const { init, chat } = require("./characterai");
const translate = require("google-translate-api-x");
const fetch = require("node-fetch");
const { discordToken, channelWithImage } = require("./env-variables");
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

                await ocrImageToText(attachment.url).then(resp => {
                    const responseFilterAndClean = filterResponse(resp);
                    writePlayerInfoToGoogleSheet(responseFilterAndClean);
                }).catch((e) => {
                    const userName = message.author.username;
                    originalChannel.send(richMessage(userName, e.message)).catch(() => console.log("Error sending message to channel: ", canal + " \n\n"))
                });
            });
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
