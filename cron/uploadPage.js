const platforms = require('../config/platforms');
const { getImageUrl, getImageBuffer } = require('../services/imageFetcher');
const { uploadImageToFacebook } = require('../services/facebook');
const { uploadImageToTelegram } = require('../services/telegram');
const { uploadImageToInstagram } = require('../services/instagram');
const { uploadImageToTwitter } = require('../services/twitter');
const { uploadImageToLinkedIn } = require('../services/linkedin');
const { uploadImageToTikTok } = require('../services/tiktok');
const { uploadImageToThreads } = require('../services/threads');
const { uploadImageToReddit } = require('../services/reddit');
const { uploadPinToPinterest } = require('../services/pinterest');
const { uploadVideoToDailymotion } = require('../services/dailymotion');
const { getState, advancePage } = require('../utils/stateManager');
const { retry } = require('../utils/retry');
const logger = require('../utils/logger');

// Curated rotation of high-ranking SEO captions and calls to action
const CAPTION_HOOKS = [
  '✨ Daily Spiritual Reflection & Wisdom',
  '📖 Important Lessons for Every Muslim',
  '💡 Key Insights from Islamic Teachings',
  '🌟 Nourishment for the Soul & Mind',
  '📜 Timeless Islamic Guidance & Knowledge',
  '🤲 Reminders That Benefit the Believer'
];

const CALL_TO_ACTIONS = [
  '📌 Save this post for your daily study!',
  '🔁 Share with friends and family to spread beneficial knowledge.',
  '💬 Comment your thoughts or reflections below.',
  '📲 Follow for daily pages and reflections.'
];

const HASHTAG_SETS = [
  '#Islam #IslamicReminders #Quran #Sunnah #IslamicQuotes',
  '#IslamicKnowledge #Deen #Dawah #Muslim #IslamicPost',
  '#Hadith #IslamicGuidance #ProphetMuhammad #AllahuAkbar #IslamicWisdom',
  '#DailyQuran #SpiritualGrowth #IslamicLife #Patience #Faith'
];

/**
 * Generates an SEO-optimized, highly engageable caption for a given page number.
 */
function generateOptimizedCaption(pageNo, maxPage) {
  const hook = CAPTION_HOOKS[pageNo % CAPTION_HOOKS.length];
  const cta = CALL_TO_ACTIONS[pageNo % CALL_TO_ACTIONS.length];
  const hashtags = HASHTAG_SETS[pageNo % HASHTAG_SETS.length];

  return `📖 Page ${pageNo} of ${maxPage} | "Purification of the Mind"\n\n${hook}\n\n${cta}\n\n${hashtags} #Page${pageNo} #Dawah`;
}

async function uploadCronTask() {
  const state = await getState();
  const pageNo = state.currentPage;
  const imageUrl = getImageUrl(pageNo);

  // Generate SEO and engagement-optimized caption
  const caption = generateOptimizedCaption(pageNo, state.maxPage);

  logger.info(`--------------------------------------------------`);
  logger.info(`🚀 Starting upload task for Page ${pageNo}/${state.maxPage}`);
  logger.info(`🖼️ GitHub Image URL: ${imageUrl}`);

  const uploads = [];
  const platformNames = [];

  // Helper for buffering image if needed by platforms like Twitter or LinkedIn
  let lazyBuffer = null;
  const getBuffer = async () => {
    if (!lazyBuffer) {
      lazyBuffer = await getImageBuffer(imageUrl);
    }
    return lazyBuffer;
  };

  // Facebook
  if (platforms.facebook) {
    platformNames.push('Facebook');
    uploads.push(retry(() => uploadImageToFacebook(imageUrl, caption)));
  }

  // Telegram
  if (platforms.telegram) {
    platformNames.push('Telegram');
    uploads.push(retry(() => uploadImageToTelegram(imageUrl, caption)));
  }

  // Instagram
  if (platforms.instagram) {
    platformNames.push('Instagram');
    uploads.push(retry(() => uploadImageToInstagram(imageUrl, caption)));
  }

  // Twitter
  if (platforms.twitter) {
    platformNames.push('Twitter');
    uploads.push(retry(async () => {
      const buffer = await getBuffer();
      return uploadImageToTwitter(buffer, caption);
    }));
  }

  // LinkedIn
  if (platforms.linkedin) {
    platformNames.push('LinkedIn');
    uploads.push(retry(async () => {
      const buffer = await getBuffer();
      return uploadImageToLinkedIn(buffer, caption);
    }));
  }

  // TikTok
  if (platforms.tiktok) {
    platformNames.push('TikTok');
    uploads.push(retry(() => uploadImageToTikTok(imageUrl, caption)));
  }

  // Threads
  if (platforms.threads) {
    platformNames.push('Threads');
    uploads.push(retry(() => uploadImageToThreads(imageUrl, caption)));
  }

  // Pinterest
  if (platforms.pinterest) {
    platformNames.push('Pinterest');
    uploads.push(retry(() => uploadPinToPinterest(imageUrl, `Page ${pageNo} | Purification of the Mind`, caption)));
  }

  // Reddit
  if (platforms.reddit) {
    platformNames.push('Reddit');
    uploads.push(retry(() => uploadImageToReddit(imageUrl, `Page ${pageNo} | "Purification of the Mind"`)));
  }

  if (uploads.length === 0) {
    logger.warn('⚠️ No social media platforms are currently enabled in config/platforms.js');
    return;
  }

  logger.info(`📡 Uploading concurrently to enabled platforms: ${platformNames.join(', ')}`);

  const results = await Promise.allSettled(uploads);

  let successCount = 0;
  let failCount = 0;

  const detailedResults = {};
  results.forEach((res, idx) => {
    const platform = platformNames[idx];
    if (res.status === 'fulfilled') {
      successCount++;
      detailedResults[platform] = { status: 'success' };
      logger.info(`  ✅ ${platform}: Success`);
    } else {
      failCount++;
      const errMsg = res.reason?.message || String(res.reason);
      detailedResults[platform] = { status: 'failed', error: errMsg };
      logger.error(`  ❌ ${platform}: Failed - ${errMsg}`);
    }
  });

  let newState = state;
  if (successCount > 0) {
    newState = await advancePage();
    logger.info(`🎉 Upload task complete! (${successCount} succeeded, ${failCount} failed).`);
    logger.info(`⏩ Page advanced to ${newState.currentPage}`);
  } else {
    logger.warn(`⚠️ All platform uploads failed. Page ${pageNo} will NOT be advanced and will be retried on next cron run.`);
  }

  logger.info(`--------------------------------------------------`);
  return { successCount, failCount, pageNo, nextPage: newState.currentPage, results: detailedResults };
}

module.exports = uploadCronTask;
