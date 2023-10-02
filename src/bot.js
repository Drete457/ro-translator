const { Client, GatewayIntentBits, Events, quote } = require('discord.js');
const fetch = require('node-fetch');
const translate = require('google-translate-api-x');
const countries = require("./countries");

const intents = [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.GuildMessageReactions,
    GatewayIntentBits.MessageContent,
];

const client = new Client({ intents });
const token = process.env.discord_key;

client.on(Events.MessageReactionAdd, async (reaction, user) => {
    if (user.bot) return;
    if (typeof reaction.emoji.name !== 'string') return;

    const reactionName = reaction.emoji.name;
    const countryInformation = countries[reactionName];

    if (countryInformation === undefined || countryInformation === null) {
        user.send(`Error: The country ${reactionName} is not available for translation \n Please, try again with another country \n\n`);
        return;
    };

    const messageToTranslate = reaction.message.content;

    if (messageToTranslate === undefined || messageToTranslate === null || messageToTranslate === "") return;

    await translate(messageToTranslate, {
        to: countryInformation.code,
        forceBatch: false,
        autoCorrect: true,
        requestFunction: fetch
    })
        .then(res => user.send(quote(messageToTranslate)
            + " \n\n "
            + res.text
            + " \n\n "
        ))
        .catch(() => user.send(quote(messageToTranslate)
            + " \n\n "
            + `Error: It is not possible to translate into language for the country ${countryInformation.name}`
            + " \n\n "
        ));
});

client.login(token);
