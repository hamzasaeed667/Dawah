const fs = require('fs');
const path = require('path');
const { isServerless, blobGet, blobSet } = require('./blobStore');

const BLOB_STORE = 'dawah-tokens';
const BLOB_KEY = 'token-data';

function updateEnv(key, value) {
  updateEnvMultiple({ [key]: value });
}

function updateEnvMultiple(keyValuePairs) {
  const envPath = path.resolve(__dirname, '../.env');
  const tokenDataPath = path.resolve(__dirname, '../tokenData.json');

  // 1. Update .env on disk (will silently fail in serverless — that's OK)
  try {
    let envData = '';
    if (fs.existsSync(envPath)) {
      envData = fs.readFileSync(envPath, 'utf-8');
    }

    for (const [key, value] of Object.entries(keyValuePairs)) {
      const safeValue = value === null || value === undefined ? '' : String(value);
      const regex = new RegExp(`^${key}=.*`, 'm');
      if (envData.match(regex)) {
        envData = envData.replace(regex, `${key}=${safeValue}`);
      } else {
        if (!envData.endsWith('\n') && envData.length > 0) {
          envData += '\n';
        }
        envData += `${key}=${safeValue}\n`;
      }
    }

    fs.writeFileSync(envPath, envData, 'utf-8');
  } catch (err) {
    // Expected to fail in serverless (read-only filesystem)
    if (!isServerless) {
      console.warn(`⚠️ Could not write to .env: ${err.message}`);
    }
  }

  // 2. Persist to tokenData.json on disk
  let tokenData = {};
  try {
    const tokenDataPath2 = path.resolve(__dirname, '../tokenData.json');
    if (fs.existsSync(tokenDataPath2)) {
      tokenData = JSON.parse(fs.readFileSync(tokenDataPath2, 'utf-8'));
    }
  } catch (err) {
    tokenData = {};
  }

  for (const [key, value] of Object.entries(keyValuePairs)) {
    tokenData[key] = value;
  }

  try {
    fs.writeFileSync(tokenDataPath, JSON.stringify(tokenData, null, 2), 'utf-8');
  } catch (err) {
    if (!isServerless) {
      console.warn(`⚠️ Could not write to tokenData.json: ${err.message}`);
    }
  }

  // 3. Also update process.env so current invocation uses updated values
  for (const [key, value] of Object.entries(keyValuePairs)) {
    process.env[key] = value === null || value === undefined ? '' : String(value);
  }

  // 4. Persist to Netlify Blobs (async, fire-and-forget for backward compat)
  if (isServerless) {
    const mergedTokenData = { ...tokenData };
    blobSet(BLOB_STORE, BLOB_KEY, mergedTokenData).catch(err => {
      console.warn(`[envUtils] Blob token persistence failed: ${err.message}`);
    });
  }

  const updatedKeys = Object.keys(keyValuePairs).join(', ');
  console.log(`🔄 Updated .env & tokenData.json: ${updatedKeys}`);
}

/**
 * Load token data from Netlify Blobs into process.env on startup (serverless only).
 * Call this early in the function lifecycle to hydrate tokens from persistent storage.
 */
async function loadTokensFromBlobs() {
  if (!isServerless) return;
  try {
    const tokenData = await blobGet(BLOB_STORE, BLOB_KEY);
    if (tokenData && typeof tokenData === 'object') {
      let count = 0;
      for (const [key, value] of Object.entries(tokenData)) {
        if (value !== null && value !== undefined && value !== '') {
          process.env[key] = String(value);
          count++;
        }
      }
      console.log(`[envUtils] Loaded ${count} token values from Netlify Blobs into process.env`);
    }
  } catch (err) {
    console.warn(`[envUtils] Could not load tokens from Blobs: ${err.message}`);
  }
}

module.exports = { updateEnv, updateEnvMultiple, loadTokensFromBlobs };
