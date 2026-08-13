const test = require('node:test');
const assert = require('node:assert');
const { retry } = require('../utils/retry');

test('retry resolves on first successful call', async () => {
  let calls = 0;
  const fn = async () => {
    calls++;
    return 'success';
  };

  const result = await retry(fn, 3, 10);
  assert.strictEqual(result, 'success');
  assert.strictEqual(calls, 1);
});

test('retry retries on failure and resolves when subsequent attempt succeeds', async () => {
  let calls = 0;
  const fn = async () => {
    calls++;
    if (calls < 2) {
      throw new Error('Temporary network glitch');
    }
    return 'recovered';
  };

  const result = await retry(fn, 3, 10);
  assert.strictEqual(result, 'recovered');
  assert.strictEqual(calls, 2);
});

test('retry throws final error when all max retries fail', async () => {
  let calls = 0;
  const fn = async () => {
    calls++;
    throw new Error('Persistent failure');
  };

  await assert.rejects(async () => {
    await retry(fn, 2, 10);
  }, {
    name: 'Error',
    message: 'Persistent failure'
  });

  assert.strictEqual(calls, 2);
});
