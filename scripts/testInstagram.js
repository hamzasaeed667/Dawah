require('dotenv').config();
const { getImageUrl } = require('../services/imageFetcher');
const { uploadImageToInstagram } = require('../services/instagram');
const logger = require('../utils/logger');

async function testInstagramUpload() {
  try {
    const pageNo = 1;
    const imageUrl = getImageUrl(pageNo);
    logger.info(`Fetching test image from ${imageUrl}...`);

    const caption = `📖 Test Post - Page ${pageNo}\n\n#Dawah #TestPost #Instagram`;

    logger.info('Testing Instagram Upload...');
    const result = await uploadImageToInstagram(imageUrl, caption);
    logger.info('🎉 Instagram Test Completed Successfully!');
    console.log('Result:', result);
  } catch (error) {
    logger.error('❌ Instagram Test Failed:', error.message);
    if (error.response?.data) {
      console.error('API Error Data:', JSON.stringify(error.response.data, null, 2));
    }
  }
}

testInstagramUpload();
