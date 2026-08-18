const test = require('node:test');
const assert = require('node:assert');
const { getVideoUrl, getVideoData, getTotalVideos } = require('../services/videoFetcher');

test('cloudinary_videos.json contains exactly 1446 videos', () => {
  const total = getTotalVideos();
  assert.strictEqual(total, 1446, 'Total videos count should be exactly 1446');
});

test('getVideoUrl retrieves correct Cloudinary URLs for start, middle, and end page numbers', () => {
  // Start boundary (Page 1)
  const url1 = getVideoUrl(1);
  assert.ok(url1.includes('dawah_videos/dawah_video_001'), 'Page 1 URL should reference dawah_video_001');
  assert.ok(url1.startsWith('https://res.cloudinary.com/'), 'URL should start with Cloudinary domain');

  // Middle page (Page 45)
  const url45 = getVideoUrl(45);
  assert.ok(url45.includes('dawah_videos/dawah_video_045'), 'Page 45 URL should reference dawah_video_045');

  // Page 1000
  const url1000 = getVideoUrl(1000);
  assert.ok(url1000.includes('dawah_videos/dawah_video_1000'), 'Page 1000 URL should reference dawah_video_1000');

  // End boundary (Page 1446)
  const url1446 = getVideoUrl(1446);
  assert.ok(url1446.includes('dawah_videos/dawah_video_1446'), 'Page 1446 URL should reference dawah_video_1446');
});

test('getVideoData returns video metadata object for start and end boundaries', () => {
  const data1 = getVideoData(1);
  assert.strictEqual(data1.public_id, 'dawah_videos/dawah_video_001');
  assert.strictEqual(data1.format, 'mp4');
  assert.strictEqual(typeof data1.bytes, 'number');
  assert.strictEqual(typeof data1.duration, 'number');

  const data1446 = getVideoData(1446);
  assert.strictEqual(data1446.public_id, 'dawah_videos/dawah_video_1446');
  assert.strictEqual(data1446.format, 'mp4');
  assert.strictEqual(typeof data1446.bytes, 'number');
  assert.strictEqual(typeof data1446.duration, 'number');
});

test('getVideoUrl throws error for invalid page numbers', () => {
  assert.throws(() => {
    getVideoUrl(0);
  }, /not found in cloudinary_videos.json/);

  assert.throws(() => {
    getVideoUrl(1447);
  }, /not found in cloudinary_videos.json/);

  assert.throws(() => {
    getVideoUrl(9999);
  }, /not found in cloudinary_videos.json/);
});
