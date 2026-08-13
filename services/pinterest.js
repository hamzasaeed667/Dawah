require('dotenv').config();
const axios = require('axios');
const logger = require('../utils/logger');
const { getImageBuffer } = require('./imageFetcher');

/**
 * Creates a Pin on Pinterest (v5 API).
 *
 * @param {string} imageUrl - Public image URL or image data.
 * @param {string} [title] - Pin title.
 * @param {string} [description] - Pin description.
 * @param {string} [boardId] - Pinterest Board ID.
 * @returns {Promise<object>}
 */
async function uploadPinToPinterest(imageUrl, title = '', description = '', boardId = process.env.PIN_BOARD_ID) {
  const accessToken = process.env.PIN_APP_ACCESS_TOKEN;

  if (!accessToken) {
    throw new Error('Pinterest access token (PIN_APP_ACCESS_TOKEN) missing in .env');
  }

  if (!boardId) {
    throw new Error('Pinterest board ID (PIN_BOARD_ID) missing in .env');
  }

  logger.info(`[Pinterest] Creating Pin for board: ${boardId}`);

  const payload = {
    board_id: boardId,
    title: title || 'Dawah Book Page',
    description: description,
    media_source: {
      source_type: 'image_url',
      url: imageUrl
    }
  };

  try {
    const res = await axios.post('https://api.pinterest.com/v5/pins', payload, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json'
      }
    });

    logger.info(`[Pinterest] ✅ Pin created successfully. Pin ID: ${res.data.id}`);
    return res.data;
  } catch (err) {
    const errObj = err.response?.data || err.message;
    logger.error(`[Pinterest] Upload failed:`, JSON.stringify(errObj));
    throw new Error(`Pinterest API Error: ${errObj.message || JSON.stringify(errObj)}`);
  }
}

module.exports = { uploadPinToPinterest };
