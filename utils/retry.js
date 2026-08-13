const logger = require('./logger');

/**
 * Retry an async function up to maxAttempts times.
 *
 * @param {Function} fn - Async function to execute.
 * @param {number} attempts - Maximum number of attempts.
 * @param {number} delayMs - Delay in milliseconds between attempts.
 * @returns {Promise<any>}
 */
async function retry(fn, attempts = 3, delayMs = 1000) {
  for (let i = 0; i < attempts; i++) {
    try {
      return await fn();
    } catch (err) {
      if (i === attempts - 1) {
        throw err;
      }
      logger.warn(`Attempt ${i + 1} failed: ${err.message}. Retrying in ${delayMs}ms...`);
      await new Promise((resolve) => setTimeout(resolve, delayMs));
    }
  }
}

module.exports = { retry };
