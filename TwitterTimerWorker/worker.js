const axios = require('axios');

module.exports = async function (context, myTimer) {
    const timeStamp = new Date().toISOString();
    context.log('Twitter worker triggered at', timeStamp);

    const bearerToken = process.env.TWITTER_BEARER_TOKEN;

    if (!bearerToken) {
        context.log('TWITTER_BEARER_TOKEN not set in Application Settings!!!');
        return;
    }

    try {
        const response = await axios.get('https://api.twitter.com/2/tweets/sample/stream', {
            headers: {
                Authorization: `Bearer ${bearerToken}`
            }
        });

        context.log('Twitter API response received:', response.status);

    } catch (error) {
        context.log('Error fetching Twitter API:', error.message);
    }
};
