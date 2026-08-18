const path = require('path');
const fs = require('fs');
const logger = require('../utils/logger');

const CLOUDINARY_VIDEOS_PATH = process.env.CLOUDINARY_VIDEOS_PATH || path.join(__dirname, '../cloudinary_videos.json');
const EXTERNAL_FALLBACK_PATH = '/Users/mac/Desktop/Hamza/Projects/DawahImages/cloudinary_videos.json';

let cloudinaryVideosData = null;

/**
 * Loads and caches the video mapping from cloudinary_videos.json.
 * @returns {object}
 */
function loadCloudinaryVideos() {
  if (!cloudinaryVideosData) {
    const targetPath = fs.existsSync(CLOUDINARY_VIDEOS_PATH)
      ? CLOUDINARY_VIDEOS_PATH
      : (fs.existsSync(EXTERNAL_FALLBACK_PATH) ? EXTERNAL_FALLBACK_PATH : null);

    if (targetPath) {
      try {
        const rawData = fs.readFileSync(targetPath, 'utf8');
        cloudinaryVideosData = JSON.parse(rawData);
      } catch (err) {
        logger.error(`Error parsing ${targetPath}:`, err.message);
        cloudinaryVideosData = {};
      }
    } else {
      logger.error(`cloudinary_videos.json file not found at ${CLOUDINARY_VIDEOS_PATH} or ${EXTERNAL_FALLBACK_PATH}`);
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
  const rawKey = String(pageNo);
  const paddedPage = String(pageNo).padStart(3, '0');
  const videoObj = videos[rawKey] || videos[paddedPage] || videos[Number(pageNo)];

  if (!videoObj || !videoObj.download_url) {
    throw new Error(`Cloudinary video URL for video page ${pageNo} not found in cloudinary_videos.json`);
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
  const rawKey = String(pageNo);
  const paddedPage = String(pageNo).padStart(3, '0');
  return videos[rawKey] || videos[paddedPage] || videos[Number(pageNo)] || null;
}

/**
 * Returns the total number of videos configured in cloudinary_videos.json.
 *
 * @returns {number}
 */
function getTotalVideos() {
  const videos = loadCloudinaryVideos();
  return Object.keys(videos).length;
}

module.exports = {
  getVideoUrl,
  getVideoData,
  getTotalVideos,
  loadCloudinaryVideos
};
