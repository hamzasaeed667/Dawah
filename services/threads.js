require('dotenv').config();
const axios = require('axios');
const logger = require('../utils/logger');

/**
 * Uploads an image (photo post) to Meta Threads via Threads Graph API.
 * Uses a 2-step process: Create Media Container -> Publish Media Container.
 *
 * @param {string} imageUrl - Public HTTP/HTTPS URL of the image.
 * @param {string} [caption] - Text caption for the Threads post.
 */
async function uploadImageToThreads(imageUrl, caption = '') {
  const threadsUserId = process.env.THREADS_USER_ID;
  const accessToken = process.env.THREADS_ACCESS_TOKEN;

  if (!threadsUserId || !accessToken) {
    throw new Error('Threads credentials (THREADS_USER_ID / THREADS_ACCESS_TOKEN) missing in .env');
  }

  logger.info(`[Threads] Step 1: Creating media container for URL: ${imageUrl}`);

  // Step 1: Create Threads Media Container
  const containerEndpoint = `https://graph.threads.net/v1.0/${threadsUserId}/threads`;
  
  try {
    const containerRes = await axios.post(containerEndpoint, null, {
      params: {
        media_type: 'IMAGE',
        image_url: imageUrl,
        text: caption.substring(0, 500), // Threads text character limit (500 chars)
        access_token: accessToken
      },
      timeout: 15000
    });

    const containerId = containerRes.data.id;
    logger.info(`[Threads] Container created successfully: ${containerId}. Step 2: Publishing...`);

    // Brief delay to allow Threads media container processing
    await new Promise((resolve) => setTimeout(resolve, 4000));

    // Step 2: Publish Threads Media Container
    const publishEndpoint = `https://graph.threads.net/v1.0/${threadsUserId}/threads_publish`;
    const publishRes = await axios.post(publishEndpoint, null, {
      params: {
        creation_id: containerId,
        access_token: accessToken
      },
      timeout: 15000
    });

    logger.info(`[Threads] ✅ Post published successfully. Media ID: ${publishRes.data.id}`);
    return publishRes.data;
  } catch (err) {
    const errorMsg = err.response?.data?.error?.message || err.response?.data || err.message;
    logger.error(`[Threads] Upload failed: ${JSON.stringify(errorMsg)}`);
    throw new Error(`Threads API Error: ${errorMsg}`);
  }
}

module.exports = { uploadImageToThreads };
