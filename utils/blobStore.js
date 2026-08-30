/**
 * blobStore.js — Centralized Netlify Blobs helper for persistent state in serverless.
 *
 * Uses dynamic import() because @netlify/blobs is ESM-only and this project is CommonJS.
 * Gracefully returns null when not running in a Netlify environment (local / GitHub Actions),
 * so callers can fall back to disk I/O.
 */

const logger = require('./logger');

const isServerless = !!(process.env.NETLIFY || process.env.LAMBDA_TASK_ROOT);

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
 * Returns the store object, or null if not in serverless / unavailable.
 */
async function getStore(storeName) {
  const blobs = await getBlobsModule();
  if (!blobs) return null;
  try {
    return blobs.getStore({ name: storeName, consistency: 'strong' });
  } catch (err) {
    logger.warn(`[BlobStore] Failed to get store "${storeName}": ${err.message}`);
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
