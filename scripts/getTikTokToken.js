require('dotenv').config();
const readline = require('readline');
const axios = require('axios');
const { updateEnv } = require('../utils/envUtils');

const CLIENT_KEY = process.env.TIKTOK_CLIENT_KEY || 'your_tiktok_client_key';
const CLIENT_SECRET = process.env.TIKTOK_CLIENT_SECRET || 'your_tiktok_client_secret';
const REDIRECT_URI = 'https://hamzasaeed667.github.io/DawahImages/index.html';

// Requested scopes for photo and video posting
const scope = 'user.info.basic,video.upload,video.publish';
const state = Math.random().toString(36).substring(7);

const authUrl = `https://www.tiktok.com/v2/auth/authorize/?client_key=${CLIENT_KEY}&response_type=code&scope=${encodeURIComponent(scope)}&redirect_uri=${encodeURIComponent(REDIRECT_URI)}&state=${state}`;

console.log('================================================================');
console.log('         TikTok OAuth 2.0 Access Token Generator         ');
console.log('================================================================');
console.log(`🔑 Scopes requested: ${scope}`);
console.log(`📌 Redirect URI: ${REDIRECT_URI}`);
console.log('\n👉 Step 1: Open this URL in your browser to authorize TikTok:');
console.log('\n' + authUrl + '\n');
console.log('👉 Step 2: After authorizing, TikTok will redirect your browser to');
console.log(`   ${REDIRECT_URI}?code=XXXXXX&state=YYYYYY`);
console.log('\n👉 Step 3: Copy the entire redirected URL or just the "code" parameter value and paste it below:\n');

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

rl.question('Paste full redirect URL or authorization code: ', async (input) => {
  let code = input.trim();
  if (code.includes('code=')) {
    try {
      const parsed = new URL(code);
      code = parsed.searchParams.get('code');
    } catch (e) {
      const match = code.match(/code=([^&]+)/);
      if (match) code = match[1];
    }
  }

  if (!code) {
    console.error('❌ Could not extract authorization code from input.');
    rl.close();
    process.exit(1);
  }

  console.log(`\n✅ Using code: ${code}`);
  console.log(`🔄 Exchanging code for TikTok Access Token...`);

  try {
    const tokenRes = await axios.post(
      'https://open.tiktokapis.com/v2/oauth/token/',
      new URLSearchParams({
        client_key: CLIENT_KEY,
        client_secret: CLIENT_SECRET,
        code: code,
        grant_type: 'authorization_code',
        redirect_uri: REDIRECT_URI
      }).toString(),
      {
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' }
      }
    );

    const data = tokenRes.data;
    const accessToken = data.access_token || data.data?.access_token;
    const refreshToken = data.refresh_token || data.data?.refresh_token;

    if (accessToken) {
      updateEnv('TIKTOK_ACCESS_TOKEN', accessToken);
      if (refreshToken) {
        updateEnv('TIKTOK_REFRESH_TOKEN', refreshToken);
      }
      console.log('\n🎉 SUCCESS! TIKTOK_ACCESS_TOKEN and TIKTOK_REFRESH_TOKEN saved to .env file!');
    } else {
      console.error('❌ TikTok API Error Response:', JSON.stringify(data, null, 2));
    }
  } catch (err) {
    const errDetails = err.response?.data || err.message;
    console.error('❌ Token Exchange Error:', JSON.stringify(errDetails, null, 2));
  } finally {
    rl.close();
  }
});
