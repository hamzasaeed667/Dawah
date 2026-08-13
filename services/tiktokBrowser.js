const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');
const axios = require('axios');
const logger = require('../utils/logger');

const USER_DATA_DIR = path.resolve(__dirname, '../tiktok_user_data');

/**
 * Downloads a video from URL to local disk.
 */
async function downloadVideoToLocal(url, targetPath) {
  const writer = fs.createWriteStream(targetPath);
  const response = await axios({
    url,
    method: 'GET',
    responseType: 'stream',
    timeout: 60000
  });

  await new Promise((resolve, reject) => {
    response.data.pipe(writer);
    writer.on('finish', resolve);
    writer.on('error', reject);
  });
}

/**
 * Uploads video directly to TikTok via TikTok Studio web interface using Playwright browser automation.
 * Completely bypasses TikTok Developer API App audit approval restrictions.
 *
 * @param {string} videoInput - Local file path OR HTTP/HTTPS direct video URL.
 * @param {string} caption - Video caption/title.
 * @param {object} options - Configuration options (headless: boolean).
 */
async function uploadVideoViaBrowser(videoInput, caption = '', options = { headless: false }) {
  let localFilePath = videoInput;
  let isTemp = false;

  const outputDir = path.resolve(__dirname, '../output');
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }

  if (videoInput.startsWith('http://') || videoInput.startsWith('https://')) {
    localFilePath = path.join(outputDir, `temp_tiktok_browser_${Date.now()}.mp4`);
    isTemp = true;
    logger.info(`[TikTokBrowser] Downloading video from direct link: ${videoInput}...`);
    await downloadVideoToLocal(videoInput, localFilePath);
    logger.info(`[TikTokBrowser] Video downloaded to ${localFilePath}`);
  } else {
    localFilePath = path.resolve(videoInput);
  }

  if (!fs.existsSync(USER_DATA_DIR)) {
    fs.mkdirSync(USER_DATA_DIR, { recursive: true });
  }

  logger.info(`[TikTokBrowser] Launching browser session using persistent profile: ${USER_DATA_DIR}`);

  const context = await chromium.launchPersistentContext(USER_DATA_DIR, {
    headless: options.headless,
    viewport: { width: 1280, height: 800 },
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-blink-features=AutomationControlled']
  });

  const page = context.pages()[0] || await context.newPage();

  try {
    logger.info('[TikTokBrowser] Navigating to TikTok Studio Upload page...');
    await page.goto('https://www.tiktok.com/tiktokstudio/upload', { waitUntil: 'domcontentloaded', timeout: 60000 });

    await page.waitForTimeout(3000);

    // Check if redirected to login page
    const currentUrl = page.url();
    if (currentUrl.includes('/login') || currentUrl.includes('/auth')) {
      logger.warn('[TikTokBrowser] ⚠️ Not logged in to TikTok Studio! Please log in in the opened browser window.');
      if (options.headless) {
        throw new Error('TikTok session not logged in. Please run in headed mode (headless: false) once to complete TikTok login.');
      }
      logger.info('[TikTokBrowser] Waiting up to 120 seconds for manual login in browser window...');
      await page.waitForURL('**/tiktokstudio/upload**', { timeout: 120000 });
      logger.info('[TikTokBrowser] ✅ TikTok Login detected! Proceeding with upload...');
    }

    logger.info(`[TikTokBrowser] Uploading video file: ${localFilePath}`);

    // Wait for file input element or iframe file upload container
    const fileInputSelector = 'input[type="file"]';
    await page.waitForSelector(fileInputSelector, { timeout: 30000 });

    const fileInput = await page.$(fileInputSelector);
    await fileInput.setInputFiles(localFilePath);

    logger.info('[TikTokBrowser] File submitted to browser uploader. Waiting for video processing...');
    await page.waitForTimeout(8000);

    // Handle Caption input
    if (caption) {
      logger.info(`[TikTokBrowser] Entering video caption: "${caption.substring(0, 50)}..."`);
      const captionSelector = '.notranslate[contenteditable="true"], div[contenteditable="true"], textarea';
      try {
        await page.waitForSelector(captionSelector, { timeout: 10000 });
        await page.click(captionSelector);
        // Select all existing text and replace with caption
        await page.keyboard.press('Meta+A');
        await page.keyboard.press('Control+A');
        await page.keyboard.press('Backspace');
        await page.type(captionSelector, caption);
      } catch (capErr) {
        logger.warn(`[TikTokBrowser] Could not set caption automatically: ${capErr.message}`);
      }
    }

    // Wait for "Post" / "Publish" button to be enabled
    logger.info('[TikTokBrowser] Looking for Post button...');
    const postButtonSelector = 'button:has-text("Post"), button:has-text("Publish")';
    await page.waitForSelector(postButtonSelector, { timeout: 30000 });

    const postBtn = await page.$(postButtonSelector);
    if (postBtn) {
      await postBtn.click();
      logger.info('[TikTokBrowser] 🚀 Clicked Post button! Waiting for confirmation...');
      await page.waitForTimeout(10000);
      logger.info('[TikTokBrowser] 🎉 Video upload submitted via browser automation!');
    } else {
      throw new Error('Could not find Post button on TikTok Studio page.');
    }

    return { status: 'SUCCESS', method: 'BROWSER_AUTOMATION' };
  } catch (err) {
    logger.error(`[TikTokBrowser] Upload failed: ${err.message}`);
    throw err;
  } finally {
    await context.close();
    if (isTemp && fs.existsSync(localFilePath)) {
      try {
        fs.unlinkSync(localFilePath);
        logger.info(`[TikTokBrowser] 🗑️ Deleted temporary video file: ${localFilePath}`);
      } catch (delErr) {
        logger.warn(`[TikTokBrowser] Failed to delete temp file ${localFilePath}: ${delErr.message}`);
      }
    }
  }
}

module.exports = {
  uploadVideoViaBrowser
};
