const fs = require('fs');
const path = require('path');
require('dotenv').config();
const axios = require('axios');
const { updateEnv, updateEnvMultiple } = require('../utils/envUtils');
const logger = require('../utils/logger');

const isServerless = !!(process.env.NETLIFY || process.env.LAMBDA_TASK_ROOT || process.env.VERCEL);
const LOCK_FILE = isServerless ? path.join('/tmp', '.threads_refresh.lock') : path.resolve(__dirname, '../.threads_refresh.lock');
const LOCK_TTL_MS = 5 * 60 * 1000; // 5 minutes

function acquireLock() {
  try {
    if (fs.existsSync(LOCK_FILE)) {
      const stats = fs.statSync(LOCK_FILE);
      if (Date.now() - stats.mtimeMs < LOCK_TTL_MS) {
        return false; // Lock active
      }
      fs.unlinkSync(LOCK_FILE); // Remove stale lock
    }
    fs.writeFileSync(LOCK_FILE, JSON.stringify({ pid: process.pid, time: new Date().toISOString() }));
    return true;
  } catch (err) {
    return false;
  }
}

function releaseLock() {
  try {
    if (fs.existsSync(LOCK_FILE)) {
      fs.unlinkSync(LOCK_FILE);
    }
  } catch (err) {
    // Ignore lock cleanup errors
  }
}

const FB_LOCK_FILE = isServerless ? path.join('/tmp', '.fb_refresh.lock') : path.resolve(__dirname, '../.fb_refresh.lock');


function acquireFbLock() {
  try {
    if (fs.existsSync(FB_LOCK_FILE)) {
      const stats = fs.statSync(FB_LOCK_FILE);
      if (Date.now() - stats.mtimeMs < LOCK_TTL_MS) {
        return false; // Lock active
      }
      fs.unlinkSync(FB_LOCK_FILE);
    }
    fs.writeFileSync(FB_LOCK_FILE, JSON.stringify({ pid: process.pid, time: new Date().toISOString() }));
    return true;
  } catch (err) {
    return false;
  }
}

function releaseFbLock() {
  try {
    if (fs.existsSync(FB_LOCK_FILE)) {
      fs.unlinkSync(FB_LOCK_FILE);
    }
  } catch (err) { }
}

/**
 * Refreshes Facebook Long-Lived User Token (Production Grade Maintenance)
 */
async function refreshFacebookToken(options = {}) {
  const force = options.force || false;

  if (!acquireFbLock()) {
    logger.warn('[FacebookTokenRefresh] Integration: dawah | Action: SKIP | Reason: Process lock active.');
    return;
  }

  try {
    const token = process.env.FB_LONG_LIVED_USER_TOKEN;
    const appId = process.env.FB_APP_ID || process.env.Instagram_app_ID || process.env.THREADS_APP_ID;
    const appSecret = process.env.FB_APP_SECRET || process.env.Instagram_SECRET || process.env.THREADS_APP_SECRET;
    const expiresAt = process.env.FB_TOKEN_EXPIRES_AT;
    const status = process.env.FB_TOKEN_STATUS || 'ACTIVE';

    if (!token || !appId || !appSecret) {
      updateEnvMultiple({ FB_TOKEN_STATUS: 'METADATA_MISSING' });
      logger.warn('[FacebookTokenRefresh] Integration: dawah | Action: SKIP | Status: METADATA_MISSING | Error: FB_LONG_LIVED_USER_TOKEN, FB_APP_ID, or FB_APP_SECRET missing in .env.');
      return;
    }

    const now = new Date();

    if (!force) {
      if (!expiresAt) {
        logger.warn('[FacebookTokenRefresh] Integration: dawah | Status: METADATA_MISSING | Action: REFRESH (Attempting initial refresh to set expiration metadata).');
      } else {
        const expiresDate = new Date(expiresAt);
        const remainingMs = expiresDate.getTime() - now.getTime();
        const remainingDays = Math.floor(remainingMs / (1000 * 60 * 60 * 24));

        if (remainingMs <= 0 || status === 'REAUTH_REQUIRED') {
          updateEnvMultiple({ FB_TOKEN_STATUS: 'REAUTH_REQUIRED' });
          logger.error(`[FacebookTokenRefresh] Integration: dawah | Action: SKIP | Status: REAUTH_REQUIRED | Error: Token expired on ${expiresAt}. Manual re-authorization required.`);
          return;
        }

        if (remainingDays > 14) {
          logger.info(`[FacebookTokenRefresh] Integration: dawah | Token expires: ${expiresAt.split('T')[0]} | Remaining: ${remainingDays} days | Action: SKIP`);
          return;
        }

        if (remainingDays <= 3) {
          logger.warn(`⚠️ HIGH PRIORITY: [FacebookTokenRefresh] Integration: dawah | Token expiring in ${remainingDays} days!`);
        }
      }
    } else {
      logger.info('[FacebookTokenRefresh] Integration: dawah | Action: FORCED_REFRESH | Bypassing remaining days check...');
    }

    // Set transient REFRESHING status
    updateEnvMultiple({ FB_TOKEN_STATUS: 'REFRESHING' });
    logger.info('[FacebookTokenRefresh] Integration: dawah | Action: REFRESH | Contacting Meta Graph API...');

    try {
      const res = await axios.get('https://graph.facebook.com/v18.0/oauth/access_token', {
        params: {
          grant_type: 'fb_exchange_token',
          client_id: appId,
          client_secret: appSecret,
          fb_exchange_token: token
        },
        timeout: 15000
      });

      if (res.data?.access_token) {
        const newToken = res.data.access_token;
        const expiresIn = res.data.expires_in || 5184000; // seconds returned by Meta (~60 days)
        const newExpiresAt = new Date(now.getTime() + expiresIn * 1000).toISOString();

        updateEnvMultiple({
          FB_LONG_LIVED_USER_TOKEN: newToken,
          FB_TOKEN_EXPIRES_AT: newExpiresAt,
          FB_TOKEN_UPDATED_AT: now.toISOString(),
          FB_LAST_REFRESH_AT: now.toISOString(),
          FB_TOKEN_STATUS: 'ACTIVE',
          FB_LAST_REFRESH_ERROR: ''
        });

        logger.info(`[FacebookTokenRefresh] Integration: dawah | Action: REFRESH | Result: SUCCESS | New expiry: ${newExpiresAt.split('T')[0]}`);
      } else {
        throw new Error('Meta API response missing access_token field.');
      }
    } catch (err) {
      const httpStatus = err.response?.status || 'N/A';
      const metaErrCode = err.response?.data?.error?.code || 'N/A';
      const metaErrMsg = err.response?.data?.error?.message || err.message;
      const fullErrStr = `HTTP ${httpStatus} | Meta Error Code ${metaErrCode}: ${metaErrMsg}`;

      const isRevoked = metaErrCode === 190 || metaErrCode === 102 || metaErrCode === 101 || String(metaErrMsg).includes('expired') || String(metaErrMsg).includes('invalid');
      const newStatus = isRevoked ? 'REAUTH_REQUIRED' : 'REFRESH_FAILED';

      updateEnvMultiple({
        FB_TOKEN_STATUS: newStatus,
        FB_LAST_REFRESH_AT: now.toISOString(),
        FB_LAST_REFRESH_ERROR: fullErrStr
      });

      logger.error(`[FacebookTokenRefresh] Integration: dawah | Action: REFRESH | Result: FAILED | Status: ${newStatus} | Meta error: ${fullErrStr}`);
    }
  } finally {
    releaseFbLock();
  }
}

/**
 * Refreshes LinkedIn Access Token using Refresh Token
 */
async function refreshLinkedInToken() {
  const refreshToken = process.env.LINKEDIN_REFRESH_TOKEN;
  const clientId = process.env.LINKEDIN_CLIENT_ID || '78x1h5ac08ju9b';
  const clientSecret = process.env.LINKEDIN_CLIENT_SECRET;

  if (!refreshToken) {
    logger.warn('[LinkedIn Refresh] No LINKEDIN_REFRESH_TOKEN found in .env to auto-renew.');
    return;
  }

  try {
    const endpoint = 'https://www.linkedin.com/oauth/v2/accessToken';
    const params = new URLSearchParams({
      grant_type: 'refresh_token',
      refresh_token: refreshToken,
      client_id: clientId,
      client_secret: clientSecret
    });

    const res = await axios.post(endpoint, params.toString(), {
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' }
    });

    if (res.data?.access_token) {
      updateEnv('LINKEDIN_ACCESS_TOKEN', res.data.access_token);
      if (res.data.refresh_token) {
        updateEnv('LINKEDIN_REFRESH_TOKEN', res.data.refresh_token);
      }
      logger.info('🔄 Refreshed LinkedIn access token successfully.');
    }
  } catch (err) {
    logger.error('❌ LinkedIn token refresh failed:', err.response?.data || err.message);
  }
}

/**
 * Refreshes Threads Long-Lived Token (Production Grade Maintenance)
 */
async function refreshThreadsToken(options = {}) {
  const force = options.force || false;

  if (!acquireLock()) {
    logger.warn('[ThreadsTokenRefresh] Integration: dawah | Action: SKIP | Reason: Process lock active (another refresh worker is running).');
    return;
  }

  try {
    const token = process.env.THREADS_ACCESS_TOKEN;
    const expiresAt = process.env.THREADS_TOKEN_EXPIRES_AT;
    const status = process.env.THREADS_TOKEN_STATUS || 'ACTIVE';

    if (!token) {
      updateEnvMultiple({ THREADS_TOKEN_STATUS: 'METADATA_MISSING' });
      logger.warn('[ThreadsTokenRefresh] Integration: dawah | Action: SKIP | Status: METADATA_MISSING | Error: THREADS_ACCESS_TOKEN not set.');
      return;
    }

    const now = new Date();

    if (!force) {
      if (!expiresAt) {
        logger.warn('[ThreadsTokenRefresh] Integration: dawah | Status: METADATA_MISSING | Action: REFRESH (Attempting initial refresh to set expiration metadata).');
      } else {
        const expiresDate = new Date(expiresAt);
        const remainingMs = expiresDate.getTime() - now.getTime();
        const remainingDays = Math.floor(remainingMs / (1000 * 60 * 60 * 24));

        if (remainingMs <= 0 || status === 'REAUTH_REQUIRED') {
          updateEnvMultiple({ THREADS_TOKEN_STATUS: 'REAUTH_REQUIRED' });
          logger.error(`[ThreadsTokenRefresh] Integration: dawah | Action: SKIP | Status: REAUTH_REQUIRED | Error: Token expired on ${expiresAt}. Manual re-authorization required.`);
          return;
        }

        if (remainingDays > 14) {
          logger.info(`[ThreadsTokenRefresh] Integration: dawah | Token expires: ${expiresAt.split('T')[0]} | Remaining: ${remainingDays} days | Action: SKIP`);
          return;
        }

        if (remainingDays <= 3) {
          logger.warn(`⚠️ HIGH PRIORITY: [ThreadsTokenRefresh] Integration: dawah | Token expiring in ${remainingDays} days!`);
        }
      }
    } else {
      logger.info('[ThreadsTokenRefresh] Integration: dawah | Action: FORCED_REFRESH | Bypassing remaining days check...');
    }

    // Set transient REFRESHING status
    updateEnvMultiple({ THREADS_TOKEN_STATUS: 'REFRESHING' });
    logger.info('[ThreadsTokenRefresh] Integration: dawah | Action: REFRESH | Contacting Meta API...');

    try {
      const res = await axios.get('https://graph.threads.net/refresh_access_token', {
        params: {
          grant_type: 'th_refresh_token',
          access_token: token
        },
        timeout: 15000
      });

      if (res.data?.access_token) {
        const newToken = res.data.access_token;
        const expiresIn = res.data.expires_in || 5184000; // seconds returned by Meta
        const newExpiresAt = new Date(now.getTime() + expiresIn * 1000).toISOString();

        updateEnvMultiple({
          THREADS_ACCESS_TOKEN: newToken,
          THREADS_TOKEN_EXPIRES_AT: newExpiresAt,
          THREADS_TOKEN_UPDATED_AT: now.toISOString(),
          THREADS_LAST_REFRESH_AT: now.toISOString(),
          THREADS_TOKEN_STATUS: 'ACTIVE',
          THREADS_LAST_REFRESH_ERROR: ''
        });

        logger.info(`[ThreadsTokenRefresh] Integration: dawah | Action: REFRESH | Result: SUCCESS | New expiry: ${newExpiresAt.split('T')[0]}`);
      } else {
        throw new Error('Meta API response missing access_token field.');
      }
    } catch (err) {
      const httpStatus = err.response?.status || 'N/A';
      const metaErrCode = err.response?.data?.error?.code || 'N/A';
      const metaErrMsg = err.response?.data?.error?.message || err.message;
      const fullErrStr = `HTTP ${httpStatus} | Meta Error Code ${metaErrCode}: ${metaErrMsg}`;

      const isRevoked = metaErrCode === 190 || metaErrCode === 100 || String(metaErrMsg).includes('expired') || String(metaErrMsg).includes('invalid');
      const newStatus = isRevoked ? 'REAUTH_REQUIRED' : 'REFRESH_FAILED';

      updateEnvMultiple({
        THREADS_TOKEN_STATUS: newStatus,
        THREADS_LAST_REFRESH_AT: now.toISOString(),
        THREADS_LAST_REFRESH_ERROR: fullErrStr
      });

      logger.error(`[ThreadsTokenRefresh] Integration: dawah | Action: REFRESH | Result: FAILED | Status: ${newStatus} | Meta error: ${fullErrStr}`);
    }
  } finally {
    releaseLock();
  }
}

/**
 * Refreshes TikTok Access Token using Refresh Token
 */
async function refreshTikTokToken(options = {}) {
  const clientKey = process.env.TIKTOK_CLIENT_KEY;
  const clientSecret = process.env.TIKTOK_CLIENT_SECRET;
  const refreshToken = process.env.TIKTOK_REFRESH_TOKEN;

  if (!refreshToken || !clientKey || !clientSecret) {
    logger.warn('[TikTok Refresh] TikTok credentials missing in .env to auto-renew.');
    return;
  }

  logger.info('[TikTok Refresh] Attempting automatic background TikTok token refresh...');
  const now = new Date();

  try {
    const res = await axios.post(
      'https://open.tiktokapis.com/v2/oauth/token/',
      new URLSearchParams({
        client_key: clientKey,
        client_secret: clientSecret,
        grant_type: 'refresh_token',
        refresh_token: refreshToken
      }).toString(),
      { headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, timeout: 15000 }
    );

    const data = res.data;
    const newAccessToken = data.access_token || data.data?.access_token;
    const newRefreshToken = data.refresh_token || data.data?.refresh_token;
    const expiresIn = data.expires_in || data.data?.expires_in || 86400; // default 24h

    if (newAccessToken) {
      const newExpiresAt = new Date(now.getTime() + expiresIn * 1000).toISOString();
      const updates = {
        TIKTOK_ACCESS_TOKEN: newAccessToken,
        TIKTOK_TOKEN_EXPIRES_AT: newExpiresAt,
        TIKTOK_TOKEN_UPDATED_AT: now.toISOString(),
        TIKTOK_LAST_REFRESH_AT: now.toISOString(),
        TIKTOK_TOKEN_STATUS: 'ACTIVE'
      };

      if (newRefreshToken) {
        updates.TIKTOK_REFRESH_TOKEN = newRefreshToken;
        process.env.TIKTOK_REFRESH_TOKEN = newRefreshToken;
      }

      process.env.TIKTOK_ACCESS_TOKEN = newAccessToken;
      updateEnvMultiple(updates);

      logger.info(`🔄 Refreshed TikTok access token successfully! New expiry: ${newExpiresAt}`);
    } else {
      logger.error('❌ TikTok token refresh failed: missing access_token in response.');
    }
  } catch (err) {
    const errorMsg = err.response?.data || err.message;
    logger.error(`❌ TikTok token refresh error: ${JSON.stringify(errorMsg)}`);
  }
}

async function refreshAllTokens(options = {}) {
  logger.info('🔄 Running background token refresh task...');
  if (process.env.FB_LONG_LIVED_USER_TOKEN) {
    await refreshFacebookToken(options);
  }
  if (process.env.LINKEDIN_REFRESH_TOKEN) {
    await refreshLinkedInToken(options);
  }
  if (process.env.THREADS_ACCESS_TOKEN) {
    await refreshThreadsToken(options);
  }
  if (process.env.TIKTOK_REFRESH_TOKEN) {
    await refreshTikTokToken();
  }
}

module.exports = {
  refreshFacebookToken,
  refreshLinkedInToken,
  refreshThreadsToken,
  refreshTikTokToken,
  refreshAllTokens
};



