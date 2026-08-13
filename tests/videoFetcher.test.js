const test = require('node:test');
const assert = require('node:assert');
const { getVideoUrl, getVideoData } = require('../services/videoFetcher');

test('getVideoUrl retrieves correct Cloudinary URLs for padded page numbers', () => {
  const url1 = getVideoUrl(1);
  assert.ok(url1.includes('dawah_video_001.mp4'), 'Page 1 URL should reference dawah_video_001.mp4');
  assert.ok(url1.startsWith('https://res.cloudinary.com/'), 'URL should start with Cloudinary domain');

  const url45 = getVideoUrl(45);
  assert.ok(url45.includes('dawah_video_045.mp4'), 'Page 45 URL should reference dawah_video_045.mp4');

  const url455 = getVideoUrl(455);
  assert.ok(url455.includes('dawah_video_455.mp4'), 'Page 455 URL should reference dawah_video_455.mp4');
});

test('getVideoData returns video metadata object', () => {
  const data1 = getVideoData(1);
  assert.strictEqual(data1.public_id, 'dawah_videos/dawah_video_001');
  assert.strictEqual(data1.format, 'mp4');
  assert.strictEqual(typeof data1.bytes, 'number');
  assert.strictEqual(typeof data1.duration, 'number');
});

test('getVideoUrl throws error for invalid page numbers', () => {
  assert.throws(() => {
    getVideoUrl(9999);
  }, /not found in cloudinary_videos.json/);
});
