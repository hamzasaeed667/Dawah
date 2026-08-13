require('dotenv').config();
const { getImageUrl } = require('../services/imageFetcher');
const { uploadPinToPinterest } = require('../services/pinterest');
const logger = require('../utils/logger');

async function testPinterestUpload() {
  try {
    const pageNo = 1;
    const imageUrl = getImageUrl(pageNo);
    logger.info(`Fetched test image URL for page ${pageNo}: ${imageUrl}`);

    const title = `Page ${pageNo} | Purification of the Mind`;
    const description = `📖 Daily Spiritual Reflection - Page ${pageNo}\n\n#Dawah #IslamicReminders #Pinterest`;

    logger.info('Testing Pinterest Pin Upload (v5 API)...');
    const result = await uploadPinToPinterest(imageUrl, title, description);
    logger.info('🎉 Pinterest Pin Upload Test Completed Successfully!');
    console.log('Result:', result);
  } catch (error) {
    logger.error('❌ Pinterest Upload Test Failed:', error.message);
    if (error.code) console.error('Error Code:', error.code);
    if (error.data) console.error('API Error Data:', JSON.stringify(error.data, null, 2));
    console.error('Full Error:', error);
  }
}

testPinterestUpload();
