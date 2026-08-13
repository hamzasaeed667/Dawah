const http = require('http');
const url = require('url');
const axios = require('axios');
const { updateEnv } = require('../utils/envUtils');

const CLIENT_ID = process.env.LINKEDIN_CLIENT_ID || '78x1h5ac08ju9b';
const CLIENT_SECRET = process.env.LINKEDIN_CLIENT_SECRET || '';
const REDIRECT_URI = 'http://localhost:3000/callback';
const PORT = 3000;

// Default scope to w_member_social, openid, and profile
const scope = process.argv[2] || 'w_member_social openid profile';
const authUrl = `https://www.linkedin.com/oauth/v2/authorization?response_type=code&client_id=${CLIENT_ID}&redirect_uri=${encodeURIComponent(REDIRECT_URI)}&scope=${encodeURIComponent(scope)}`;

console.log('================================================================');
console.log('  LinkedIn OAuth 2.0 Token Generator  ');
console.log('================================================================');
console.log(`🔑 Scope requested: ${scope}`);
console.log('👉 Click URL to authorize:');
console.log('\n' + authUrl + '\n');
console.log('⏳ Listening on http://localhost:3000/callback ...');

const server = http.createServer(async (req, res) => {
  const reqUrl = url.parse(req.url, true);

  if (reqUrl.pathname === '/callback') {
    const code = reqUrl.query.code;
    const error = reqUrl.query.error;

    if (error) {
      res.writeHead(400, { 'Content-Type': 'text/html; charset=utf-8' });
      res.end(`<h2>❌ Authorization Error</h2><p><b>${error}</b>: ${reqUrl.query.error_description}</p>`);
      console.error(`❌ Authorization Error: ${error} - ${reqUrl.query.error_description}`);
      return;
    }

    if (code) {
      console.log(`✅ Received code. Requesting access token...`);

      try {
        const tokenRes = await axios.post(
          'https://www.linkedin.com/oauth/v2/accessToken',
          new URLSearchParams({
            grant_type: 'authorization_code',
            code: code,
            client_id: CLIENT_ID,
            client_secret: CLIENT_SECRET,
            redirect_uri: REDIRECT_URI
          }).toString(),
          {
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' }
          }
        );

        const accessToken = tokenRes.data.access_token;
        const refreshToken = tokenRes.data.refresh_token;

        updateEnv('LINKEDIN_ACCESS_TOKEN', accessToken);
        if (refreshToken) {
          updateEnv('LINKEDIN_REFRESH_TOKEN', refreshToken);
        }

        try {
          const userinfo = await axios.get('https://api.linkedin.com/v2/userinfo', {
            headers: { Authorization: `Bearer ${accessToken}` }
          });
          if (userinfo.data && userinfo.data.sub) {
            console.log(`👤 Discovered LinkedIn Person ID (sub): ${userinfo.data.sub}`);
            updateEnv('LINKEDIN_PERSON_ID', userinfo.data.sub);
          }
        } catch (uErr) {
          console.log('Userinfo fetch skipped:', uErr.message);
        }

        res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
        res.end('<h2>🎉 Success! LinkedIn Access Token saved to .env file.</h2><p>You can now close this tab.</p>');
        console.log('\n🎉 SUCCESS! LINKEDIN_ACCESS_TOKEN saved to .env!');
      } catch (err) {
        const errDetails = err.response?.data || err.message;
        console.error('❌ Token Exchange Error:', errDetails);
        res.writeHead(500, { 'Content-Type': 'text/html; charset=utf-8' });
        res.end(`<h2>❌ Token Exchange Failed</h2><p>${JSON.stringify(errDetails)}</p>`);
      } finally {
        server.close();
      }
    }
  }
});

server.listen(PORT);
