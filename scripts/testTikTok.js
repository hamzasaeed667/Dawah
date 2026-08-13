require('dotenv').config();
const { getImageUrl } = require('../services/imageFetcher');
const { uploadImageToTikTok } = require('../services/tiktok');
const logger = require('../utils/logger');

async function testTikTokUpload() {
  try {
    const pageNo = 1;
    const imageUrl = getImageUrl(pageNo);
    logger.info(`Fetching test image from ${imageUrl}...`);

    const caption = `📖 Test Post - Page ${pageNo}\n\n#Dawah #TestPost #TikTok`;

    logger.info('Testing TikTok Upload...');
    const result = await uploadImageToTikTok(imageUrl, caption);
    logger.info('🎉 TikTok Test Completed Successfully!');
    console.log('Result:', result);
  } catch (error) {
    logger.error('❌ TikTok Test Failed:', error.message);
    if (error.code) console.error('Error Code:', error.code);
    if (error.data) console.error('API Error Data:', JSON.stringify(error.data, null, 2));
    console.error('Full Error:', error);
  }
}

testTikTokUpload();
