const axios = require('axios');
const { updateEnvMultiple } = require('../utils/envUtils');
require('dotenv').config();

const APP_ID = process.env.FB_APP_ID || process.env.Instagram_app_ID || process.env.THREADS_APP_ID || '1055034637004398';
const APP_SECRET = process.env.FB_APP_SECRET || process.env.Instagram_SECRET || process.env.THREADS_APP_SECRET || 'de3b7b6e7d44fd305330b44093930af3';

const inputToken = process.argv[2];

if (!inputToken) {
  console.log('Usage: node scripts/exchangeFacebookToken.js <short_lived_or_user_token>');
  console.log('\nExample: node scripts/exchangeFacebookToken.js "EAAYa1..."');
  process.exit(1);
}

/**
 * Exchanges any Facebook User Token (short-lived or long-lived) for a fresh 60-day Long-Lived Token
 * and updates .env with token + dynamic expiration metadata.
 *
 * @param {string} tokenToExchange
 */
async function exchangeFacebookUserToken(tokenToExchange) {
  console.log(`🔑 Exchanging Facebook User Token (App ID: ${APP_ID})...`);

  try {
    const url = 'https://graph.facebook.com/v18.0/oauth/access_token';
    const response = await axios.get(url, {
      params: {
        grant_type: 'fb_exchange_token',
        client_id: APP_ID,
        client_secret: APP_SECRET,
        fb_exchange_token: tokenToExchange.trim()
      }
    });

    if (response.data && response.data.access_token) {
      const longLivedToken = response.data.access_token;
      const expiresIn = response.data.expires_in || 5184000; // seconds (~60 days)
      const now = new Date();
      const expiresAt = new Date(now.getTime() + expiresIn * 1000).toISOString();

      updateEnvMultiple({
        FB_LONG_LIVED_USER_TOKEN: longLivedToken,
        FB_TOKEN_EXPIRES_AT: expiresAt,
        FB_TOKEN_UPDATED_AT: now.toISOString(),
        FB_LAST_REFRESH_AT: now.toISOString(),
        FB_TOKEN_STATUS: 'ACTIVE',
        FB_LAST_REFRESH_ERROR: ''
      });

      console.log('\n🎉 SUCCESS! Long-lived FB_LONG_LIVED_USER_TOKEN & Metadata saved to .env!');
      console.log(`Expires At: ${expiresAt}`);
      console.log(`Token Prefix: ${longLivedToken.substring(0, 20)}...`);
      return response.data;
    } else {
      throw new Error('Meta API did not return an access_token field.');
    }
  } catch (err) {
    const errDetails = err.response?.data?.error || err.response?.data || err.message;
    console.error('❌ Facebook Token Exchange Failed:', JSON.stringify(errDetails, null, 2));

    const httpStatus = err.response?.status || 'N/A';
    const metaCode = err.response?.data?.error?.code || 'N/A';
    const metaMsg = err.response?.data?.error?.message || err.message;
    const fullErrStr = `HTTP ${httpStatus} | Meta Error Code ${metaCode}: ${metaMsg}`;

    updateEnvMultiple({
      FB_TOKEN_STATUS: 'REAUTH_REQUIRED',
      FB_LAST_REFRESH_AT: new Date().toISOString(),
      FB_LAST_REFRESH_ERROR: fullErrStr
    });
    throw new Error(`Facebook Token Exchange Error: ${metaMsg}`);
  }
}

if (require.main === module) {
  exchangeFacebookUserToken(inputToken);
}

module.exports = { exchangeFacebookUserToken };
