const fs = require('fs');
const path = require('path');
const logger = require('./logger');

const videoStateFilePath = path.resolve(__dirname, '../videoState.json');

const defaultVideoState = {
  currentVideoPage: 1,
  lastUpload: null,
  maxPage: 1446
};

function getVideoState() {
  try {
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
  try {
    fs.writeFileSync(videoStateFilePath, JSON.stringify(state, null, 2), 'utf-8');
    logger.info(`Video state updated: currentVideoPage=${state.currentVideoPage}, lastUpload=${state.lastUpload}`);
  } catch (err) {
    logger.error('Failed to write videoState.json:', err.message);
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
