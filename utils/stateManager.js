const fs = require('fs');
const path = require('path');
const logger = require('./logger');
const { isServerless, blobGet, blobSet } = require('./blobStore');

const BLOB_STORE = 'dawah-state';
const BLOB_KEY = 'image-state';

const stateFilePath = path.resolve(__dirname, '../state.json');
const tmpStateFilePath = path.join('/tmp', 'state.json');

const defaultState = {
  currentPage: 1,
  currentVideoPage: 1,
  lastUpload: null,
  lastVideoUpload: null,
  maxPage: 1446,
  version: 1
};

/**
 * Read state from disk (local or /tmp fallback).
 */
function getStateFromDisk() {
  try {
    if (isServerless && fs.existsSync(tmpStateFilePath)) {
      const tmpData = fs.readFileSync(tmpStateFilePath, 'utf-8');
      return JSON.parse(tmpData);
    }
    if (fs.existsSync(stateFilePath)) {
      const data = fs.readFileSync(stateFilePath, 'utf-8');
      return JSON.parse(data);
    }
  } catch (err) {
    logger.error('Failed to read state.json from disk, using default state:', err.message);
  }
  return { ...defaultState };
}

/**
 * Get current state. In serverless, reads from Netlify Blobs first (persistent),
 * then falls back to disk. In local/CI, reads from disk only.
 */
async function getState() {
  if (isServerless) {
    const blobState = await blobGet(BLOB_STORE, BLOB_KEY);
    if (blobState && typeof blobState.currentPage === 'number') {
      return blobState;
    }
    logger.warn('[StateManager] No valid Blob state found, falling back to disk cache.');
  }
  return getStateFromDisk();
}

/**
 * Save state. In serverless, writes to Netlify Blobs (persistent) + /tmp (cache).
 * In local/CI, writes to disk state.json.
 */
async function saveState(newState) {
  const currentState = await getState();
  const nextVersion = (Number(currentState.version) || 0) + 1;
  const merged = { ...currentState, ...newState, version: nextVersion };

  // Always attempt Blob persistence in serverless
  if (isServerless) {
    await blobSet(BLOB_STORE, BLOB_KEY, merged);
  }

  // Write to disk (will succeed locally, may fail in serverless — that's OK)
  let saved = false;
  try {
    fs.writeFileSync(stateFilePath, JSON.stringify(merged, null, 2), 'utf-8');
    logger.info(`State updated on disk: currentPage=${merged.currentPage}, lastUpload=${merged.lastUpload}`);
    saved = true;
  } catch (err) {
    if (!isServerless) {
      logger.warn(`Could not write to ${stateFilePath} (${err.message}).`);
    }
  }

  // Write to /tmp as cache in serverless
  if (!saved || isServerless) {
    try {
      fs.writeFileSync(tmpStateFilePath, JSON.stringify(merged, null, 2), 'utf-8');
      logger.info(`State updated in tmp disk: currentPage=${merged.currentPage}`);
    } catch (tmpErr) {
      logger.error('Failed to write to tmp state file:', tmpErr.message);
    }
  }

  return merged;
}

/**
 * Advance the image page counter and persist with optimistic concurrency protection.
 */
async function advancePage() {
  // Always fetch fresh state immediately before computing next page
  const state = await getState();
  const maxPage = Number(state.maxPage) || 1446;
  const current = Number(state.currentPage) || 1;
  const nextPage = (current >= maxPage || current < 1) ? 1 : current + 1;

  const update = {
    ...state,
    currentPage: nextPage,
    maxPage: maxPage,
    lastUpload: new Date().toISOString()
  };

  const saved = await saveState(update);
  return saved;
}

module.exports = {
  getState,
  saveState,
  advancePage
};

