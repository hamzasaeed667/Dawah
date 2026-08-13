require('dotenv').config();
const axios = require('axios');
const logger = require('../utils/logger');

/**
 * Uploads an image asset to LinkedIn for a specific owner URN (person or organization).
 *
 * @param {string} token
 * @param {string} ownerUrn
 * @param {Buffer} imageBuffer
 * @returns {Promise<string>} assetUrn
 */
async function registerAndUploadAsset(token, ownerUrn, imageBuffer) {
  const registerEndpoint = 'https://api.linkedin.com/v2/assets?action=registerUpload';
  const registerBody = {
    registerUploadRequest: {
      recipes: ['urn:li:digitalmediaRecipe:feedshare-image'],
      owner: ownerUrn,
      serviceRelationships: [
        {
          relationshipType: 'OWNER',
          identifier: 'urn:li:userGeneratedContent'
        }
      ]
    }
  };

  const registerRes = await axios.post(registerEndpoint, registerBody, {
    headers: { Authorization: `Bearer ${token}` }
  });

  const uploadUrl = registerRes.data.value.uploadMechanism['com.linkedin.digitalmedia.uploading.MediaUploadHttpRequest'].uploadUrl;
  const assetUrn = registerRes.data.value.asset;

  await axios.put(uploadUrl, imageBuffer, {
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'image/jpeg'
    }
  });

  return assetUrn;
}

/**
 * Creates a UGC post for a given author URN and asset URN.
 *
 * @param {string} token
 * @param {string} authorUrn
 * @param {string} assetUrn
 * @param {string} caption
 * @returns {Promise<any>}
 */
async function createPost(token, authorUrn, assetUrn, caption) {
  const postEndpoint = 'https://api.linkedin.com/v2/ugcPosts';
  const postBody = {
    author: authorUrn,
    lifecycleState: 'PUBLISHED',
    specificContent: {
      'com.linkedin.ugc.ShareContent': {
        shareCommentary: { text: caption },
        shareMediaCategory: 'IMAGE',
        media: [
          {
            status: 'READY',
            description: { text: caption },
            media: assetUrn,
            title: { text: 'Book Page' }
          }
        ]
      }
    },
    visibility: {
      'com.linkedin.ugc.MemberNetworkVisibility': 'PUBLIC'
    }
  };

  const postRes = await axios.post(postEndpoint, postBody, {
    headers: { Authorization: `Bearer ${token}` }
  });

  return postRes.data;
}

/**
 * Uploads image buffer to LinkedIn asset endpoint and creates posts on Personal Profile and/or Organization Page.
 *
 * @param {Buffer} imageBuffer - Binary buffer of the image.
 * @param {string} [caption] - Post text.
 */
async function uploadImageToLinkedIn(imageBuffer, caption = '') {
  const token = process.env.LINKEDIN_ACCESS_TOKEN;
  const personId = process.env.LINKEDIN_PERSON_ID;
  const orgId = process.env.LINKEDIN_ORGANIZATION_ID;

  if (!token) {
    throw new Error('LinkedIn credential LINKEDIN_ACCESS_TOKEN missing in .env');
  }

  logger.info(`[LinkedIn] Uploading image buffer (${imageBuffer.length} bytes)...`);

  const targets = [];
  if (personId && personId !== 'your_person_id') {
    targets.push(personId.startsWith('urn:li:') ? personId : (isNaN(personId) ? `urn:li:person:${personId}` : `urn:li:member:${personId}`));
  }
  if (orgId && orgId !== 'your_org_id') {
    targets.push(`urn:li:organization:${orgId}`);
  }

  if (targets.length === 0) {
    throw new Error('Neither LINKEDIN_PERSON_ID nor LINKEDIN_ORGANIZATION_ID is specified in .env');
  }

  const results = [];
  for (const authorUrn of targets) {
    try {
      logger.info(`[LinkedIn] Publishing to target URN: ${authorUrn}`);
      const assetUrn = await registerAndUploadAsset(token, authorUrn, imageBuffer);
      const postData = await createPost(token, authorUrn, assetUrn, caption);
      logger.info(`[LinkedIn] ✅ Published successfully to ${authorUrn}. Post ID: ${postData.id}`);
      results.push(postData);
    } catch (err) {
      const errDetails = err.response?.data || err.message;
      logger.error(`[LinkedIn] Failed publishing to ${authorUrn}:`, JSON.stringify(errDetails));
      throw new Error(`LinkedIn Error (${authorUrn}): ${errDetails.message || JSON.stringify(errDetails)}`);
    }
  }

  return results;
}

module.exports = { uploadImageToLinkedIn };
