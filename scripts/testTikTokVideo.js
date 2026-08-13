require('dotenv').config();
const fs = require('fs');
const path = require('path');
const axios = require('axios');
const { getVideoUrl } = require('../services/videoFetcher');
const { uploadVideoToTikTok } = require('../services/tiktok');
const logger = require('../utils/logger');

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

async function testTikTokVideoUpload() {
  const videoPageNo = 1;
  const outputDir = path.resolve(__dirname, '../output');
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }

  const localFilePath = path.join(outputDir, `test_tiktok_video_${videoPageNo}.mp4`);

  try {
    const videoUrl = getVideoUrl(videoPageNo);
    logger.info(`🔗 Fetched Cloudinary Direct Video URL for page ${videoPageNo}: ${videoUrl}`);

    // Step 1: Download video from direct link to local storage
    logger.info(`📥 Downloading video from direct link to local path: ${localFilePath}...`);
    await downloadVideoToLocal(videoUrl, localFilePath);

    const stats = fs.statSync(localFilePath);
    logger.info(`✅ Video downloaded successfully to local disk! Size: ${(stats.size / (1024 * 1024)).toFixed(2)} MB`);

    const caption = `🎥 Test Video Post - Page ${videoPageNo}\n\n#Dawah #IslamicVideo #Reflection #TikTok`;

    // Step 2: Upload local video file to TikTok
    logger.info('🚀 Uploading downloaded local video file to TikTok (Option 3: SELF_ONLY)...');
    const result = await uploadVideoToTikTok(localFilePath, caption, 'SELF_ONLY', 'DIRECT_POST');
    logger.info('🎉 TikTok Video Uploaded Successfully (SELF_ONLY)!');
    console.log('Result:', result);
  } catch (error) {
    logger.error('❌ TikTok Video Test Failed:', error.message);
    if (error.code) console.error('Error Code:', error.code);
    if (error.data) console.error('API Error Data:', JSON.stringify(error.data, null, 2));
    console.error('Full Error:', error);
  } finally {
    // Step 3: Delete the local video file
    if (fs.existsSync(localFilePath)) {
      try {
        fs.unlinkSync(localFilePath);
        logger.info(`🗑️ Deleted local video file: ${localFilePath}`);
      } catch (delErr) {
        logger.error(`❌ Failed to delete local file ${localFilePath}:`, delErr.message);
      }
    }
  }
}

testTikTokVideoUpload();

