const fs = require('fs');
const path = require('path');
const logger = require('./logger');

const stateFilePath = path.resolve(__dirname, '../state.json');

const defaultState = {
  currentPage: 1,
  lastUpload: null,
  maxPage: 1446
};

function getState() {
  try {
    if (fs.existsSync(stateFilePath)) {
      const data = fs.readFileSync(stateFilePath, 'utf-8');
      return JSON.parse(data);
    }
  } catch (err) {
    logger.error('Failed to read state.json, using default state:', err.message);
  }
  return { ...defaultState };
}

function saveState(state) {
  try {
    fs.writeFileSync(stateFilePath, JSON.stringify(state, null, 2), 'utf-8');
    logger.info(`State updated: currentPage=${state.currentPage}, lastUpload=${state.lastUpload}`);
  } catch (err) {
    logger.error('Failed to write state.json:', err.message);
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
