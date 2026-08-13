const cron = require('node-cron');
const uploadCronTask = require('./cron/uploadPage');
const uploadVideoCronTask = require('./cron/uploadVideo');
const { refreshAllTokens } = require('./cron/refreshTokens');
const { getState } = require('./utils/stateManager');
const { getVideoState } = require('./utils/videoStateManager');
const logger = require('./utils/logger');

const state = getState();
const videoState = getVideoState();

logger.info('==================================================');
logger.info('   Dawah Book Page Social Media Automation Server   ');
logger.info(`   Current Image Page: ${state.currentPage} / ${state.maxPage}`);
logger.info(`   Current Video Page: ${videoState.currentVideoPage} / ${videoState.maxPage}`);
logger.info(`   Last Image Upload:  ${state.lastUpload || 'Never'}`);
logger.info(`   Last Video Upload:  ${videoState.lastUpload || 'Never'}`);
logger.info('==================================================');

// Schedule image upload cron task to run daily at 00:00 (midnight)
cron.schedule('0 0 * * *', async () => {
  logger.info('⏰ Triggering daily image upload cron job...');
  await uploadCronTask();
});

// Schedule video upload cron task to run daily at 00:00 (midnight)
cron.schedule('0 0 * * *', async () => {
  logger.info('🎥 Triggering daily video upload cron job...');
  await uploadVideoCronTask();
});

// Run background token auto-refresh task daily at 3:00 AM
cron.schedule('0 3 * * *', async () => {
  logger.info('🔄 Running daily token maintenance cron job...');
  await refreshAllTokens();
});

logger.info('📌 Image upload cron scheduled: Runs daily at 00:00 (0 0 * * *).');
logger.info('📌 Video upload cron scheduled: Runs daily at 00:00 (0 0 * * *).');
logger.info('📌 Token refresh cron scheduled: Runs daily at 03:00 AM (0 3 * * *).');

uploadCronTask().then().catch();
uploadVideoCronTask().then().catch()