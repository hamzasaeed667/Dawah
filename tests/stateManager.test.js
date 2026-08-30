const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const { getState, saveState, advancePage } = require('../utils/stateManager');

const stateFilePath = path.resolve(__dirname, '../state.json');

test('stateManager handles reading, updating, and advancing page state', async () => {
  const originalData = fs.readFileSync(stateFilePath, 'utf-8');

  try {
    const initialState = await getState();
    assert.ok(typeof initialState.currentPage === 'number');
    assert.strictEqual(initialState.maxPage, 1446);

    // Save temporary state
    await saveState({ currentPage: 10, lastUpload: '2026-08-11T00:00:00.000Z', maxPage: 1446 });
    const updatedState = await getState();
    assert.strictEqual(updatedState.currentPage, 10);

    // Advance page
    const nextState = await advancePage();
    assert.strictEqual(nextState.currentPage, 11);
    assert.ok(nextState.lastUpload !== null);

    // Test page rollover at maxPage
    await saveState({ currentPage: 1446, lastUpload: null, maxPage: 1446 });
    const rolloverState = await advancePage();
    assert.strictEqual(rolloverState.currentPage, 1);
  } finally {
    // Restore original state file
    fs.writeFileSync(stateFilePath, originalData, 'utf-8');
  }
});
