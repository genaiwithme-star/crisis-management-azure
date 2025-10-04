require('dotenv').config();
const axios = require('axios');
const cron = require('node-cron');

const TWITTER_API_URL = 'https://api.twitter.com/2/tweets';

async function postTweet() {
    try {
        const response = await axios.post(
            TWITTER_API_URL,
            { "text": "Hello from Crisis Management AI!" },
            { headers: { "Authorization": `Bearer ${process.env.TWITTER_BEARER_TOKEN}` } }
        );
        console.log('Tweet sent:', response.data);
    } catch (error) {
        console.error('Error posting tweet:', error.response ? error.response.data : error.message);
    }
}

cron.schedule('*/2 * * * *', () => {
    console.log('Running worker at', new Date().toISOString());
    postTweet();
});