const fs = require('fs');
const path = require('path');

function updateEnv(key, value) {
  updateEnvMultiple({ [key]: value });
}

function updateEnvMultiple(keyValuePairs) {
  const envPath = path.resolve(__dirname, '../.env');
  const tokenDataPath = path.resolve(__dirname, '../tokenData.json');

  // 1. Update .env
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

  // 2. Persist to tokenData.json
  let tokenData = {};
  if (fs.existsSync(tokenDataPath)) {
    try {
      tokenData = JSON.parse(fs.readFileSync(tokenDataPath, 'utf-8'));
    } catch (err) {
      tokenData = {};
    }
  }

  for (const [key, value] of Object.entries(keyValuePairs)) {
    tokenData[key] = value;
  }

  fs.writeFileSync(tokenDataPath, JSON.stringify(tokenData, null, 2), 'utf-8');

  const updatedKeys = Object.keys(keyValuePairs).join(', ');
  console.log(`🔄 Updated .env & tokenData.json: ${updatedKeys}`);
}

module.exports = { updateEnv, updateEnvMultiple };
