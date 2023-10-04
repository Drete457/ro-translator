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
const { init, chat, characterAiActive } = require("./characterai");

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
const token = process.env.discord_key;

client.on(Events.MessageCreate, async (message) => {
    if (message.author.bot) return;

    if (message.channel.type === ChannelType.DM) {
        if (characterAiActive) {
            chat(message.content)
                .then((res) => message.author.send(res))
                .catch(() => message.author.send("Hi, thanks for sending me a private message. I appreciate your interest to speak with me. However, I'm not able to respond right now, try later. Thank you for your understanding and cooperation."));
            return;
        }
    }

    message.author.send("Hi, thanks for sending me a private message. I appreciate your interest to speak with me. However, I'm not able to respond to questions, comments or information at the moment, my Ai is disable for now. Please use the appropriate channel on the server to communicate with your colleagues. Thank you for your understanding and cooperation.");
});

client.on(Events.MessageReactionAdd, async (reaction, user) => {
    if (user.bot) return;
    if (typeof reaction.emoji.name !== "string") return;

    if (reaction.partial) {
        try {
            await reaction.fetch();
        } catch (error) {
            console.error("Something went wrong when fetching the message:", error);
            user.send(
                quote(messageToTranslate) +
                " \n\n " +
                `Error: It is no longer possible to translate this message` +
                " \n\n "
            );
            return;
        }
    }

    const reactionName = reaction.emoji.name;
    const countryInformation = countries[reactionName];

    if (countryInformation === undefined || countryInformation === null) {
        user.send(
            `Error: The country ${reactionName} is not available for translation \n Please, try again with another country \n\n`
        );
        return;
    }

    const messageToTranslate = reaction.message.content;

    if (
        messageToTranslate === undefined ||
        messageToTranslate === null ||
        messageToTranslate === ""
    )
        return;

    await translate(messageToTranslate, {
        to: countryInformation.code,
        forceBatch: false,
        autoCorrect: true,
        requestFunction: fetch,
    })
        .then((res) =>
            user.send(quote(messageToTranslate) + " \n\n " + res.text + " \n\n ")
        )
        .catch(() =>
            user.send(
                quote(messageToTranslate) +
                " \n\n " +
                `Error: It is not possible to translate into language for the country ${countryInformation.name}` +
                " \n\n "
            )
        );
});

client.login(token);
init();
