const fs = require('fs');
const path = require('path');
const axios = require('axios');
const FormData = require('form-data');
const logger = require('../utils/logger');
require('dotenv').config();

const VIDEOS_DIR = '/Users/mac/Desktop/Hamza/Projects/DawahImages/videos';

/**
 * Gets local video file path for a given page number.
 * e.g. page 1 -> /Users/mac/Desktop/Hamza/Projects/DawahImages/videos/001.mp4
 *
 * @param {number} pageNo
 * @returns {string}
 */
function getVideoPath(pageNo) {
  const paddedNo = String(pageNo).padStart(3, '0');
  return path.join(VIDEOS_DIR, `${paddedNo}.mp4`);
}

/**
 * Obtains a V2 Access Token from Dailymotion OAuth2 API using Private API Key credentials.
 *
 * @returns {Promise<{token: string, userId: string, profileId: string}>}
 */
async function getDailymotionV2Token() {
  const clientId = process.env.DAILYMOTION_CLIENT_ID || process.env.DAILYMOTION_API_KEY;
  let clientSecret = process.env.DAILYMOTION_CLIENT_SECRET || process.env.DAILYMOTION_API_SECRET || '';

  if (clientSecret.startsWith("'") && clientSecret.endsWith("'")) {
    clientSecret = clientSecret.slice(1, -1);
  }

  if (!clientId || !clientSecret) {
    throw new Error('Dailymotion Private API Key credentials (DAILYMOTION_API_KEY / DAILYMOTION_API_SECRET) missing in .env');
  }

  logger.info('[Dailymotion] Step 1: Requesting V2 OAuth Token from https://oauth2.dailymotion.com/v2/token...');

  const params = new URLSearchParams({
    grant_type: 'client_credentials',
    client_id: clientId,
    client_secret: clientSecret,
    scope: 'bundle.publisher'
  });

  const res = await axios.post('https://oauth2.dailymotion.com/v2/token', params.toString(), {
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' }
  });

  if (!res.data?.access_token) {
    throw new Error('Dailymotion OAuth2 did not return an access_token');
  }

  const token = res.data.access_token;

  // Fetch authenticated User/Profile details
  let profileId = process.env.DAILYMOTION_PROFILE_ID;
  let userId = null;

  try {
    const meRes = await axios.get('https://api.dailymotion.com/v2/me', {
      headers: { Authorization: `Bearer ${token}` }
    });
    userId = meRes.data.user_id;
    if (!profileId && meRes.data.profiles && meRes.data.profiles.length > 0) {
      profileId = meRes.data.profiles[0].profile_id;
    }
  } catch (err) {
    logger.warn('[Dailymotion] Could not fetch profile ID automatically from /v2/me.');
  }

  return { token, userId, profileId };
}

const { getVideoUrl } = require('./videoFetcher');

/**
 * Uploads a video for the specified Cloudinary video URL (or page number / local file)
 * to Dailymotion using V2 Private API.
 *
 * @param {string|number} videoUrlOrPageNo - Cloudinary video URL, page number, or local file path.
 * @param {string} [title] - Video title.
 * @param {string} [tags] - Video tags.
 * @returns {Promise<object>}
 */
async function uploadVideoToDailymotion(videoUrlOrPageNo, title = '', tags = 'dawah,islam,reflection') {
  let videoUrl = null;
  let isLocalFile = false;

  if (typeof videoUrlOrPageNo === 'number' || (typeof videoUrlOrPageNo === 'string' && /^\d+$/.test(videoUrlOrPageNo))) {
    videoUrl = getVideoUrl(videoUrlOrPageNo);
  } else if (typeof videoUrlOrPageNo === 'string' && (videoUrlOrPageNo.startsWith('http://') || videoUrlOrPageNo.startsWith('https://'))) {
    videoUrl = videoUrlOrPageNo;
  } else if (typeof videoUrlOrPageNo === 'string' && fs.existsSync(videoUrlOrPageNo)) {
    videoUrl = videoUrlOrPageNo;
    isLocalFile = true;
  } else {
    throw new Error(`Invalid video URL, page number, or local path provided to Dailymotion: ${videoUrlOrPageNo}`);
  }

  const { token, profileId } = await getDailymotionV2Token();
  const videoTitle = title || `Dawah Book Video Reflection`;

  logger.info(`[Dailymotion] Initiating video publish for target profile...`);
  logger.info(`[Dailymotion] Source: ${videoUrl}`);

  let fileUrlToPublish = videoUrl;

  if (isLocalFile) {
    logger.info(`[Dailymotion] Step 2: Creating upload session for local file...`);
    const sessionRes = await axios.post('https://api.dailymotion.com/v2/files/upload_sessions', null, {
      headers: { Authorization: `Bearer ${token}` }
    });

    const uploadUrl = sessionRes.data.upload_url;
    if (!uploadUrl) {
      throw new Error('Dailymotion V2 upload_sessions did not return an upload_url');
    }

    logger.info(`[Dailymotion] Step 3: Streaming video binary (${fs.statSync(videoUrl).size} bytes) for ${path.basename(videoUrl)}...`);
    const form = new FormData();
    form.append('file', fs.createReadStream(videoUrl), path.basename(videoUrl));

    const uploadRes = await axios.post(uploadUrl, form, {
      headers: form.getHeaders(),
      maxContentLength: Infinity,
      maxBodyLength: Infinity
    });

    fileUrlToPublish = uploadRes.data.url || uploadRes.data.file;
    if (!fileUrlToPublish) {
      throw new Error('Dailymotion file upload server did not return a file URL');
    }
  }

  logger.info(`[Dailymotion] Step 4: Creating video object for target profile with file_url...`);
  const profilesToTry = ['me'];
  if (profileId && profileId !== 'me' && profileId !== 'self') {
    profilesToTry.unshift(profileId);
  }

  let publishRes = null;
  let lastErr = null;

  const formattedTags = Array.isArray(tags)
    ? tags
    : (typeof tags === 'string' ? tags.split(',').map(t => t.trim()).filter(Boolean) : []);

  for (const prof of profilesToTry) {
    try {
      publishRes = await axios.post(`https://api.dailymotion.com/v2/profiles/${prof}/videos`, {
        title: videoTitle,
        visibility: 'public',
        category: 'lifestyle',
        is_for_kids: false,
        tags: formattedTags,
        source: {
          file_url: fileUrlToPublish
        }
      }, {
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });
      if (publishRes?.data) break;
    } catch (err) {
      lastErr = err;
    }
  }

  // Fallback: If direct URL registration failed for remote video URL, stream Cloudinary video into Dailymotion upload_session
  if (!publishRes && !isLocalFile && (videoUrl.startsWith('http://') || videoUrl.startsWith('https://'))) {
    logger.warn(`[Dailymotion] Direct file_url registration failed (${lastErr?.message}). Retrying via upload_session stream...`);
    try {
      const sessionRes = await axios.post('https://api.dailymotion.com/v2/files/upload_sessions', null, {
        headers: { Authorization: `Bearer ${token}` }
      });
      const uploadUrl = sessionRes.data.upload_url;
      if (uploadUrl) {
        const streamRes = await axios.get(videoUrl, { responseType: 'stream' });
        const form = new FormData();
        form.append('file', streamRes.data, 'dawah_video.mp4');

        const uploadRes = await axios.post(uploadUrl, form, {
          headers: form.getHeaders(),
          maxContentLength: Infinity,
          maxBodyLength: Infinity
        });

        const uploadedUrl = uploadRes.data.url || uploadRes.data.file;
        if (uploadedUrl) {
          for (const prof of profilesToTry) {
            try {
              publishRes = await axios.post(`https://api.dailymotion.com/v2/profiles/${prof}/videos`, {
                title: videoTitle,
                visibility: 'public',
                category: 'lifestyle',
                is_for_kids: false,
                tags: formattedTags,
                source: {
                  file_url: uploadedUrl
                }
              }, {
                headers: {
                  Authorization: `Bearer ${token}`,
                  'Content-Type': 'application/json'
                }
              });
              if (publishRes?.data) break;
            } catch (err) {
              lastErr = err;
            }
          }
        }
      }
    } catch (fallbackErr) {
      logger.error(`[Dailymotion] Fallback upload stream failed: ${fallbackErr.message}`);
    }
  }

  if (!publishRes) {
    const errObj = lastErr?.response?.data || lastErr?.message;
    throw new Error(`Dailymotion API Error: ${JSON.stringify(errObj)}`);
  }

  logger.info(`[Dailymotion] ✅ Video published successfully! Video ID: ${publishRes.data.id || JSON.stringify(publishRes.data)}`);
  return publishRes.data;
}

module.exports = { getVideoPath, uploadVideoToDailymotion };
