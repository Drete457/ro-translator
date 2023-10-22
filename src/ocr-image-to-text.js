const { GoogleSpreadsheet } = require('google-spreadsheet');
const { JWT } = require('google-auth-library');
const { ocrSpaceApiKey, googleSheetId, googleClientEmail, googlePrivateKey } = require("./env-variables");

const ocrSpaceApiUrl = "https://api.ocr.space/parse/imageUrl";
const ocrImageToText = (imagePath) => {
    const urlParams = new URLSearchParams({
        apikey: ocrSpaceApiKey,
        url: imagePath,
        language: "eng",
        detectOrientation: true,
        isOverlayRequired: true,
        isTable: true,
        scale: true,
        OCREngine: 2,
    });

    return fetch(`${ocrSpaceApiUrl}?${urlParams}`, {
        method: "GET",
    })
        .then((res) => res.json())
        .then((json) => {
            if (Object.keys(json).includes('ErrorMessage')) throw new Error(json.ErrorMessage);

            return json.ParsedResults[0].ParsedText
        })
        .catch((e) => { throw new Error(e.message) });
};

const filterResponse = (response) => {
    const playerInfo = {
        id: null,
        name: null,
        server: null,
        alliance: null,
        power: null,
        merits: null,
    };

    const lordMatch = response.match(/Lord\s+(\d+)\s+([\s\S]+?)\n/);
    if (lordMatch) {
        playerInfo.id = lordMatch[1];
        playerInfo.name = lordMatch[2].replace(/[\t\r]/g, '');
    }

    const serverMatch = response.match(/Server\s+(.+?)\s+#(\d+)/);
    if (serverMatch)
        playerInfo.server = serverMatch[2];

    const allianceMatch = response.match(/\[(\w+)\]/);
    if (allianceMatch)
        playerInfo.alliance = allianceMatch[1];

    const powerMatch = response.match(/Merits\s+([\d,]+)\s+([\d,]+)/);
    if (powerMatch) {
        playerInfo.power = powerMatch[1];
        playerInfo.merits = powerMatch[2];
    }

    if (Object.values(playerInfo).some(value => value === null)) throw new Error("Error parsing image");

    return playerInfo;
};

const sheetName = 'bot';
const serviceAccountAuth = new JWT({
    email: googleClientEmail,
    key: googlePrivateKey,
    scopes: [
        'https://www.googleapis.com/auth/spreadsheets',
    ],
});
const writePlayerInfoToGoogleSheet = async (playerInfo) => {
    const doc = new GoogleSpreadsheet(googleSheetId, serviceAccountAuth);
    await doc.loadInfo();

    const sheet = doc.sheetsByTitle["bot"];
    await sheet.addRow(playerInfo).catch((e) => { throw new Error(e.message) });
};

module.exports = { ocrImageToText, filterResponse, writePlayerInfoToGoogleSheet };