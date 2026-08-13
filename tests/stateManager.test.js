const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const { getState, saveState, advancePage } = require('../utils/stateManager');

const stateFilePath = path.resolve(__dirname, '../state.json');

test('stateManager handles reading, updating, and advancing page state', () => {
  const originalData = fs.readFileSync(stateFilePath, 'utf-8');

  try {
    const initialState = getState();
    assert.ok(typeof initialState.currentPage === 'number');
    assert.strictEqual(initialState.maxPage, 455);

    // Save temporary state
    saveState({ currentPage: 10, lastUpload: '2026-08-11T00:00:00.000Z', maxPage: 455 });
    const updatedState = getState();
    assert.strictEqual(updatedState.currentPage, 10);

    // Advance page
    const nextState = advancePage();
    assert.strictEqual(nextState.currentPage, 11);
    assert.ok(nextState.lastUpload !== null);

    // Test page rollover at maxPage
    saveState({ currentPage: 455, lastUpload: null, maxPage: 455 });
    const rolloverState = advancePage();
    assert.strictEqual(rolloverState.currentPage, 1);
  } finally {
    // Restore original state file
    fs.writeFileSync(stateFilePath, originalData, 'utf-8');
  }
});
