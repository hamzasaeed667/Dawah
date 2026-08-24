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

  const parsedUrl = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
  const pathname = parsedUrl.pathname;
  const method = req.method;

  // Health check endpoint (Public, for uptime monitoring / ping)
  if (pathname === '/' || pathname === '/health') {
    const currentState = getState();
    const currentVideoState = getVideoState();
    res.writeHead(200);
    return res.end(JSON.stringify({
      status: 'online',
      message: 'Dawah Social Media Automation Server Active',
      imageState: currentState,
      videoState: currentVideoState,
      timestamp: new Date().toISOString(),
      endpoints: {
        upload: '/api/trigger-uploads (Uploads Daily Image & Video)',
        refreshTokens: '/api/refresh-tokens (Refreshes OAuth Tokens)'
      }
    }, null, 2));
  }

  // --- Strict Security Verification for API Endpoints ---
  const requiredSecret = process.env.CRON_SECRET || 'dawah-cron-secret-2026';
  const providedSecret = parsedUrl.searchParams.get('secret') || 
                         req.headers['x-cron-secret'] || 
                         req.headers['authorization']?.replace(/^Bearer\s+/i, '');

  if (!providedSecret || providedSecret !== requiredSecret) {
    logger.warn(`🔒 Unauthorized API access attempt from ${req.socket.remoteAddress} on ${pathname}`);
    res.writeHead(401);
    return res.end(JSON.stringify({ error: 'Unauthorized: Invalid or missing cron secret' }));
  }

  // ==========================================
  // 1. UPLOADS API (Daily Image + Daily Video)
  // ==========================================
  if (pathname === '/api/trigger-uploads' && (method === 'GET' || method === 'POST')) {
    logger.info(`🚀 Daily Image + Video upload job triggered via HTTP ${method}`);
    (async () => {
      try {
        await uploadCronTask();
        await uploadVideoCronTask();
        logger.info('🎉 Both Image and Video uploads completed successfully.');
      } catch (err) {
        logger.error('❌ Error executing upload batch:', err.message);
      }
    })();

    res.writeHead(200);
    return res.end(JSON.stringify({
      success: true,
      message: 'Image and Video upload jobs initiated successfully'
    }));
  }

  // ==========================================
  // 2. REFRESH TOKENS API (OAuth Maintenance)
  // ==========================================
  if (pathname === '/api/refresh-tokens' && (method === 'GET' || method === 'POST')) {
    logger.info(`🔄 Token refresh job triggered via HTTP ${method}`);
    refreshAllTokens()
      .then(() => logger.info('✅ Token refresh routine completed.'))
      .catch(e => logger.error('❌ Token refresh HTTP trigger error:', e.message));

    res.writeHead(200);
    return res.end(JSON.stringify({
      success: true,
      message: 'Token refresh routine initiated successfully'
    }));
  }

  res.writeHead(404);
  res.end(JSON.stringify({ error: 'Endpoint not found' }));
});

server.listen(PORT, () => {
  logger.info(`🌐 HTTP Health & API Server listening on port ${PORT}`);
});

