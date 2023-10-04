const CharacterAI = require("node_characterai");
const characterAI = new CharacterAI();

const characterId = process.env.character_id;
const access_Token = process.env.access_token_ai;
let characterAiActive = false;
let chat;

const characterAiInit = async () => {
    await characterAI.authenticateWithToken(access_Token).then(() => console.log("CharacterAi Authenticated with token")).catch(() => console.log("Error authenticating with token"));
    
    await characterAI.createOrContinueChat(characterId).then((resp) => {
        console.log("CharacterAi chat created or continued");
        characterAiActive = true
        chat = resp;
    }).catch(() => console.log("Error creating or continuing chat"));
    
    console.log("CharacterAi init finished, is active? ", characterAiActive);
};

const characterAiChat = async (message) => {
    const response = await chat.sendAndAwaitResponse(message, true);
    return response.text;
};

module.exports = { init: characterAiInit, chat: characterAiChat, characterAiActive };