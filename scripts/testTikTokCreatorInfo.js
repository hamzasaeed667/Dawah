require('dotenv').config();
const axios = require('axios');
const logger = require('../utils/logger');

async function testCreatorInfo() {
  const accessToken = process.env.TIKTOK_ACCESS_TOKEN;
  logger.info('Testing TikTok Creator Info query with Access Token...');

  try {
    const res = await axios.post(
      'https://open.tiktokapis.com/v2/post/publish/creator_info/query/',
      {},
      {
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json; charset=UTF-8'
        },
        timeout: 15000
      }
    );

    console.log('✅ Creator Info Response:', JSON.stringify(res.data, null, 2));
  } catch (err) {
    console.error('❌ Creator Info Query Failed:', err.response?.data || err.message);
  }
}

testCreatorInfo();
