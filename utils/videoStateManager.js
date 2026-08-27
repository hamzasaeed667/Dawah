const fs = require('fs');
const path = require('path');
const logger = require('./logger');

const videoStateFilePath = path.resolve(__dirname, '../videoState.json');
const stateFilePath = path.resolve(__dirname, '../state.json');
const isServerless = !!(process.env.NETLIFY || process.env.LAMBDA_TASK_ROOT || process.env.VERCEL);
const tmpVideoStateFilePath = path.join('/tmp', 'videoState.json');
const tmpStateFilePath = path.join('/tmp', 'state.json');

const defaultVideoState = {
  currentVideoPage: 1,
  lastUpload: null,
  maxPage: 1446
};

function getVideoState() {
  try {
    if (isServerless && fs.existsSync(tmpVideoStateFilePath)) {
      const tmpData = fs.readFileSync(tmpVideoStateFilePath, 'utf-8');
      return JSON.parse(tmpData);
    }
    if (fs.existsSync(videoStateFilePath)) {
      const data = fs.readFileSync(videoStateFilePath, 'utf-8');
      return JSON.parse(data);
    }
    if (fs.existsSync(stateFilePath)) {
      const stateData = JSON.parse(fs.readFileSync(stateFilePath, 'utf-8'));
      if (stateData.currentVideoPage) {
        return {
          currentVideoPage: stateData.currentVideoPage,
          lastUpload: stateData.lastVideoUpload || stateData.lastUpload || null,
          maxPage: stateData.maxPage || 1446
        };
      }
    }
  } catch (err) {
    logger.error('Failed to read videoState.json, using default state:', err.message);
  }
  return { ...defaultVideoState };
}

function saveVideoState(state) {
  let saved = false;
  try {
    fs.writeFileSync(videoStateFilePath, JSON.stringify(state, null, 2), 'utf-8');
    logger.info(`Video state updated on disk: currentVideoPage=${state.currentVideoPage}, lastUpload=${state.lastUpload}`);
    saved = true;
  } catch (err) {
    logger.warn(`Could not write to ${videoStateFilePath} (${err.message}). Trying serverless tmp path...`);
  }

  if (!saved || isServerless) {
    try {
      fs.writeFileSync(tmpVideoStateFilePath, JSON.stringify(state, null, 2), 'utf-8');
      logger.info(`Video state updated in tmp disk: currentVideoPage=${state.currentVideoPage}`);
      saved = true;
    } catch (tmpErr) {
      logger.error('Failed to write to tmp video state file:', tmpErr.message);
    }
  }

  // Also sync currentVideoPage and lastVideoUpload into state.json
  try {
    let mainState = {};
    if (fs.existsSync(stateFilePath)) {
      mainState = JSON.parse(fs.readFileSync(stateFilePath, 'utf-8'));
    }
    mainState.currentVideoPage = state.currentVideoPage;
    if (state.lastUpload) mainState.lastVideoUpload = state.lastUpload;
    if (state.maxPage) mainState.maxPage = state.maxPage;
    fs.writeFileSync(stateFilePath, JSON.stringify(mainState, null, 2), 'utf-8');
  } catch (syncErr) {
    // Ignore read-only errors on local disk
  }

  if (isServerless) {
    try {
      let tmpMainState = {};
      if (fs.existsSync(tmpStateFilePath)) {
        tmpMainState = JSON.parse(fs.readFileSync(tmpStateFilePath, 'utf-8'));
      }
      tmpMainState.currentVideoPage = state.currentVideoPage;
      if (state.lastUpload) tmpMainState.lastVideoUpload = state.lastUpload;
      if (state.maxPage) tmpMainState.maxPage = state.maxPage;
      fs.writeFileSync(tmpStateFilePath, JSON.stringify(tmpMainState, null, 2), 'utf-8');
    } catch (tmpSyncErr) {}
  }
}

function advanceVideoPage() {
  const state = getVideoState();
  const maxPage = Number(state.maxPage) || 1446;
  const current = Number(state.currentVideoPage) || 1;
  const nextPage = (current >= maxPage || current < 1) ? 1 : current + 1;
  state.currentVideoPage = nextPage;
  state.maxPage = maxPage;
  state.lastUpload = new Date().toISOString();
  saveVideoState(state);
  return state;
}

module.exports = {
  getVideoState,
  saveVideoState,
  advanceVideoPage
};
