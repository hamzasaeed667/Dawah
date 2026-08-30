require('dotenv').config();
const express = require('express');
const uploadCronTask = require('./cron/uploadPage');
const uploadVideoCronTask = require('./cron/uploadVideo');
const { refreshAllTokens } = require('./cron/refreshTokens');
const { getState } = require('./utils/stateManager');
const { getVideoState } = require('./utils/videoStateManager');
const { loadTokensFromBlobs } = require('./utils/envUtils');
const platforms = require('./config/platforms');
const logger = require('./utils/logger');

// Hydrate tokens from Netlify Blobs on cold start (serverless only, no-op locally)
loadTokensFromBlobs().catch(err => logger.warn(`Token hydration skipped: ${err.message}`));


const app = express();
const router = express.Router();

const pkg = require('./package.json');
const APP_VERSION = pkg.version || '1.0.0';
const COMMIT_HASH = process.env.COMMIT_REF || process.env.DEPLOY_ID || process.env.GITHUB_SHA || 'local';
const DEPLOY_ENV = process.env.NETLIFY ? 'netlify-serverless' : (process.env.NODE_ENV || 'production');

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// --- 1. Server Status & Health Check API (Public) ---
router.get('/', async (req, res) => {
  const currentState = await getState();
  const currentVideoState = await getVideoState();
  const enabledPlatforms = Object.keys(platforms).filter(p => platforms[p]);

  return res.json({
    status: 'online',
    server: 'Dawah Social Media Automation Server (Express / Netlify)',
    version: APP_VERSION,
    commit: COMMIT_HASH ? COMMIT_HASH.substring(0, 7) : 'unknown',
    environment: DEPLOY_ENV,
    uptime_seconds: Math.floor(process.uptime()),
    content_progress: {
      images: {
        current_page: currentState.currentPage,
        total_pages: currentState.maxPage,
        last_upload: currentState.lastUpload || 'Never'
      },
      videos: {
        current_video_page: currentVideoState.currentVideoPage,
        total_pages: currentVideoState.maxPage,
        last_upload: currentVideoState.lastUpload || 'Never'
      }
    },
    active_platforms: enabledPlatforms,
    apis: {
      status: 'GET /status or GET /api',
      health: 'GET /health',
      uploads: 'GET/POST /api/trigger-uploads?secret=<CRON_SECRET>',
      refresh_tokens: 'GET/POST /api/refresh-tokens?secret=<CRON_SECRET>'
    },
    server_time: new Date().toISOString()
  });
});

router.get('/health', async (req, res) => {
  const currentState = await getState();
  const currentVideoState = await getVideoState();
  return res.json({
    status: 'online',
    version: APP_VERSION,
    commit: COMMIT_HASH ? COMMIT_HASH.substring(0, 7) : 'unknown',
    environment: DEPLOY_ENV,
    images: currentState,
    videos: currentVideoState,
    server_time: new Date().toISOString()
  });
});

// --- Authentication Middleware for Trigger Endpoints ---
function requireSecretAuth(req, res, next) {
  const requiredSecret = process.env.CRON_SECRET || 'dawah_secure_key_2026';
  const providedSecret = req.query.secret || 
                         req.headers['x-cron-secret'] || 
                         req.headers['authorization']?.replace(/^Bearer\s+/i, '');

  if (!providedSecret || providedSecret !== requiredSecret) {
    logger.warn(`🔒 Unauthorized API access attempt on ${req.originalUrl}`);
    return res.status(401).json({ error: 'Unauthorized: Invalid or missing cron secret' });
  }
  next();
}

// --- 2. UPLOADS API (Daily Image + Daily Video) ---
router.all('/trigger-uploads', requireSecretAuth, async (req, res) => {
  logger.info(`🚀 Daily Image + Video upload job triggered via HTTP ${req.method}`);
  
  try {
    const imageUploadResult = await uploadCronTask();
    let videoUploadResult = null;
    try {
      videoUploadResult = await uploadVideoCronTask();
    } catch (vErr) {
      logger.error('Video upload error:', vErr.message);
      videoUploadResult = { error: vErr.message };
    }

    return res.status(200).json({
      success: true,
      message: 'Uploads executed successfully',
      imageUpload: imageUploadResult,
      videoUpload: videoUploadResult
    });
  } catch (err) {
    logger.error('❌ Error executing upload batch:', err.message);
    return res.status(500).json({
      success: false,
      error: err.message
    });
  }
});

// --- 3. REFRESH TOKENS API (OAuth Maintenance) ---
router.all('/refresh-tokens', requireSecretAuth, async (req, res) => {
  logger.info(`🔄 Token refresh job triggered via HTTP ${req.method}`);

  try {
    await refreshAllTokens();
    logger.info('✅ Token refresh routine completed.');
    return res.status(200).json({
      success: true,
      message: 'Token refresh routine completed successfully'
    });
  } catch (e) {
    logger.error('❌ Token refresh HTTP trigger error:', e.message);
    return res.status(500).json({
      success: false,
      error: e.message
    });
  }
});

// Map routes for Netlify function pathing, direct /api pathing, and root pathing
app.use('/.netlify/functions/api', router);
app.use('/api', router);
app.use('/', router);

module.exports = app;

