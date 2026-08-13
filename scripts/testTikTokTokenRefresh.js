require('dotenv').config();
const { refreshTikTokToken } = require('../cron/refreshTokens');
const logger = require('../utils/logger');

async function testTokenAutoRefresh() {
  logger.info('🔄 Testing automatic TikTok Token Refresh background call...');
  try {
    await refreshTikTokToken();
    logger.info('✅ TikTok Token Auto-Refresh Test Completed!');
    logger.info(`Updated TIKTOK_ACCESS_TOKEN in env: ${process.env.TIKTOK_ACCESS_TOKEN?.substring(0, 15)}...`);
  } catch (err) {
    logger.error('❌ TikTok Token Auto-Refresh Failed:', err.message);
  }
}

testTokenAutoRefresh();
