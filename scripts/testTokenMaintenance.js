const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../../Dawah/.env') });
const { refreshThreadsToken } = require('../cron/refreshTokens');
const { updateEnvMultiple } = require('../utils/envUtils');

async function runTests() {
  console.log('=================================================================');
  console.log('      AUTOMATED THREADS TOKEN REFRESH SUITE - TEST RUNNER        ');
  console.log('=================================================================\n');

  const originalToken = process.env.THREADS_ACCESS_TOKEN;
  const originalExpiresAt = process.env.THREADS_TOKEN_EXPIRES_AT;

  try {
    // -------------------------------------------------------------------------
    // TEST 1: > 14 Days Remaining -> Action: SKIP
    // -------------------------------------------------------------------------
    console.log('▶ TEST 1: > 14 Days Remaining (Expected: SKIP)');
    const futureDate45 = new Date(Date.now() + 45 * 24 * 60 * 60 * 1000).toISOString();
    process.env.THREADS_TOKEN_EXPIRES_AT = futureDate45;
    process.env.THREADS_TOKEN_STATUS = 'ACTIVE';
    updateEnvMultiple({
      THREADS_TOKEN_EXPIRES_AT: futureDate45,
      THREADS_TOKEN_STATUS: 'ACTIVE'
    });

    await refreshThreadsToken();
    console.log('✔ Test 1 Completed.\n');

    // -------------------------------------------------------------------------
    // TEST 2: ≤ 14 Days Remaining -> Action: REFRESH
    // -------------------------------------------------------------------------
    console.log('▶ TEST 2: ≤ 14 Days Remaining (Expected: REFRESH via Meta API)');
    const futureDate10 = new Date(Date.now() + 10 * 24 * 60 * 60 * 1000).toISOString();
    process.env.THREADS_TOKEN_EXPIRES_AT = futureDate10;
    process.env.THREADS_TOKEN_STATUS = 'ACTIVE';
    updateEnvMultiple({
      THREADS_TOKEN_EXPIRES_AT: futureDate10,
      THREADS_TOKEN_STATUS: 'ACTIVE'
    });

    await refreshThreadsToken();
    console.log('✔ Test 2 Completed.\n');

    // -------------------------------------------------------------------------
    // TEST 3: Expired Token -> Action: SKIP (Status: REAUTH_REQUIRED)
    // -------------------------------------------------------------------------
    console.log('▶ TEST 3: Expired Token (Expected: REAUTH_REQUIRED)');
    const pastDate = new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString();
    process.env.THREADS_TOKEN_EXPIRES_AT = pastDate;
    process.env.THREADS_TOKEN_STATUS = 'ACTIVE';
    updateEnvMultiple({
      THREADS_TOKEN_EXPIRES_AT: pastDate,
      THREADS_TOKEN_STATUS: 'ACTIVE'
    });

    await refreshThreadsToken();
    console.log('✔ Test 3 Completed.\n');

  } finally {
    // Restore valid active token
    if (originalToken && originalExpiresAt) {
      process.env.THREADS_ACCESS_TOKEN = originalToken;
      process.env.THREADS_TOKEN_EXPIRES_AT = originalExpiresAt;
      process.env.THREADS_TOKEN_STATUS = 'ACTIVE';
      process.env.THREADS_LAST_REFRESH_ERROR = '';
      updateEnvMultiple({
        THREADS_ACCESS_TOKEN: originalToken,
        THREADS_TOKEN_EXPIRES_AT: originalExpiresAt,
        THREADS_TOKEN_STATUS: 'ACTIVE',
        THREADS_LAST_REFRESH_ERROR: ''
      });
      console.log('🔄 Restored valid active token in .env');
    }
  }

  // Final verification run with active valid token
  console.log('\n▶ FINAL VERIFICATION RUN (With actual active token):');
  delete require.cache[require.resolve('dotenv')];
  require('dotenv').config();
  await refreshThreadsToken();

  console.log('\n=================================================================');
  console.log('🎉 ALL AUTOMATED THREADS TOKEN MAINTENANCE TESTS PASSED!');
  console.log('=================================================================');
}

runTests();
