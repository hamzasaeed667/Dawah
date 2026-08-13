require('dotenv').config();
const axios = require('axios');
const logger = require('../utils/logger');

/**
 * Uploads an image to Instagram Business/Creator account via Meta Graph API.
 * Uses a 2-step process: Container creation -> Publish media.
 *
 * @param {string} imageUrl - Public HTTP/HTTPS URL of the image.
 * @param {string} [caption] - Optional caption.
 */
async function uploadImageToInstagram(imageUrl, caption = '') {
  const igAccountId = process.env.INSTAGRAM_ACCOUNT_ID;
  const accessToken = process.env.FB_LONG_LIVED_USER_TOKEN;

  if (!igAccountId || !accessToken) {
    throw new Error('Instagram credentials (INSTAGRAM_ACCOUNT_ID / FB_LONG_LIVED_USER_TOKEN) missing in .env');
  }

  logger.info(`[Instagram] Step 1: Creating media container for URL: ${imageUrl}`);

  try {
    // Step 1: Create media container
    const containerEndpoint = `https://graph.facebook.com/v18.0/${igAccountId}/media`;
    const containerRes = await axios.post(containerEndpoint, null, {
      params: {
        image_url: imageUrl,
        caption: caption,
        access_token: accessToken
      }
    });

    const containerId = containerRes.data.id;
    logger.info(`[Instagram] Container created: ${containerId}. Step 2: Publishing...`);

    // Brief delay to allow container processing
    await new Promise((resolve) => setTimeout(resolve, 3000));

    // Step 2: Publish media container
    const publishEndpoint = `https://graph.facebook.com/v18.0/${igAccountId}/media_publish`;
    const publishRes = await axios.post(publishEndpoint, null, {
      params: {
        creation_id: containerId,
        access_token: accessToken
      }
    });

    logger.info(`[Instagram] ✅ Published successfully. Media ID: ${publishRes.data.id}`);
    return publishRes.data;
  } catch (err) {
    const errObj = err.response?.data?.error || err.response?.data || err.message;
    const metaCode = err.response?.data?.error?.code;

    if (metaCode === 190 || String(errObj?.message).includes('expired')) {
      const { updateEnvMultiple } = require('../utils/envUtils');
      updateEnvMultiple({
        FB_TOKEN_STATUS: 'REAUTH_REQUIRED',
        FB_LAST_REFRESH_AT: new Date().toISOString(),
        FB_LAST_REFRESH_ERROR: `HTTP ${err.response?.status || 400} | Code 190: ${errObj?.message || err.message}`
      });
      logger.error(`[Instagram] ❌ Access Token Expired (Code 190). Set FB_TOKEN_STATUS=REAUTH_REQUIRED. Run 'node scripts/exchangeFacebookToken.js <NEW_TOKEN>' to renew.`);
    }

    logger.error(`[Instagram] Upload failed: ${JSON.stringify(errObj)}`);
    throw new Error(`Instagram API Error: ${errObj?.message || err.message}`);
  }
}

module.exports = { uploadImageToInstagram };
