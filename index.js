const http = require('http');
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

// Lightweight HTTP server for Cloud Hosting Health Checks & Manual Triggers
const PORT = process.env.PORT || 3000;
const server = http.createServer(async (req, res) => {
  res.setHeader('Content-Type', 'application/json');

  if (req.url === '/' || req.url === '/health') {
    const currentState = getState();
    const currentVideoState = getVideoState();
    res.writeHead(200);
    return res.end(JSON.stringify({
      status: 'online',
      message: 'Dawah Social Media Automation Server Active',
      imageState: currentState,
      videoState: currentVideoState,
      timestamp: new Date().toISOString()
    }, null, 2));
  }

  if (req.url === '/api/trigger-image' && req.method === 'POST') {
    logger.info('🚀 Manual image upload triggered via HTTP API');
    uploadCronTask().catch(e => logger.error('HTTP trigger error:', e.message));
    res.writeHead(202);
    return res.end(JSON.stringify({ message: 'Image upload job initiated' }));
  }

  if (req.url === '/api/trigger-video' && req.method === 'POST') {
    logger.info('🎥 Manual video upload triggered via HTTP API');
    uploadVideoCronTask().catch(e => logger.error('HTTP trigger error:', e.message));
    res.writeHead(202);
    return res.end(JSON.stringify({ message: 'Video upload job initiated' }));
  }

  if (req.url === '/api/trigger-refresh' && req.method === 'POST') {
    logger.info('🔄 Manual token refresh triggered via HTTP API');
    refreshAllTokens().catch(e => logger.error('HTTP trigger error:', e.message));
    res.writeHead(202);
    return res.end(JSON.stringify({ message: 'Token refresh initiated' }));
  }

  res.writeHead(404);
  res.end(JSON.stringify({ error: 'Endpoint not found' }));
});

server.listen(PORT, () => {
  logger.info(`🌐 HTTP Health & API Server listening on port ${PORT}`);
});

