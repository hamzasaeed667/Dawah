const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const { getVideoState, saveVideoState, advanceVideoPage } = require('../utils/videoStateManager');

const videoStateFilePath = path.resolve(__dirname, '../videoState.json');

test('videoStateManager handles reading, updating, and advancing video page state', async () => {
  let originalData = null;
  if (fs.existsSync(videoStateFilePath)) {
    originalData = fs.readFileSync(videoStateFilePath, 'utf-8');
  }

  const stateFilePath = path.resolve(__dirname, '../state.json');
  let originalStateData = null;
  if (fs.existsSync(stateFilePath)) {
    originalStateData = fs.readFileSync(stateFilePath, 'utf-8');
  }

  try {
    const initialState = await getVideoState();
    assert.ok(typeof initialState.currentVideoPage === 'number');
    assert.strictEqual(initialState.maxPage, 1446);

    // Save temporary state
    await saveVideoState({ currentVideoPage: 5, lastUpload: '2026-08-11T00:00:00.000Z', maxPage: 1446 });
    const updatedState = await getVideoState();
    assert.strictEqual(updatedState.currentVideoPage, 5);

    // Advance video page
    const nextState = await advanceVideoPage();
    assert.strictEqual(nextState.currentVideoPage, 6);
    assert.ok(nextState.lastUpload !== null);

    // Test video page rollover at maxPage
    await saveVideoState({ currentVideoPage: 1446, lastUpload: null, maxPage: 1446 });
    const rolloverState = await advanceVideoPage();
    assert.strictEqual(rolloverState.currentVideoPage, 1);
  } finally {
    if (originalData) {
      fs.writeFileSync(videoStateFilePath, originalData, 'utf-8');
    }
    if (originalStateData) {
      fs.writeFileSync(stateFilePath, originalStateData, 'utf-8');
    }
  }
});
