require('dotenv').config();
const { uploadImageToLinkedIn } = require('../services/linkedin');
const { getImageUrl, getImageBuffer } = require('../services/imageFetcher');
const logger = require('../utils/logger');

async function testLinkedIn() {
  try {
    logger.info('--- Testing LinkedIn Upload ---');
    const testPage = 1;
    const imageUrl = getImageUrl(testPage);
    logger.info(`Fetching image for page ${testPage}: ${imageUrl}`);

    const buffer = await getImageBuffer(imageUrl);
    logger.info(`Fetched image buffer: ${buffer.length} bytes`);

    const caption = `Page ${testPage} | "Purification of the Mind" #Dawah #IslamicReminder`;
    logger.info('Uploading to LinkedIn...');

    const result = await uploadImageToLinkedIn(buffer, caption);
    logger.info('✅ LinkedIn test completed successfully!');
    logger.info('Result:', JSON.stringify(result, null, 2));
  } catch (error) {
    logger.error('❌ LinkedIn test failed:', error.message);
    if (error.response?.data) {
      logger.error('Response data:', JSON.stringify(error.response.data, null, 2));
    }
  }
}

testLinkedIn();
