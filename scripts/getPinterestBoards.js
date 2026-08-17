require('dotenv').config();
const axios = require('axios');
const logger = require('../utils/logger');

async function getPinterestBoards() {
  const accessToken = process.env.PIN_APP_ACCESS_TOKEN;

  if (!accessToken) {
    logger.error('❌ Pinterest Access Token (PIN_APP_ACCESS_TOKEN) is missing in .env');
    return;
  }

  logger.info('Fetching Pinterest boards...');

  try {
    const res = await axios.get('https://api.pinterest.com/v5/boards', {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json'
      }
    });

    const boards = res.data.items || [];
    if (boards.length === 0) {
      logger.info('ℹ️ No boards found on this Pinterest account. Please create a board first.');
      return;
    }

    logger.info('🎉 Pinterest Boards found:');
    boards.forEach(board => {
      console.log(`- Name: ${board.name}`);
      console.log(`  ID:   ${board.id}`);
      console.log(`  URL:  ${board.pin_join_key || board.html_url || 'N/A'}`);
      console.log('--------------------------------------------------');
    });

    logger.info('💡 Copy the desired Board ID and add it to your .env file as:');
    logger.info('   PIN_BOARD_ID=your_board_id_here');

  } catch (err) {
    const status = err.response?.status;
    const errorData = err.response?.data || {};
    
    if (status === 401 || errorData.message?.includes('Authentication failed') || errorData.code === 2) {
      logger.error('❌ Pinterest Authentication Failed.');
      logger.error('👉 Your PIN_APP_ACCESS_TOKEN is invalid or has expired.');
      logger.error('👉 Please log in to the Pinterest Developer Console (https://developers.pinterest.com/) and generate a new Access Token.');
    } else {
      logger.error('❌ Failed to fetch Pinterest boards:', errorData.message || err.message);
      console.error(JSON.stringify(errorData, null, 2));
    }
  }
}

getPinterestBoards();
