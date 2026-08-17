const test = require('node:test');
const assert = require('node:assert');
const { getVideoUrl, getVideoData } = require('../services/videoFetcher');

test('getVideoUrl retrieves correct Cloudinary URLs for page numbers', () => {
  const url1 = getVideoUrl(1);
  assert.ok(url1.includes('dawah_videos/'), 'Page 1 URL should reference Cloudinary dawah_videos');
  assert.ok(url1.startsWith('https://res.cloudinary.com/'), 'URL should start with Cloudinary domain');

  const url45 = getVideoUrl(45);
  assert.ok(url45.includes('dawah_videos/'), 'Page 45 URL should reference Cloudinary dawah_videos');

  const url1446 = getVideoUrl(1446);
  assert.ok(url1446.includes('dawah_videos/'), 'Page 1446 URL should reference Cloudinary dawah_videos');
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
