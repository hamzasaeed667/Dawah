const axios = require('axios');
const logger = require('../utils/logger');
require('dotenv').config();

const USER_AGENT = 'DawahBot:v1.0.0 (by /u/' + (process.env.REDDIT_USERNAME || 'dawah_bot') + ')';

/**
 * Obtains an OAuth Access Token from Reddit API.
 * Supports password grant, refresh token grant, or client credentials.
 *
 * @returns {Promise<string>}
 */
async function getRedditAccessToken() {
  if (process.env.REDDIT_ACCESS_TOKEN) {
    return process.env.REDDIT_ACCESS_TOKEN;
  }

  const clientId = process.env.REDDIT_CLIENT_ID;
  const clientSecret = process.env.REDDIT_CLIENT_SECRET;
  const username = process.env.REDDIT_USERNAME;
  const password = process.env.REDDIT_PASSWORD;
  const refreshToken = process.env.REDDIT_REFRESH_TOKEN;

  if (!clientId || !clientSecret) {
    throw new Error('Reddit credentials (REDDIT_CLIENT_ID / REDDIT_CLIENT_SECRET) missing in .env');
  }

  const authHeader = 'Basic ' + Buffer.from(`${clientId}:${clientSecret}`).toString('base64');

  if (refreshToken) {
    logger.info('[Reddit] Requesting OAuth access token via refresh_token grant...');
    const params = new URLSearchParams({
      grant_type: 'refresh_token',
      refresh_token: refreshToken
    });

    const res = await axios.post('https://www.reddit.com/api/v1/access_token', params.toString(), {
      headers: {
        Authorization: authHeader,
        'Content-Type': 'application/x-www-form-urlencoded',
        'User-Agent': USER_AGENT
      }
    });

    if (res.data?.access_token) {
      return res.data.access_token;
    }
  }

  if (username && password) {
    logger.info('[Reddit] Requesting OAuth access token via password grant...');
    const params = new URLSearchParams({
      grant_type: 'password',
      username: username,
      password: password
    });

    const res = await axios.post('https://www.reddit.com/api/v1/access_token', params.toString(), {
      headers: {
        Authorization: authHeader,
        'Content-Type': 'application/x-www-form-urlencoded',
        'User-Agent': USER_AGENT
      }
    });

    if (res.data?.access_token) {
      return res.data.access_token;
    }
  }

  throw new Error('Reddit OAuth requires REDDIT_REFRESH_TOKEN or REDDIT_USERNAME & REDDIT_PASSWORD in .env');
}

/**
 * Uploads/Submits an image post to Reddit.
 *
 * @param {string} imageUrl - Public HTTP/HTTPS URL of the image.
 * @param {string} [title] - Post title.
 * @param {string} [subreddit] - Target subreddit name (e.g. "IslamicQuotes" or user profile "u_username").
 * @returns {Promise<object>}
 */
async function uploadImageToReddit(imageUrl, title = '', subreddit = process.env.REDDIT_SUBREDDIT) {
  const targetSubreddit = subreddit || process.env.REDDIT_SUBREDDIT || 'dawah';

  logger.info(`[Reddit] Step 1: Requesting OAuth access token...`);
  const accessToken = await getRedditAccessToken();

  logger.info(`[Reddit] Step 2: Submitting post to r/${targetSubreddit} for URL: ${imageUrl}`);
  const postTitle = title || 'Dawah Book Page Reflection';

  const params = new URLSearchParams({
    sr: targetSubreddit.replace(/^r\//, '').replace(/^u\//, 'u_'),
    kind: 'link',
    title: postTitle,
    url: imageUrl,
    resubmit: 'true',
    api_type: 'json'
  });

  const res = await axios.post('https://oauth.reddit.com/api/submit', params.toString(), {
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/x-www-form-urlencoded',
      'User-Agent': USER_AGENT
    }
  });

  const jsonRes = res.data?.json;
  if (jsonRes?.errors && jsonRes.errors.length > 0) {
    const errDetails = JSON.stringify(jsonRes.errors);
    logger.error(`[Reddit] Submit error: ${errDetails}`);
    throw new Error(`Reddit API Error: ${errDetails}`);
  }

  const postData = jsonRes?.data || res.data;
  logger.info(`[Reddit] ✅ Post published successfully! Link: ${postData.url || postData.id || 'Submitted'}`);
  return postData;
}

module.exports = { getRedditAccessToken, uploadImageToReddit };
