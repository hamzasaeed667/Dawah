require('dotenv').config();
const axios = require('axios');
const logger = require('../utils/logger');

/**
 * Sends a photo to a Telegram channel/chat using Bot API.
 *
 * @param {string} imageUrl - Public HTTP/HTTPS URL of the image.
 * @param {string} [caption] - Optional caption text.
 */
async function uploadImageToTelegram(imageUrl, caption = '') {
  const botToken = process.env.TELEGRAM_BOT_TOKEN;
  const chatId = process.env.TELEGRAM_CHAT_ID;

  if (!botToken || !chatId) {
    throw new Error('Telegram credentials (TELEGRAM_BOT_TOKEN / TELEGRAM_CHAT_ID) missing in .env');
  }

  logger.info(`[Telegram] Sending photo to chat ${chatId}: ${imageUrl}`);

  const endpoint = `https://api.telegram.org/bot${botToken}/sendPhoto`;

  try {
    const response = await axios.post(
      endpoint,
      {
        chat_id: chatId,
        photo: imageUrl,
        caption: caption
      },
      {
        timeout: 10000 // 10 second timeout for network requests
      }
    );

    logger.info(`[Telegram] ✅ Photo sent successfully. Message ID: ${response.data.result?.message_id}`);
    return response.data;
  } catch (err) {
    const errorMsg = err.response?.data?.description || err.response?.data || err.message;
    logger.error(`[Telegram] Send photo failed: ${JSON.stringify(errorMsg)}`);
    throw new Error(`Telegram API Error: ${errorMsg}`);
  }
}

module.exports = { uploadImageToTelegram };
