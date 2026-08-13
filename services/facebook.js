const fs = require('fs');
const path = require('path');
require('dotenv').config();
const axios = require('axios');
const FormData = require('form-data');
const { getImageBuffer } = require('./imageFetcher');
const logger = require('../utils/logger');

/**
 * Gets a Page Access Token for the given Page ID using the user access token.
 *
 * @param {string} pageId
 * @param {string} userToken
 * @returns {Promise<string>}
 */
async function getPageAccessToken(pageId, userToken) {
  try {
    const url = `https://graph.facebook.com/v18.0/${pageId}`;
    const res = await axios.get(url, {
      params: {
        fields: 'access_token',
        access_token: userToken
      }
    });

    if (res.data && res.data.access_token) {
      logger.info(`[Facebook] Successfully retrieved Page Access Token for Page ID: ${pageId}`);
      return res.data.access_token;
    }
  } catch (err) {
    logger.warn(`[Facebook] Could not fetch Page Access Token automatically (${err.response?.data?.error?.message || err.message}). Falling back to provided token.`);
  }
  return userToken;
}

/**
 * Uploads an image to Facebook Page photos endpoint.
 *
 * @param {string} imageUrl - Public HTTP/HTTPS URL of the image.
 * @param {string} [caption] - Optional caption for the photo.
 */
async function uploadImageToFacebook(imageUrl, caption = '') {
  const pageId = process.env.FB_PAGE_ID;
  const userToken = process.env.FB_LONG_LIVED_USER_TOKEN;

  if (!pageId || !userToken) {
    throw new Error('Facebook credentials (FB_PAGE_ID / FB_LONG_LIVED_USER_TOKEN) missing in .env');
  }

  logger.info(`[Facebook] Publishing image URL: ${imageUrl}`);

  // Fetch Page-specific Access Token
  const accessToken = await getPageAccessToken(pageId, userToken);

  try {
    // Attempt Method 1: Using URL parameter via POST
    const endpoint = `https://graph.facebook.com/v18.0/${pageId}/photos`;
    const response = await axios.post(endpoint, null, {
      params: {
        url: imageUrl,
        published: true,
        caption: caption,
        access_token: accessToken
      }
    });

    logger.info(`[Facebook] ✅ Uploaded successfully via URL. Photo ID: ${response.data.id}`);
    return response.data;
  } catch (err1) {
    const errorDetails1 = err1.response?.data?.error || err1.response?.data || err1.message;
    logger.warn(`[Facebook] Method 1 (URL param) failed: ${JSON.stringify(errorDetails1)}. Trying Method 2 (Binary stream buffer upload)...`);

    try {
      // Attempt Method 2: Fetch binary buffer & send via FormData source
      const imageBuffer = await getImageBuffer(imageUrl);
      const form = new FormData();
      form.append('source', imageBuffer, { filename: 'page.jpg', contentType: 'image/jpeg' });
      form.append('published', 'true');
      form.append('access_token', accessToken);
      if (caption) {
        form.append('caption', caption);
      }

      const endpoint = `https://graph.facebook.com/v18.0/${pageId}/photos`;
      const response = await axios.post(endpoint, form, {
        headers: form.getHeaders()
      });

      logger.info(`[Facebook] ✅ Uploaded successfully via binary stream. Photo ID: ${response.data.id}`);
      return response.data;
    } catch (err2) {
      const errorDetails2 = err2.response?.data?.error || err2.response?.data || err2.message;
      const metaCode = err2.response?.data?.error?.code;

      if (metaCode === 190 || String(errorDetails2?.message).includes('expired')) {
        const { updateEnvMultiple } = require('../utils/envUtils');
        updateEnvMultiple({
          FB_TOKEN_STATUS: 'REAUTH_REQUIRED',
          FB_LAST_REFRESH_AT: new Date().toISOString(),
          FB_LAST_REFRESH_ERROR: `HTTP ${err2.response?.status || 400} | Code 190: ${errorDetails2?.message || err2.message}`
        });
        logger.error(`[Facebook] ❌ Access Token Expired (Code 190). Set FB_TOKEN_STATUS=REAUTH_REQUIRED. Run 'node scripts/exchangeFacebookToken.js <NEW_TOKEN>' to renew.`);
      }

      logger.error(`[Facebook] Upload failed completely:`, JSON.stringify(errorDetails2));
      throw new Error(`Facebook API Error: ${errorDetails2.message || JSON.stringify(errorDetails2)}`);
    }
  }
}

/**
 * Uploads a video to Facebook Page videos endpoint (supports Cloudinary video URL or local file).
 *
 * @param {string} videoUrlOrPath - Cloudinary video URL or local MP4 path.
 * @param {string} [title] - Video title.
 * @param {string} [description] - Video description / caption.
 * @returns {Promise<object>}
 */
async function uploadVideoToFacebook(videoUrlOrPath, title = '', description = '') {
  const pageId = process.env.FB_PAGE_ID;
  const userToken = process.env.FB_LONG_LIVED_USER_TOKEN;

  if (!pageId || !userToken) {
    throw new Error('Facebook credentials (FB_PAGE_ID / FB_LONG_LIVED_USER_TOKEN) missing in .env');
  }

  logger.info(`[Facebook] Publishing video: ${videoUrlOrPath}`);

  const accessToken = await getPageAccessToken(pageId, userToken);
  const videoTitle = title || 'Dawah Video Reflection';
  const videoDesc = description || title || 'Daily Islamic Reflection';

  const isLocalFile = typeof videoUrlOrPath === 'string' && fs.existsSync(videoUrlOrPath);

  if (!isLocalFile && typeof videoUrlOrPath === 'string' && (videoUrlOrPath.startsWith('http://') || videoUrlOrPath.startsWith('https://'))) {
    try {
      // Method 1: Remote URL upload using file_url parameter
      const endpoint = `https://graph.facebook.com/v18.0/${pageId}/videos`;
      const response = await axios.post(endpoint, null, {
        params: {
          file_url: videoUrlOrPath,
          title: videoTitle,
          description: videoDesc,
          access_token: accessToken
        }
      });

      logger.info(`[Facebook] ✅ Video uploaded successfully via URL. Video ID: ${response.data.id}`);
      return response.data;
    } catch (err1) {
      const errorDetails1 = err1.response?.data?.error || err1.response?.data || err1.message;
      logger.warn(`[Facebook] Video Method 1 (URL param) failed: ${JSON.stringify(errorDetails1)}. Trying Method 2 (Binary stream buffer upload)...`);
    }
  }

  // Method 2: Binary stream buffer upload via FormData
  try {
    let videoStream;
    let filename = 'video.mp4';

    if (isLocalFile) {
      videoStream = fs.createReadStream(videoUrlOrPath);
      filename = path.basename(videoUrlOrPath);
    } else {
      const streamRes = await axios.get(videoUrlOrPath, { responseType: 'stream' });
      videoStream = streamRes.data;
    }

    const form = new FormData();
    form.append('source', videoStream, { filename, contentType: 'video/mp4' });
    form.append('title', videoTitle);
    form.append('description', videoDesc);
    form.append('access_token', accessToken);

    const endpoint = `https://graph.facebook.com/v18.0/${pageId}/videos`;
    const response = await axios.post(endpoint, form, {
      headers: form.getHeaders(),
      maxContentLength: Infinity,
      maxBodyLength: Infinity
    });

    logger.info(`[Facebook] ✅ Video uploaded successfully via binary stream. Video ID: ${response.data.id}`);
    return response.data;
  } catch (err2) {
    const errorDetails2 = err2.response?.data?.error || err2.response?.data || err2.message;
    const metaCode = err2.response?.data?.error?.code;

    if (metaCode === 190 || String(errorDetails2?.message).includes('expired')) {
      const { updateEnvMultiple } = require('../utils/envUtils');
      updateEnvMultiple({
        FB_TOKEN_STATUS: 'REAUTH_REQUIRED',
        FB_LAST_REFRESH_AT: new Date().toISOString(),
        FB_LAST_REFRESH_ERROR: `HTTP ${err2.response?.status || 400} | Code 190: ${errorDetails2?.message || err2.message}`
      });
      logger.error(`[Facebook] ❌ Access Token Expired (Code 190). Set FB_TOKEN_STATUS=REAUTH_REQUIRED.`);
    }

    logger.error(`[Facebook] Video upload failed completely:`, JSON.stringify(errorDetails2));
    throw new Error(`Facebook Video API Error: ${errorDetails2.message || JSON.stringify(errorDetails2)}`);
  }
}

module.exports = { uploadImageToFacebook, uploadVideoToFacebook };

