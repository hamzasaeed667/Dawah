const fs = require('fs');
const path = require('path');
const logger = require('./logger');

const stateFilePath = path.resolve(__dirname, '../state.json');
const isServerless = !!(process.env.NETLIFY || process.env.LAMBDA_TASK_ROOT || process.env.VERCEL);
const tmpStateFilePath = path.join('/tmp', 'state.json');

const defaultState = {
  currentPage: 1,
  currentVideoPage: 1,
  lastUpload: null,
  lastVideoUpload: null,
  maxPage: 1446
};

function getState() {
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
    logger.error('Failed to read state.json, using default state:', err.message);
  }
  return { ...defaultState };
}

function saveState(newState) {
  const currentState = getState();
  const merged = { ...currentState, ...newState };

  let saved = false;
  try {
    fs.writeFileSync(stateFilePath, JSON.stringify(merged, null, 2), 'utf-8');
    logger.info(`State updated on disk: currentPage=${merged.currentPage}, lastUpload=${merged.lastUpload}`);
    saved = true;
  } catch (err) {
    logger.warn(`Could not write to ${stateFilePath} (${err.message}). Trying serverless tmp path...`);
  }

  if (!saved || isServerless) {
    try {
      fs.writeFileSync(tmpStateFilePath, JSON.stringify(merged, null, 2), 'utf-8');
      logger.info(`State updated in tmp disk: currentPage=${merged.currentPage}`);
      saved = true;
    } catch (tmpErr) {
      logger.error('Failed to write to tmp state file:', tmpErr.message);
    }
  }
}

function advancePage() {
  const state = getState();
  const maxPage = Number(state.maxPage) || 1446;
  const current = Number(state.currentPage) || 1;
  const nextPage = (current >= maxPage || current < 1) ? 1 : current + 1;
  state.currentPage = nextPage;
  state.maxPage = maxPage;
  state.lastUpload = new Date().toISOString();
  saveState(state);
  return state;
}

module.exports = {
  getState,
  saveState,
  advancePage
};
