const rateLimit = require("express-rate-limit");
const { RedisStore } = require("rate-limit-redis"); // named export for v5
const redisClient = require("../config/redis");

const createRateLimiter = (options = {}) => {
  const {
    windowMs = 15 * 60 * 1000,
    max = 100,
    keyPrefix = "rl",
    skipFailedRequests = false,
    standardHeaders = true,
    legacyHeaders = false,
    keyGenerator = undefined,
    ...rest
  } = options;

  return rateLimit({
    store: new RedisStore({
      sendCommand: (...args) => redisClient.sendCommand(args),
      prefix: keyPrefix,
    }),
    windowMs,
    max,
    skipFailedRequests,
    standardHeaders,
    legacyHeaders,
    keyGenerator,
    validate: false,
    handler: (req, res, next, options) => {
      res.status(429).json({
        status: "error",
        error: {
          code: "RATE_LIMIT_EXCEEDED",
          message: `Too many requests. Please wait ${Math.ceil(options.windowMs / 60000)} minutes.`,
        },
        timestamp: new Date().toISOString(),
      });
    },
    ...rest,
  });
};

module.exports = createRateLimiter;
