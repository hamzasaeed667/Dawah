const path = require('path');
const fs = require('fs');
const logger = require('../utils/logger');

const CLOUDINARY_VIDEOS_PATH = path.join(__dirname, '../cloudinary_videos.json');

let cloudinaryVideosData = null;

/**
 * Loads and caches the video mapping from cloudinary_videos.json.
 * @returns {object}
 */
function loadCloudinaryVideos() {
  if (!cloudinaryVideosData) {
    if (fs.existsSync(CLOUDINARY_VIDEOS_PATH)) {
      try {
        const rawData = fs.readFileSync(CLOUDINARY_VIDEOS_PATH, 'utf8');
        cloudinaryVideosData = JSON.parse(rawData);
      } catch (err) {
        logger.error(`Error parsing ${CLOUDINARY_VIDEOS_PATH}:`, err.message);
        cloudinaryVideosData = {};
      }
    } else {
      logger.error(`cloudinary_videos.json file not found at ${CLOUDINARY_VIDEOS_PATH}`);
      cloudinaryVideosData = {};
    }
  }
  return cloudinaryVideosData;
}

/**
 * Retrieves the Cloudinary download URL for a given video page number.
 * e.g., page 1 -> padded key "001" -> download_url
 *
 * @param {number|string} pageNo
 * @returns {string} downloadUrl
 */
function getVideoUrl(pageNo) {
  const videos = loadCloudinaryVideos();
  const paddedPage = String(pageNo).padStart(3, '0');
  const videoObj = videos[paddedPage];

  if (!videoObj || !videoObj.download_url) {
    throw new Error(`Cloudinary video URL for video page ${pageNo} ("${paddedPage}") not found in cloudinary_videos.json`);
  }

  return videoObj.download_url;
}

/**
 * Retrieves the complete Cloudinary video object for a given video page number.
 *
 * @param {number|string} pageNo
 * @returns {object|null}
 */
function getVideoData(pageNo) {
  const videos = loadCloudinaryVideos();
  const paddedPage = String(pageNo).padStart(3, '0');
  return videos[paddedPage] || null;
}

module.exports = {
  getVideoUrl,
  getVideoData
};
