const cron = require('node-cron');
const fetch = require('node-fetch');

const pingGoogle = () => {
    cron.schedule('*/2 * * * *', () => {
        const url = 'https://www.google.com';

        fetch(url)
            .then(response => {
                if (!response.ok) {
                    throw new Error(`No ping`);
                }
                console.log(`Ping Success ${url}`);
            })
            .catch(error => {
                console.error(error);
            });
    });
}

module.exports = pingGoogle;
