require('dotenv').config();
const fs = require('fs');
const path = require('path');
const axios = require('axios');
const logger = require('../utils/logger');

/**
 * Uploads an image (photo post) to TikTok via TikTok Content Posting API v2.
 *
 * @param {string} imageUrl - Public HTTP/HTTPS URL of the image.
 * @param {string} [caption] - Optional title/caption for the photo post.
 */
async function uploadImageToTikTok(imageUrl, caption = '') {
  const accessToken = process.env.TIKTOK_ACCESS_TOKEN;

  if (!accessToken) {
    throw new Error('TikTok credential (TIKTOK_ACCESS_TOKEN) missing in .env');
  }

  logger.info(`[TikTok] Initiating photo post publish for image: ${imageUrl}`);

  const endpoint = 'https://open.tiktokapis.com/v2/post/publish/content/init/';
  
  const payload = {
    post_info: {
      title: caption.substring(0, 2200),
      privacy_level: 'PUBLIC_TO_EVERYONE',
      disable_comment: false,
      auto_add_music: true
    },
    source_info: {
      source: 'PULL_FROM_URL',
      photo_cover_index: 1,
      photo_images: [
        imageUrl
      ]
    },
    post_mode: 'DIRECT_POST',
    media_type: 'PHOTO'
  };

  try {
    const response = await axios.post(endpoint, payload, {
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json; charset=UTF-8'
      },
      timeout: 15000
    });

    const data = response.data;
    if (data.error && data.error.code !== 'ok') {
      throw new Error(`TikTok API error [${data.error.code}]: ${data.error.message}`);
    }

    const publishId = data.data?.publish_id;
    logger.info(`[TikTok] ✅ Photo post initialized successfully. Publish ID: ${publishId}`);
    return data.data;
  } catch (err) {
    const errorMsg = err.response?.data?.error?.message || err.response?.data || err.message;
    logger.error(`[TikTok] Upload failed: ${JSON.stringify(errorMsg)}`);
    throw new Error(`TikTok Error: ${errorMsg}`);
  }
}

/**
 * Queries creator information from TikTok Content Posting API v2.
 * TikTok requires apps to query creator info prior to post initialization.
 *
 * @param {string} accessToken
 * @returns {Promise<object>}
 */
async function queryCreatorInfo(accessToken) {
  const endpoint = 'https://open.tiktokapis.com/v2/post/publish/creator_info/query/';
  try {
    const res = await axios.post(endpoint, {}, {
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json; charset=UTF-8'
      },
      timeout: 15000
    });
    if (res.data?.error && res.data.error.code === 'ok') {
      return res.data.data;
    }
    return null;
  } catch (err) {
    logger.warn(`[TikTok] Silent creator info query warning: ${err.response?.data?.error?.message || err.message}`);
    return null;
  }
}

/**
 * Uploads a video to TikTok via TikTok Content Posting API v2 using FILE_UPLOAD mode.
 * Downloads video locally if URL is provided, bypassing domain verification restrictions.
 *
 * @param {string} videoInput - Local file path OR HTTP/HTTPS URL of the video (e.g. Cloudinary URL).
 * @param {string} [caption] - Optional title/caption for the video post.
 * @param {string} [privacyLevel] - Desired privacy level.
 * @param {string} [postMode] - Post mode (MEDIA_UPLOAD or DIRECT_POST).
 * @returns {Promise<object>}
 */
async function uploadVideoToTikTok(videoInput, caption = '', privacyLevel = 'PUBLIC_TO_EVERYONE', postMode = 'MEDIA_UPLOAD') {
  const accessToken = process.env.TIKTOK_ACCESS_TOKEN;

  if (!accessToken) {
    throw new Error('TikTok credential (TIKTOK_ACCESS_TOKEN) missing in .env');
  }

  // Perform silent creator info query first
  const creatorInfo = await queryCreatorInfo(accessToken);
  if (creatorInfo) {
    logger.info(`[TikTok] Creator verified: @${creatorInfo.creator_username} (${creatorInfo.creator_nickname})`);
  }

  let videoBuffer;
  let tempFilePath = null;

  try {
    if (videoInput.startsWith('http://') || videoInput.startsWith('https://')) {
      const outputDir = path.resolve(__dirname, '../output');
      if (!fs.existsSync(outputDir)) {
        fs.mkdirSync(outputDir, { recursive: true });
      }
      tempFilePath = path.join(outputDir, `temp_tiktok_${Date.now()}.mp4`);
      logger.info(`[TikTok] Downloading video from direct link: ${videoInput} to local file: ${tempFilePath}`);

      const writer = fs.createWriteStream(tempFilePath);
      const downloadRes = await axios({
        url: videoInput,
        method: 'GET',
        responseType: 'stream',
        timeout: 60000
      });

      await new Promise((resolve, reject) => {
        downloadRes.data.pipe(writer);
        writer.on('finish', resolve);
        writer.on('error', reject);
      });

      const stats = fs.statSync(tempFilePath);
      logger.info(`[TikTok] Downloaded video successfully to local file (${(stats.size / 1024 / 1024).toFixed(2)} MB).`);
      videoBuffer = fs.readFileSync(tempFilePath);
    } else {
      const resolvedPath = path.resolve(videoInput);
      logger.info(`[TikTok] Reading local video file: ${resolvedPath}`);
      videoBuffer = fs.readFileSync(resolvedPath);
    }

    const videoSize = videoBuffer.length;
    logger.info(`[TikTok] Initiating FILE_UPLOAD video post publish (Size: ${videoSize} bytes, Mode: ${postMode}, Privacy: ${privacyLevel})...`);

    const initEndpoint = 'https://open.tiktokapis.com/v2/post/publish/video/init/';

    const payload = {
      post_info: {
        title: caption.substring(0, 2200),
        privacy_level: privacyLevel,
        disable_comment: false,
        disable_duet: false,
        disable_stitch: false
      },
      source_info: {
        source: 'FILE_UPLOAD',
        video_size: videoSize,
        chunk_size: videoSize,
        total_chunk_count: 1
      },
      post_mode: postMode
    };

    // Step 1: Initialize publish request to obtain upload_url
    const initRes = await axios.post(initEndpoint, payload, {
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json; charset=UTF-8'
      },
      timeout: 30000
    });

    const initData = initRes.data;
    if (initData.error && initData.error.code !== 'ok') {
      throw new Error(`TikTok Init Error [${initData.error.code}]: ${initData.error.message}`);
    }

    const publishId = initData.data?.publish_id;
    const uploadUrl = initData.data?.upload_url;

    if (!uploadUrl) {
      throw new Error(`TikTok Init Response missing upload_url: ${JSON.stringify(initData)}`);
    }

    logger.info(`[TikTok] ✅ Publish initialized. Publish ID: ${publishId}. Uploading binary video file...`);

    // Step 2: Upload raw video binary buffer directly to TikTok's upload_url
    await axios.put(uploadUrl, videoBuffer, {
      headers: {
        'Content-Type': 'video/mp4',
        'Content-Length': videoSize,
        'Content-Range': `bytes 0-${videoSize - 1}/${videoSize}`
      },
      maxBodyLength: Infinity,
      maxContentLength: Infinity,
      timeout: 120000
    });

    logger.info(`[TikTok] 🎉 Video uploaded successfully! Publish ID: ${publishId}`);
    return { publish_id: publishId, status: 'UPLOAD_SUCCESS' };
  } catch (err) {
    const errorMsg = err.response?.data?.error?.message || err.response?.data || err.message;
    logger.error(`[TikTok] Direct video upload failed: ${JSON.stringify(errorMsg)}`);
    throw new Error(`TikTok Error: ${typeof errorMsg === 'object' ? JSON.stringify(errorMsg) : errorMsg}`);
  } finally {
    if (tempFilePath && fs.existsSync(tempFilePath)) {
      try {
        fs.unlinkSync(tempFilePath);
        logger.info(`[TikTok] 🗑️ Deleted temporary local video file: ${tempFilePath}`);
      } catch (cleanupErr) {
        logger.warn(`[TikTok] Failed to delete temporary file ${tempFilePath}: ${cleanupErr.message}`);
      }
    }
  }
}

module.exports = {
  queryCreatorInfo,
  uploadImageToTikTok,
  uploadVideoToTikTok
};
