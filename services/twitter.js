require('dotenv').config();
const { TwitterApi } = require('twitter-api-v2');
const logger = require('../utils/logger');

/**
 * Uploads image buffer to Twitter (v1.1 media upload) and posts a tweet (v2 API).
 *
 * @param {Buffer} imageBuffer - Binary buffer of the image.
 * @param {string} [caption] - Tweet text.
 */
async function uploadImageToTwitter(imageBuffer, caption = '') {
  const apiKey = process.env.TWITTER_API_KEY;
  const apiSecret = process.env.TWITTER_API_SECRET;
  const accessToken = process.env.TWITTER_ACCESS_TOKEN;
  const accessSecret = process.env.TWITTER_ACCESS_SECRET;

  if (!apiKey || !apiSecret || !accessToken || !accessSecret) {
    throw new Error('Twitter credentials (TWITTER_API_KEY, TWITTER_API_SECRET, TWITTER_ACCESS_TOKEN, TWITTER_ACCESS_SECRET) missing in .env');
  }

  logger.info(`[Twitter] Initializing Twitter API client...`);
  const client = new TwitterApi({
    appKey: apiKey,
    appSecret: apiSecret,
    accessToken: accessToken,
    accessSecret: accessSecret,
  });

  logger.info(`[Twitter] Uploading image buffer (${imageBuffer.length} bytes)...`);
  const mediaId = await client.v1.uploadMedia(imageBuffer, { mimeType: 'image/jpeg' });
  logger.info(`[Twitter] Media uploaded successfully (Media ID: ${mediaId}).`);

  logger.info(`[Twitter] Posting tweet...`);
  const tweet = await client.v2.tweet({
    text: caption,
    media: { media_ids: [mediaId] }
  });

  logger.info(`[Twitter] Tweet posted successfully (Tweet ID: ${tweet.data.id}).`);
  return tweet.data;
}

module.exports = { uploadImageToTwitter };

