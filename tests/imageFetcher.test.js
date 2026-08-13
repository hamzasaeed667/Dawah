const test = require('node:test');
const assert = require('node:assert');
const { getImageUrl } = require('../services/imageFetcher');

test('getImageUrl formats 3-digit padded page numbers correctly', () => {
  assert.strictEqual(
    getImageUrl(1),
    'https://raw.githubusercontent.com/hamzasaeed667/DawahImages/main/images/001.jpg'
  );

  assert.strictEqual(
    getImageUrl(45),
    'https://raw.githubusercontent.com/hamzasaeed667/DawahImages/main/images/045.jpg'
  );

  assert.strictEqual(
    getImageUrl(455),
    'https://raw.githubusercontent.com/hamzasaeed667/DawahImages/main/images/455.jpg'
  );
});
