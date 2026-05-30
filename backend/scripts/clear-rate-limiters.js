const redis = require("redis");

const redisClient = redis.createClient({
  url: process.env.REDIS_URL || "redis://localhost:6379",
});

(async () => {
  await redisClient.connect();
  const keys = await redisClient.keys("rl:*");
  if (keys.length) {
    await redisClient.del(keys);
    console.log(`Cleared ${keys.length} rate‑limiter keys.`);
  } else {
    console.log("No rate‑limiter keys found.");
  }
  await redisClient.quit();
})();
