const redis = require('redis');
const logger = require('../utils/logger');

if (!process.env.REDIS_URL) {
  logger.error('REDIS_URL environment variable is required');
  process.exit(1);
}

const client = redis.createClient({ url: process.env.REDIS_URL });

client.on('error', (err) => {
  logger.error({ error: err.message }, 'Redis connection error');
  process.exit(1);
});

client.on('connect', () => logger.info('Redis connected'));

client.connect();

module.exports = client;