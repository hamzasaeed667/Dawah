require('dotenv').config();
const axios = require('axios');
const { updateEnv } = require('../utils/envUtils');
const logger = require('../utils/logger');

async function refreshUserToken() {
  const url = `https://graph.facebook.com/v18.0/oauth/access_token`;
  const params = {
    grant_type: 'fb_exchange_token',
    client_id: process.env.FB_APP_ID,
    client_secret: process.env.FB_APP_SECRET,
    fb_exchange_token: process.env.FB_LONG_LIVED_USER_TOKEN
  };

  try {
    const res = await axios.get(url, { params });
    const newToken = res.data.access_token;
    updateEnv('FB_LONG_LIVED_USER_TOKEN', newToken);
    logger.info('🔄 Refreshed Facebook token successfully.');
  } catch (err) {
    logger.error('❌ Token refresh failed:', err.response?.data || err.message);
  }
}

module.exports = refreshUserToken;
