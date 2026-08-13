const axios = require('axios');
const logger = require('../utils/logger');

const BASE_RAW_URL = 'https://raw.githubusercontent.com/hamzasaeed667/DawahImages/main/images';

/**
 * Constructs the raw GitHub image URL for a given page number.
 * e.g., page 1 -> https://raw.githubusercontent.com/hamzasaeed667/DawahImages/main/images/001.jpg
 *
 * @param {number} pageNo
 * @returns {string}
 */
function getImageUrl(pageNo) {
  const paddedPage = String(pageNo).padStart(3, '0');
  return `${BASE_RAW_URL}/${paddedPage}.jpg`;
}

/**
 * Downloads image binary content as a Buffer.
 * Useful for platforms (like Twitter, LinkedIn) that require direct binary uploads.
 *
 * @param {string} imageUrl
 * @returns {Promise<Buffer>}
 */
async function getImageBuffer(imageUrl) {
  try {
    const response = await axios.get(imageUrl, { responseType: 'arraybuffer' });
    return Buffer.from(response.data);
  } catch (err) {
    logger.error(`Failed to fetch image buffer from ${imageUrl}:`, err.message);
    throw new Error(`Image fetch failed for ${imageUrl}`);
  }
}

module.exports = {
  getImageUrl,
  getImageBuffer
};
