/**
 * blobStore.js — Centralized Netlify Blobs helper for persistent state in serverless.
 *
 * Designed for CommonJS projects where @netlify/blobs is ESM.
 */

const logger = require('./logger');

const isServerless = Boolean(
  process.env.NETLIFY ||
  process.env.LAMBDA_TASK_ROOT ||
  process.env.AWS_LAMBDA_FUNCTION_NAME
);

let blobsModule;

async function getBlobsModule() {
  if (blobsModule !== undefined) {
    return blobsModule;
  }

  if (!isServerless) {
    blobsModule = null;
    return null;
  }

  try {
    blobsModule = await import('@netlify/blobs');
    return blobsModule;
  } catch (err) {
    logger.error(`[BlobStore] Failed to load @netlify/blobs: ${err.message}`);
    blobsModule = null;
    return null;
  }
}

async function getStore(storeName) {
  const blobs = await getBlobsModule();
  if (!blobs) {
    return null;
  }

  const siteID = process.env.NETLIFY_SITE_ID || process.env.SITE_ID;
  const token = process.env.NETLIFY_API_TOKEN;

  /*
   * If explicit credentials are provided (needed for Lambda compatibility / serverless-http mode),
   * use them. Otherwise, let Netlify's runtime context handle authentication automatically.
   */
  if (siteID && token) {
    try {
      return blobs.getStore({
        name: storeName,
        siteID,
        token,
        consistency: 'strong'
      });
    } catch (err) {
      logger.error(`[BlobStore] Failed to get store with explicit credentials: ${err.message}`);
    }
  }

  try {
    return blobs.getStore({
      name: storeName,
      consistency: 'strong'
    });
  } catch (err) {
    logger.error(`[BlobStore] Failed to get store with runtime context: ${err.message}`);
    return null;
  }
}

async function blobGet(storeName, key) {
  const store = await getStore(storeName);
  if (!store) {
    return null;
  }

  try {
    return await store.get(key, {
      type: 'json'
    });
  } catch (err) {
    logger.error(`[BlobStore] Failed to read "${key}" from "${storeName}": ${err.message}`);
    return null;
  }
}

async function blobSet(storeName, key, value) {
  const store = await getStore(storeName);
  if (!store) {
    return false;
  }

  try {
    await store.setJSON(key, value);
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

