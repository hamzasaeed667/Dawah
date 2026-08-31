/**
 * blobStore.js — Centralized Netlify Blobs helper for persistent state in serverless.
 *
 * Uses dynamic import() because @netlify/blobs is ESM-only and this project is CommonJS.
 * 
 * In Lambda compatibility mode (serverless-http), the NETLIFY_BLOBS_CONTEXT env var
 * is NOT auto-injected, so we must provide explicit siteID + token to getStore().
 * 
 * Required env vars in Netlify Dashboard:
 *   NETLIFY_API_TOKEN  — Personal access token from https://app.netlify.com/user/applications#personal-access-tokens
 *   SITE_ID            — Auto-set by Netlify, but can be manually set if needed
 *
 * Gracefully returns null when credentials are missing or not in serverless,
 * so callers fall back to disk I/O.
 */

const logger = require('./logger');

const isServerless = !!(process.env.NETLIFY || process.env.LAMBDA_TASK_ROOT || process.env.AWS_LAMBDA_FUNCTION_NAME);

// Cache the import so we only resolve once per cold start
let _blobsModule = null;

/**
 * Lazily import @netlify/blobs (ESM) from CommonJS.
 * Returns the module, or null if unavailable.
 */
async function getBlobsModule() {
  if (_blobsModule !== undefined && _blobsModule !== null) return _blobsModule;
  if (!isServerless) {
    _blobsModule = null;
    return null;
  }
  try {
    _blobsModule = await import('@netlify/blobs');
    return _blobsModule;
  } catch (err) {
    logger.warn(`[BlobStore] Could not load @netlify/blobs: ${err.message}`);
    _blobsModule = null;
    return null;
  }
}

/**
 * Get a named Netlify Blobs store with strong consistency.
 * 
 * Tries auto-detection first (works in Netlify Functions v2).
 * Falls back to explicit siteID + token for Lambda compat mode (serverless-http).
 * 
 * Returns the store object, or null if unavailable.
 */
async function getStore(storeName) {
  const blobs = await getBlobsModule();
  if (!blobs) return null;

  // Try 1: Auto-detection (works if NETLIFY_BLOBS_CONTEXT is injected)
  try {
    return blobs.getStore({ name: storeName, consistency: 'strong' });
  } catch (autoErr) {
    logger.info(`[BlobStore] Auto-detection failed (${autoErr.message}), trying explicit credentials...`);
  }

  // Try 2: Explicit credentials for Lambda compat mode
  const siteID = process.env.SITE_ID || process.env.NETLIFY_SITE_ID;
  const token = process.env.NETLIFY_API_TOKEN;

  if (!siteID || !token) {
    logger.warn(`[BlobStore] Cannot create store "${storeName}": missing SITE_ID or NETLIFY_API_TOKEN env vars. ` +
      `Set NETLIFY_API_TOKEN in your Netlify Dashboard → Site configuration → Environment variables.`);
    return null;
  }

  try {
    return blobs.getStore({
      name: storeName,
      siteID,
      token,
      consistency: 'strong'
    });
  } catch (err) {
    logger.error(`[BlobStore] Failed to get store "${storeName}" with explicit credentials: ${err.message}`);
    return null;
  }
}

/**
 * Read a JSON value from a Netlify Blob store.
 * @param {string} storeName - The store name (e.g. 'dawah-state')
 * @param {string} key - The key to read
 * @returns {object|null} Parsed JSON, or null if unavailable / not found
 */
async function blobGet(storeName, key) {
  const store = await getStore(storeName);
  if (!store) return null;
  try {
    const raw = await store.get(key);
    if (!raw) return null;
    return JSON.parse(raw);
  } catch (err) {
    logger.warn(`[BlobStore] Failed to read "${key}" from "${storeName}": ${err.message}`);
    return null;
  }
}

/**
 * Write a JSON value to a Netlify Blob store.
 * @param {string} storeName - The store name
 * @param {string} key - The key to write
 * @param {object} value - The value (will be JSON-stringified)
 * @returns {boolean} true if written successfully
 */
async function blobSet(storeName, key, value) {
  const store = await getStore(storeName);
  if (!store) return false;
  try {
    await store.set(key, JSON.stringify(value));
    logger.info(`[BlobStore] Saved "${key}" to "${storeName}"`);
    return true;
  } catch (err) {
    logger.error(`[BlobStore] Failed to write "${key}" to "${storeName}": ${err.message}`);
    return false;
  }
}

module.exports = {
  isServerless,
  blobGet,
  blobSet
};
