const redisClient = require("../config/redis");

/**
 * Generic cache wrapper
 * @param {string} key - Redis key
 * @param {number} ttlSeconds - Time to live in seconds
 * @param {Function} fetchFn - Async function to get fresh data
 * @returns {Promise<any>} Cached or fresh data
 */
const getOrSet = async (key, ttlSeconds, fetchFn) => {
  const cached = await redisClient.get(key);
  if (cached) {
    return JSON.parse(cached);
  }
  const fresh = await fetchFn();
  await redisClient.setEx(key, ttlSeconds, JSON.stringify(fresh));
  return fresh;
};

/**
 * Delete a single key
 */
const invalidate = async (key) => {
  await redisClient.del(key);
};

/**
 * Delete keys matching a pattern (use with care – KEYS is O(N))
 */
const invalidatePattern = async (pattern) => {
  const keys = await redisClient.keys(pattern);
  if (keys.length) {
    await redisClient.del(keys);
  }
};

module.exports = { getOrSet, invalidate, invalidatePattern };
