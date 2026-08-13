const http = require('http');
const url = require('url');
const axios = require('axios');
const { updateEnv, updateEnvMultiple } = require('../utils/envUtils');
require('dotenv').config();

const CLIENT_ID = process.env.THREADS_APP_ID || '730901463244435';
const CLIENT_SECRET = process.env.THREADS_APP_SECRET || '7e935d9ed227753ac66b7578da491fce';
const REDIRECT_URI = 'http://localhost:3000/callback';
const PORT = 3000;

const scope = 'threads_basic,threads_content_publish';
const authUrl = `https://threads.net/oauth/authorize?client_id=${CLIENT_ID}&redirect_uri=${encodeURIComponent(REDIRECT_URI)}&scope=${encodeURIComponent(scope)}&response_type=code`;

console.log('================================================================');
console.log('         Threads API OAuth 2.0 Access Token Generator           ');
console.log('================================================================');
console.log(`🔑 Scopes requested: ${scope}`);
console.log('\n👉 Open this URL in your browser to authorize Threads:\n');
console.log(authUrl + '\n');
console.log(`⏳ Listening on http://localhost:${PORT}/callback ...`);

const server = http.createServer(async (req, res) => {
  const reqUrl = url.parse(req.url, true);

  if (reqUrl.pathname === '/callback') {
    const code = reqUrl.query.code;
    const error = reqUrl.query.error;

    if (error) {
      res.writeHead(400, { 'Content-Type': 'text/html; charset=utf-8' });
      res.end(`<h2>❌ Authorization Error</h2><p><b>${error}</b>: ${reqUrl.query.error_description || ''}</p>`);
      console.error(`❌ Authorization Error: ${error} - ${reqUrl.query.error_description || ''}`);
      return;
    }

    if (code) {
      console.log(`✅ Received code: ${code}. Exchanging for short-lived token...`);

      try {
        const tokenRes = await axios.post(
          'https://graph.threads.net/oauth/access_token',
          new URLSearchParams({
            client_id: CLIENT_ID,
            client_secret: CLIENT_SECRET,
            grant_type: 'authorization_code',
            redirect_uri: REDIRECT_URI,
            code: code
          }).toString(),
          {
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' }
          }
        );

        const shortToken = tokenRes.data.access_token;
        const userId = tokenRes.data.user_id;

        console.log(`👤 Threads User ID: ${userId}`);
        updateEnv('THREADS_USER_ID', userId);

        console.log('🔄 Exchanging for long-lived access token...');
        const longTokenRes = await axios.get('https://graph.threads.net/access_token', {
          params: {
            grant_type: 'th_exchange_token',
            client_secret: CLIENT_SECRET,
            access_token: shortToken
          }
        });

        const longToken = longTokenRes.data.access_token;
        const expiresIn = longTokenRes.data.expires_in || 5184000;
        const now = new Date();
        const expiresAt = new Date(now.getTime() + expiresIn * 1000).toISOString();

        updateEnvMultiple({
          THREADS_ACCESS_TOKEN: longToken,
          THREADS_TOKEN_EXPIRES_AT: expiresAt,
          THREADS_TOKEN_UPDATED_AT: now.toISOString(),
          THREADS_TOKEN_STATUS: 'ACTIVE',
          THREADS_LAST_REFRESH_ERROR: ''
        });

        res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
        res.end('<h2>🎉 Success! Threads User ID & Long-Lived Access Token saved to .env!</h2><p>You can now close this tab.</p>');
        console.log('\n🎉 SUCCESS! THREADS_USER_ID & THREADS_ACCESS_TOKEN saved to .env!');
        console.log(`User ID: ${userId}`);
        console.log(`Expires At: ${expiresAt}`);
        console.log(`Token: ${longToken}`);
        
        setTimeout(() => process.exit(0), 1000);
      } catch (err) {
        const errDetails = err.response?.data || err.message;
        console.error('❌ Token Exchange Failed:', errDetails);
        res.writeHead(500, { 'Content-Type': 'text/html; charset=utf-8' });
        res.end(`<h2>❌ Token Exchange Failed</h2><pre>${JSON.stringify(errDetails, null, 2)}</pre>`);
      }
    }
  }
});

server.listen(PORT, () => {
  console.log(`🚀 Live local server active on http://localhost:${PORT}/callback`);
});
