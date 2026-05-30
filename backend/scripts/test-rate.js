const axios = require("axios");
const redis = require("redis");

const BASE_URL = "http://localhost:5000";
const LOGIN_URL = `${BASE_URL}/api/auth/login`;
const POLICIES_URL = `${BASE_URL}/api/policies`;

const TEST_EMAIL = "citizen19@test.com"; // replace with real user
const TEST_PASSWORD = "Pass123!"; // replace

let authToken = null;

async function clearAllRateLimiterKeys() {
  const redisClient = redis.createClient({
    url: process.env.REDIS_URL || "redis://localhost:6379",
  });
  await redisClient.connect();
  const keys = await redisClient.keys("rl:*");
  if (keys.length) {
    await redisClient.del(keys);
    console.log(`Cleared ${keys.length} rate‑limiter keys.`);
  } else {
    console.log("No rate‑limiter keys found.");
  }
  await redisClient.quit();
}

async function login() {
  try {
    const res = await axios.post(LOGIN_URL, {
      email: TEST_EMAIL,
      password: TEST_PASSWORD,
    });
    return res.data.data.token;
  } catch (err) {
    console.error("Login failed:", err.response?.data || err.message);
    process.exit(1);
  }
}

(async () => {
  // 1. Clear all rate limiter keys (auth + global)
  await clearAllRateLimiterKeys();

  // 2. Small delay to ensure Redis settles
  await new Promise((resolve) => setTimeout(resolve, 500));

  // 3. Login (should now work)
  authToken = await login();
  console.log("Authenticated successfully.");

  // 4. Run 101 requests to /api/policies
  let successCount = 0;
  let failCount = 0;

  for (let i = 1; i <= 101; i++) {
    try {
      const response = await axios.get(POLICIES_URL, {
        headers: { Authorization: `Bearer ${authToken}` },
      });
      if (response.status === 200) {
        successCount++;
        process.stdout.write(`Request ${i}: 200 OK\n`);
      } else {
        failCount++;
        process.stdout.write(`Request ${i}: ${response.status}\n`);
      }
    } catch (err) {
      if (err.response && err.response.status === 429) {
        failCount++;
        process.stdout.write(`Request ${i}: 429 Rate Limited\n`);
      } else {
        console.error(`Request ${i} failed:`, err.message);
      }
    }
  }

  console.log(`\nResult: ${successCount} succeeded, ${failCount} failed.`);
  console.log(`Expected: 100 succeeded, 1 failed (429).`);
})();
