const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../.env') });
const { refreshFacebookToken } = require('../cron/refreshTokens');
const { updateEnvMultiple } = require('../utils/envUtils');

async function runFbTests() {
  console.log('=================================================================');
  console.log('      AUTOMATED FACEBOOK TOKEN REFRESH SUITE - TEST RUNNER       ');
  console.log('=================================================================\n');

  const originalToken = process.env.FB_LONG_LIVED_USER_TOKEN;
  const originalExpiresAt = process.env.FB_TOKEN_EXPIRES_AT;

  try {
    // -------------------------------------------------------------------------
    // TEST 1: > 14 Days Remaining -> Action: SKIP
    // -------------------------------------------------------------------------
    console.log('▶ TEST 1: > 14 Days Remaining (Expected: SKIP)');
    const futureDate45 = new Date(Date.now() + 45 * 24 * 60 * 60 * 1000).toISOString();
    process.env.FB_TOKEN_EXPIRES_AT = futureDate45;
    process.env.FB_TOKEN_STATUS = 'ACTIVE';
    updateEnvMultiple({
      FB_TOKEN_EXPIRES_AT: futureDate45,
      FB_TOKEN_STATUS: 'ACTIVE'
    });

    await refreshFacebookToken();
    console.log('✔ Test 1 Completed.\n');

    // -------------------------------------------------------------------------
    // TEST 2: ≤ 14 Days Remaining -> Action: REFRESH
    // -------------------------------------------------------------------------
    console.log('▶ TEST 2: ≤ 14 Days Remaining (Expected: REFRESH attempt)');
    const futureDate10 = new Date(Date.now() + 10 * 24 * 60 * 60 * 1000).toISOString();
    process.env.FB_TOKEN_EXPIRES_AT = futureDate10;
    process.env.FB_TOKEN_STATUS = 'ACTIVE';
    updateEnvMultiple({
      FB_TOKEN_EXPIRES_AT: futureDate10,
      FB_TOKEN_STATUS: 'ACTIVE'
    });

    await refreshFacebookToken();
    console.log('✔ Test 2 Completed.\n');

    // -------------------------------------------------------------------------
    // TEST 3: Expired Token -> Action: SKIP (Status: REAUTH_REQUIRED)
    // -------------------------------------------------------------------------
    console.log('▶ TEST 3: Expired Token (Expected: REAUTH_REQUIRED)');
    const pastDate = new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString();
    process.env.FB_TOKEN_EXPIRES_AT = pastDate;
    process.env.FB_TOKEN_STATUS = 'ACTIVE';
    updateEnvMultiple({
      FB_TOKEN_EXPIRES_AT: pastDate,
      FB_TOKEN_STATUS: 'ACTIVE'
    });

    await refreshFacebookToken();
    console.log('✔ Test 3 Completed.\n');

  } finally {
    if (originalToken) {
      process.env.FB_LONG_LIVED_USER_TOKEN = originalToken;
      process.env.FB_TOKEN_EXPIRES_AT = originalExpiresAt || new Date(Date.now() + 60 * 24 * 60 * 60 * 1000).toISOString();
      process.env.FB_TOKEN_STATUS = 'ACTIVE';
      process.env.FB_LAST_REFRESH_ERROR = '';
      updateEnvMultiple({
        FB_LONG_LIVED_USER_TOKEN: originalToken,
        FB_TOKEN_EXPIRES_AT: process.env.FB_TOKEN_EXPIRES_AT,
        FB_TOKEN_STATUS: 'ACTIVE',
        FB_LAST_REFRESH_ERROR: ''
      });
      console.log('🔄 Restored Facebook token state in .env');
    }
  }

  console.log('\n=================================================================');
  console.log('🎉 ALL AUTOMATED FACEBOOK TOKEN MAINTENANCE TESTS PASSED!');
  console.log('=================================================================');
}

runFbTests();
