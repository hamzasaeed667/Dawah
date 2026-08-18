const test = require('node:test');
const assert = require('node:assert');
const path = require('path');
const { getVideoPath } = require('../services/dailymotion');

test('getVideoPath returns correct padded MP4 file path for all page ranges', () => {
  const p1 = getVideoPath(1);
  assert.strictEqual(p1, '/Users/mac/Desktop/Hamza/Projects/DawahImages/videos/001.mp4');

  const p12 = getVideoPath(12);
  assert.strictEqual(p12, '/Users/mac/Desktop/Hamza/Projects/DawahImages/videos/012.mp4');

  const p455 = getVideoPath(455);
  assert.strictEqual(p455, '/Users/mac/Desktop/Hamza/Projects/DawahImages/videos/455.mp4');

  const p1000 = getVideoPath(1000);
  assert.strictEqual(p1000, '/Users/mac/Desktop/Hamza/Projects/DawahImages/videos/1000.mp4');

  const p1446 = getVideoPath(1446);
  assert.strictEqual(p1446, '/Users/mac/Desktop/Hamza/Projects/DawahImages/videos/1446.mp4');
});
