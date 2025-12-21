const discordToken = process.env.discord_key;
const accessTokenAi = process.env.access_token_ai;
const characterId = process.env.character_id;
const geminiApiKey = process.env.gemini_api_key;
const channelWithImage = process.env.discord_channel_with_image;
const channelDataTest = process.env.discord_channel_data_test;
const channelData = process.env.discord_channel_data;
const channelStatus = process.env.discord_channel_status;
const channelAllianceChat = process.env.discord_channel_alliance_chat;
const channelEvent = process.env.discord_event_channel;
const ocrSpaceApiKey = process.env.ocr_space_api_key;
const googleSheetId = process.env.google_sheet_id;
const googleClientEmail = process.env.google_client_email;
const googlePrivateKey = process.env.google_private_key.replace(/\\n/g, "\n");
const googleCalendarId = process.env.google_calendar_id;
const discordOwnerId = process.env.discord_owner_id;

module.exports = { 
    discordToken, 
    accessTokenAi, 
    characterId, 
    geminiApiKey, 
    channelWithImage, 
    channelDataTest, 
    channelData, 
    channelStatus,
    channelAllianceChat,
    channelEvent,
    ocrSpaceApiKey, 
    googleSheetId, 
    googleClientEmail, 
    googlePrivateKey,
    googleCalendarId, 
    discordOwnerId
};