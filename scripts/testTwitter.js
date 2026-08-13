require('dotenv').config();
const { getImageUrl, getImageBuffer } = require('../services/imageFetcher');
const { uploadImageToTwitter } = require('../services/twitter');
const logger = require('../utils/logger');

async function testTwitterUpload() {
  try {
    const pageNo = 1;
    const imageUrl = getImageUrl(pageNo);
    logger.info(`Fetching test image from ${imageUrl}...`);

    const imageBuffer = await getImageBuffer(imageUrl);
    logger.info(`Downloaded test image buffer (${imageBuffer.length} bytes).`);

    const caption = `📖 Test Post - Page ${pageNo}\n\n#Dawah #TestPost`;

    logger.info('Testing Twitter Upload...');
    const result = await uploadImageToTwitter(imageBuffer, caption);
    logger.info('🎉 Twitter Test Completed Successfully!');
    console.log('Result:', result);
  } catch (error) {
    logger.error('❌ Twitter Test Failed:', error.message);
    if (error.code) console.error('Error Code:', error.code);
    if (error.data) console.error('API Error Data:', JSON.stringify(error.data, null, 2));
    if (error.errors) console.error('Errors:', JSON.stringify(error.errors, null, 2));
    console.error('Full Error:', error);
  }
}

testTwitterUpload();

