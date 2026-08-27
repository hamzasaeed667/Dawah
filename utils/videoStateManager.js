const fs = require('fs');
const path = require('path');
const logger = require('./logger');

const videoStateFilePath = path.resolve(__dirname, '../videoState.json');
const isServerless = !!(process.env.NETLIFY || process.env.LAMBDA_TASK_ROOT || process.env.VERCEL);
const tmpVideoStateFilePath = path.join('/tmp', 'videoState.json');

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
