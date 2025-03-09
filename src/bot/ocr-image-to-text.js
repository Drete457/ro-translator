const { GoogleSpreadsheet } = require('google-spreadsheet');
const { JWT } = require('google-auth-library');
const https = require('https');
const path = require('path');
const fs = require('fs');
const sharp = require('sharp');
const FormData = require('form-data');
const { ocrSpaceApiKey, googleSheetId, googleClientEmail, googlePrivateKey } = require("./env-variables");

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

    const powerMatch = response.match(/Merits?\s+([\d,]+)\s+([\d,]+)/);
    if (powerMatch) {
        playerInfo.power = powerMatch[1];
        playerInfo.merits = powerMatch[2];
    }
console.log("response", response)
console.log("playerInfo", playerInfo)
    if (Object.values(playerInfo).some(value => value === null)) throw new Error("Error reading the information from the image");

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

const options = {
    quality: 70,
    size: 1000000,
};
const downloadTheFileAndCreateTheBufferString = (imageName, imagePath) => {
    return new Promise((resolve, reject) => {
        const saveDir = './images';

        if (!fs.existsSync(saveDir)) {
            fs.mkdirSync(saveDir);
        }

        const pathOfTheImage = path.join(saveDir, imageName);
        const filePath = fs.createWriteStream(pathOfTheImage);

        https.get(imagePath, (res) => {
            res.pipe(filePath);
            filePath.on('finish', () => {
                filePath.close();

                fs.readFile(pathOfTheImage, (err, data) => {
                    if (err) {
                        reject(new Error("Impossible to read the image, try again"));
                        return;
                    }

                    sharp(data)
                        .resize({ fit: 'inside' })
                        .jpeg(options)
                        .toBuffer((_, buffer) => {
                            if (err) {
                                reject(new Error('Image is to big to be compressed'));
                                return;
                            }
                            const imageFileCompressedPath = path.join(saveDir, `compressed-${imageName}`);

                            fs.writeFileSync(imageFileCompressedPath, buffer);

                            resolve(buffer.toString('base64'));
                            fs.unlinkSync(pathOfTheImage);
                            fs.unlinkSync(imageFileCompressedPath);
                        });
                });
            })
        })
    });
};

const ocrSpaceApiUrl = "https://api.ocr.space/parse/image";
const ocrImageToText = (imageName, imagePath) => {
    return downloadTheFileAndCreateTheBufferString(imageName, imagePath).then((buffer) => {
        const base64Image = `data:image/jpeg;base64,${buffer}`;

        const formData = new FormData();
        formData.append('base64Image', base64Image);
        formData.append('language', 'eng');
        formData.append('detectOrientation', "true");
        formData.append('isOverlayRequired', "true");
        formData.append('isTable', "true");
        formData.append('scale', "true");
        formData.append('iscreatesearchablepdf', "false");
        formData.append('issearchablepdfhidetextlayer', "false");
        formData.append('OCREngine', 2);

        return fetch(ocrSpaceApiUrl, {
            method: "POST",
            headers: {
                'apikey': ocrSpaceApiKey,
                ...formData.getHeaders(),
            },
            body: formData.getBuffer(),
        }).then((res) => res.json()).then((json) => {
            if (Object.keys(json).includes('ErrorMessage')) throw new Error(json.ErrorMessage);
            return json.ParsedResults[0].ParsedText
        }).catch((e) => { throw new Error(e.message) });
    }).catch((e) => { throw new Error(e.message) });
};



module.exports = { filterResponse, writePlayerInfoToGoogleSheet, downloadTheFileAndCreateTheBufferString, ocrImageToText };