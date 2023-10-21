const { discordToken, channelWithImage, ocrSpaceApiKey } = require("./env-variables");

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
        OCREngine: 3,
    });

    return fetch(`${ocrSpaceApiUrl}?${urlParams}`, {
        method: "GET",
    })
        .then((res) => res.json())
        .then((json) => {
            const parsedText = json.ParsedResults[0].ParsedText;
            return parsedText;
        })
        .catch((e) => { throw new Error(e.message) });
};

module.exports = { ocrImageToText };