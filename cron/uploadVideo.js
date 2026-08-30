const platforms = require('../config/platforms');
const { uploadVideoToDailymotion, getVideoPath } = require('../services/dailymotion');
const { uploadVideoToTikTok } = require('../services/tiktok');
const { uploadVideoViaBrowser } = require('../services/tiktokBrowser');
const { uploadVideoToFacebook } = require('../services/facebook');
const { getVideoUrl } = require('../services/videoFetcher');
const { getVideoState, advanceVideoPage } = require('../utils/videoStateManager');
const { retry } = require('../utils/retry');
const logger = require('../utils/logger');
const fs = require('fs');

// SEO titles and descriptions for video uploads
const VIDEO_HOOKS = [
  '✨ Daily Video Reflection | Spiritual Wisdom',
  '📖 Powerful Lessons for Every Muslim',
  '💡 Key Insights from Islamic Teachings',
  '🌟 Nourishment for the Soul & Mind',
  '📜 Timeless Islamic Guidance'
];

function generateVideoTitle(videoPageNo, maxPage) {
  const hook = VIDEO_HOOKS[videoPageNo % VIDEO_HOOKS.length];
  return `Page ${videoPageNo} of ${maxPage} | ${hook}`;
}

async function uploadTikTokWithFallback(videoUrl, title) {
  try {
    return await uploadVideoToTikTok(videoUrl, title);
  } catch (apiErr) {
    logger.warn(`[TikTok Cron] API direct post unavailable (${apiErr.message}). Switching to TikTok Studio Browser Automation...`);
    return await uploadVideoViaBrowser(videoUrl, title, { headless: true });
  }
}

async function uploadVideoCronTask() {
  const state = await getVideoState();
  const videoPageNo = state.currentVideoPage;
  const videoPath = getVideoPath(videoPageNo);

  let videoUrl = null;
  try {
    videoUrl = getVideoUrl(videoPageNo);
  } catch (err) {
    logger.warn(`[VideoFetcher] ${err.message}`);
  }

  logger.info(`--------------------------------------------------`);
  logger.info(`🎥 Starting Video Upload Task for Video Page ${videoPageNo}/${state.maxPage}`);
  if (videoUrl) logger.info(`🔗 Cloudinary Video URL: ${videoUrl}`);
  if (videoPath) logger.info(`📁 Local Video Path: ${videoPath}`);

  const title = generateVideoTitle(videoPageNo, state.maxPage);
  const tags = 'dawah,islam,reflection,quran,wisdom';

  const uploads = [];
  const platformNames = [];

  // Facebook Video (uses Cloudinary video URL from cloudinary_videos.json, or local file fallback)
  if (platforms.facebook) {
    if (videoUrl) {
      platformNames.push('Facebook');
      uploads.push(retry(() => uploadVideoToFacebook(videoUrl, title, title)));
    } else if (fs.existsSync(videoPath)) {
      platformNames.push('Facebook');
      uploads.push(retry(() => uploadVideoToFacebook(videoPath, title, title)));
    } else {
      logger.warn(`⚠️ Neither Cloudinary video URL nor local file found for Facebook video page ${videoPageNo}. Skipping Facebook video upload.`);
    }
  }

  // Dailymotion Video (uses Cloudinary video URL from cloudinary_videos.json, or local file fallback)
  if (platforms.dailymotion) {
    if (videoUrl) {
      platformNames.push('Dailymotion');
      uploads.push(retry(() => uploadVideoToDailymotion(videoUrl, title, tags)));
    } else if (fs.existsSync(videoPath)) {
      platformNames.push('Dailymotion');
      uploads.push(retry(() => uploadVideoToDailymotion(videoPath, title, tags)));
    } else {
      logger.warn(`⚠️ Neither Cloudinary video URL nor local file found for Dailymotion video page ${videoPageNo}. Skipping Dailymotion upload.`);
    }
  }

  // TikTok Video (uses Cloudinary video URL or local video path, falls back to Browser Automation if API app unapproved)
  if (platforms.tiktok) {
    const targetVideo = videoUrl || (fs.existsSync(videoPath) ? videoPath : null);
    if (targetVideo) {
      platformNames.push('TikTok');
      uploads.push(retry(() => uploadTikTokWithFallback(targetVideo, title)));
    } else {
      logger.warn(`⚠️ Neither Cloudinary video URL nor local file found for TikTok video page ${videoPageNo}. Skipping TikTok upload.`);
    }
  }

  if (uploads.length === 0) {
    logger.warn('⚠️ No video platforms are currently enabled in config/platforms.js');
    return;
  }

  logger.info(`📡 Uploading video concurrently to enabled platforms: ${platformNames.join(', ')}`);

  const results = await Promise.allSettled(uploads);

  let successCount = 0;
  let failCount = 0;

  const detailedResults = {};
  results.forEach((res, idx) => {
    const platform = platformNames[idx];
    if (res.status === 'fulfilled') {
      successCount++;
      detailedResults[platform] = { status: 'success' };
      logger.info(`  ✅ Video Upload [${platform}]: Success`);
    } else {
      failCount++;
      const errMsg = res.reason?.message || String(res.reason);
      detailedResults[platform] = { status: 'failed', error: errMsg };
      logger.error(`  ❌ Video Upload [${platform}]: Failed - ${errMsg}`);
    }
  });

  let newState = state;
  if (successCount > 0) {
    newState = await advanceVideoPage();
    logger.info(`🎉 Video upload task complete! (${successCount} succeeded, ${failCount} failed).`);
    logger.info(`⏩ Video page advanced to ${newState.currentVideoPage}`);
  } else {
    logger.warn(`⚠️ All video platform uploads failed. Video page ${videoPageNo} will NOT be advanced.`);
  }

  logger.info(`--------------------------------------------------`);
  return { successCount, failCount, videoPageNo, nextPage: newState.currentVideoPage, results: detailedResults };
}

module.exports = uploadVideoCronTask;
