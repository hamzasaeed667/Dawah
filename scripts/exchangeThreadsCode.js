const axios = require('axios');
const { updateEnv, updateEnvMultiple } = require('../utils/envUtils');
require('dotenv').config();

const CLIENT_ID = process.env.THREADS_APP_ID || '730901463244435';
const CLIENT_SECRET = process.env.THREADS_APP_SECRET || '7e935d9ed227753ac66b7578da491fce';
const REDIRECT_URI = 'https://hamzasaeed667.github.io/DawahImages/index.html';

const inputCode = process.argv[2];

if (!inputCode) {
  console.log('Usage: node scripts/exchangeThreadsCode.js <code_or_url>');
  console.log('\nExample: node scripts/exchangeThreadsCode.js "THQ..."');
  process.exit(1);
}

// Extract code if full URL was provided
let code = inputCode;
if (code.includes('code=')) {
  const urlParams = new URLSearchParams(code.split('?')[1] || code);
  code = urlParams.get('code') || code;
}

// Strip trailing hash or parameters
code = code.split('#')[0];

console.log(`🔑 Exchanging code: ${code.substring(0, 15)}...`);

async function exchange() {
  const redirectUris = [
    'https://hamzasaeed667.github.io/DawahImages/index.html',
    'http://localhost:3000/callback'
  ];

  let shortToken = null;
  let userId = null;
  let lastError = null;

  for (const uri of redirectUris) {
    try {
      console.log(`Trying redirect_uri: ${uri}...`);
      const tokenRes = await axios.post(
        'https://graph.threads.net/oauth/access_token',
        new URLSearchParams({
          client_id: CLIENT_ID,
          client_secret: CLIENT_SECRET,
          grant_type: 'authorization_code',
          redirect_uri: uri,
          code: code
        }).toString(),
        {
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' }
        }
      );
      shortToken = tokenRes.data.access_token;
      userId = tokenRes.data.user_id;
      console.log(`✅ Short-lived token acquired using ${uri}`);
      break;
    } catch (err) {
      lastError = err.response?.data || err.message;
    }
  }

  if (!shortToken) {
    console.error('❌ Exchange Error:', lastError);
    return;
  }

  try {
    console.log(`👤 Threads User ID: ${userId}`);
    updateEnv('THREADS_USER_ID', userId);
    updateEnv('THREADS_ACCESS_TOKEN', shortToken);

    console.log('🔄 Exchanging short-lived token for long-lived access token...');
    const longTokenRes = await axios.get('https://graph.threads.net/access_token', {
      params: {
        grant_type: 'th_exchange_token',
        client_secret: CLIENT_SECRET,
        access_token: shortToken
      }
    });

    const longToken = longTokenRes.data.access_token;
    const expiresIn = longTokenRes.data.expires_in || 5184000; // seconds returned by Meta
    const now = new Date();
    const expiresAt = new Date(now.getTime() + expiresIn * 1000).toISOString();

    updateEnvMultiple({
      THREADS_ACCESS_TOKEN: longToken,
      THREADS_TOKEN_EXPIRES_AT: expiresAt,
      THREADS_TOKEN_UPDATED_AT: now.toISOString(),
      THREADS_TOKEN_STATUS: 'ACTIVE',
      THREADS_LAST_REFRESH_ERROR: ''
    });

    console.log('\n🎉 SUCCESS! Long-lived THREADS_ACCESS_TOKEN & Metadata saved to .env!');
    console.log(`User ID: ${userId}`);
    console.log(`Expires At: ${expiresAt}`);
    console.log(`Long-Lived Token: ${longToken}`);
  } catch (err) {
    const errObj = err.response?.data || err.message;
    console.error('⚠️ Long-lived Token Exchange Warning:', JSON.stringify(errObj, null, 2));
    console.log('\n📌 Note: Short-lived token is saved in .env!');
  }
}

exchange();



