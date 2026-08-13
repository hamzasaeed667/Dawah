require('dotenv').config();
const { getVideoUrl } = require('../services/videoFetcher');
const { uploadVideoViaBrowser } = require('../services/tiktokBrowser');
const logger = require('../utils/logger');

async function runBrowserTest() {
  try {
    const videoPageNo = 1;
    const videoUrl = getVideoUrl(videoPageNo);
    logger.info(`🔗 Direct Cloudinary Video URL for Page ${videoPageNo}: ${videoUrl}`);

    const caption = `🎥 Islamic Daily Reflection - Page ${videoPageNo}\n\n#Dawah #IslamicVideo #Reflection #TikTok`;

    logger.info('🚀 Launching TikTok Studio Browser Upload Test (Headed mode)...');
    const result = await uploadVideoViaBrowser(videoUrl, caption, { headless: false });
    logger.info('🎉 Browser Upload Test Completed!', result);
  } catch (err) {
    logger.error('❌ Browser Upload Test Error:', err.message);
  }
}

runBrowserTest();
