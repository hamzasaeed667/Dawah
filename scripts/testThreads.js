require('dotenv').config();
const { getImageUrl } = require('../services/imageFetcher');
const { uploadImageToThreads } = require('../services/threads');
const logger = require('../utils/logger');

async function testThreadsUpload() {
  try {
    const pageNo = 1;
    const imageUrl = getImageUrl(pageNo);
    logger.info(`Fetching test image from ${imageUrl}...`);

    const caption = `📖 Test Post - Page ${pageNo}\n\n#Dawah #TestPost #Threads`;

    logger.info('Testing Threads Upload...');
    const result = await uploadImageToThreads(imageUrl, caption);
    logger.info('🎉 Threads Test Completed Successfully!');
    console.log('Result:', result);
  } catch (error) {
    logger.error('❌ Threads Test Failed:', error.message);
    if (error.code) console.error('Error Code:', error.code);
    if (error.data) console.error('API Error Data:', JSON.stringify(error.data, null, 2));
    console.error('Full Error:', error);
  }
}

testThreadsUpload();
