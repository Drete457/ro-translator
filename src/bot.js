require('dotenv').config();
const {
    Client,
    GatewayIntentBits,
    Events,
    Partials,
    ChannelType,
    quote,
} = require("discord.js");
const fetch = require("node-fetch");
const translate = require("google-translate-api-x");
const countries = require("./countries");
const { discordToken } = require("./env-variables");
const { init, chat } = require("./characterai");

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
    if (message.author.bot) return;

    if (message.channel.type === ChannelType.DM)
        message.author.send(await chat(message.content));
});

client.on(Events.MessageReactionAdd, async (reaction, user) => {
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
});

client.login(discordToken);
//init();
