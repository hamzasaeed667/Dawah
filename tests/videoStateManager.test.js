const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const { getVideoState, saveVideoState, advanceVideoPage } = require('../utils/videoStateManager');

const videoStateFilePath = path.resolve(__dirname, '../videoState.json');

test('videoStateManager handles reading, updating, and advancing video page state', () => {
  let originalData = null;
  if (fs.existsSync(videoStateFilePath)) {
    originalData = fs.readFileSync(videoStateFilePath, 'utf-8');
  }

  try {
    const initialState = getVideoState();
    assert.ok(typeof initialState.currentVideoPage === 'number');
    assert.strictEqual(initialState.maxPage, 455);

    // Save temporary state
    saveVideoState({ currentVideoPage: 5, lastUpload: '2026-08-11T00:00:00.000Z', maxPage: 455 });
    const updatedState = getVideoState();
    assert.strictEqual(updatedState.currentVideoPage, 5);

    // Advance video page
    const nextState = advanceVideoPage();
    assert.strictEqual(nextState.currentVideoPage, 6);
    assert.ok(nextState.lastUpload !== null);

    // Test video page rollover at maxPage
    saveVideoState({ currentVideoPage: 455, lastUpload: null, maxPage: 455 });
    const rolloverState = advanceVideoPage();
    assert.strictEqual(rolloverState.currentVideoPage, 1);
  } finally {
    if (originalData) {
      fs.writeFileSync(videoStateFilePath, originalData, 'utf-8');
    }
  }
});
