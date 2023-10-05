const CharacterAI = require("node_characterai");
const { accessTokenAi, characterId } = require("./env-variables");

const characterAI = new CharacterAI();

let characterAiActive = false;
let chat;

const characterAiInit = async () => {
    await characterAI.authenticateWithToken(accessTokenAi).then(() =>
        console.log("CharacterAi Authenticated with token")
    ).catch(() => console.log("Error authenticating with token"));

    await characterAI.createOrContinueChat(characterId).then((resp) => {
        console.log("CharacterAi chat created or continued");
        characterAiActive = true
        chat = resp;
    }).catch(() => console.log("Error creating or continuing chat"));

    console.log("CharacterAi init finished, is active? ", characterAiActive);
};

const characterAiChat = async (message) => {
    if (characterAiActive) {
        return chat.sendAndAwaitResponse(message, true)
            .then((res) => res.text)
            .catch(() =>
                "Hi, thank you for sending me a private message. However, I'm not able to respond right now, try later. Thank you for your understanding and cooperation."
            );
    }

    return "No AI active: Hi, thanks for sending me a private message. I appreciate your interest to speak with me. However, I'm not able to respond to questions, comments or information at the moment, my Ai is disable for now. Please use the appropriate channel on the server to communicate with your colleagues. Thank you for your understanding and cooperation."
};

module.exports = { init: characterAiInit, chat: characterAiChat };

