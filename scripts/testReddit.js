require('dotenv').config();
const { uploadImageToReddit } = require('../services/reddit');

async function testReddit() {
  console.log('Testing Reddit Image Submission...');
  const testImageUrl = 'https://raw.githubusercontent.com/hamzasaeed667/DawahImages/main/images/001.jpg';
  const testTitle = 'Page 1 | "Purification of the Mind" - Daily Reflection';

  try {
    const res = await uploadImageToReddit(testImageUrl, testTitle);
    console.log('🎉 Reddit Test Completed Successfully!');
    console.log('Response:', JSON.stringify(res, null, 2));
  } catch (err) {
    console.error('❌ Reddit Test Error:', err.message);
  }
}

testReddit();
