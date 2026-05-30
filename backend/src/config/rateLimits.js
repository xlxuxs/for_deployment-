const createRateLimiter = require("../middleware/rateLimiter");

const intEnv = (name, fallback) => {
  const value = parseInt(process.env[name], 10);
  return Number.isFinite(value) ? value : fallback;
};

const limiters = {
  global: createRateLimiter({
    windowMs: 15 * 60 * 1000,
    max: intEnv("RATE_LIMIT_GLOBAL_MAX", 2000),
    keyPrefix: "rl:global",
  }),

  auth: createRateLimiter({
    windowMs: 15 * 60 * 1000,
    max: intEnv("RATE_LIMIT_AUTH_MAX", 100),
    keyPrefix: "rl:auth",
  }),

  otpRequest: createRateLimiter({
    windowMs: 60 * 60 * 1000,
    max: intEnv("RATE_LIMIT_OTP_REQUEST_MAX", 30),
    keyPrefix: "rl:otp:request",
  }),

  otpVerify: createRateLimiter({
    windowMs: 15 * 60 * 1000,
    max: intEnv("RATE_LIMIT_OTP_VERIFY_MAX", 50),
    keyPrefix: "rl:otp:verify",
  }),

  passwordResetRequest: createRateLimiter({
    windowMs: 60 * 60 * 1000,
    max: intEnv("RATE_LIMIT_PASSWORD_RESET_REQUEST_MAX", 30),
    keyPrefix: "rl:password:reset:request",
  }),

  passwordResetConfirm: createRateLimiter({
    windowMs: 15 * 60 * 1000,
    max: intEnv("RATE_LIMIT_PASSWORD_RESET_CONFIRM_MAX", 50),
    keyPrefix: "rl:password:reset:confirm",
  }),

  vote: createRateLimiter({
    windowMs: 60 * 60 * 1000,
    max: intEnv("RATE_LIMIT_VOTE_MAX", 300),
    keyPrefix: "rl:vote",
    keyGenerator: (req) => req.user?.id || req.ip,
  }),

  comment: createRateLimiter({
    windowMs: 60 * 1000,
    max: intEnv("RATE_LIMIT_COMMENT_MAX", 120),
    keyPrefix: "rl:comment",
    keyGenerator: (req) => req.user?.id || req.ip,
  }),

  plannerRequest: createRateLimiter({
    windowMs: 24 * 60 * 60 * 1000,
    max: intEnv("RATE_LIMIT_PLANNER_REQUEST_MAX", 100),
    keyPrefix: "rl:planner:request",
    keyGenerator: (req) => req.user?.id || req.ip,
  }),

  reportComment: createRateLimiter({
    windowMs: 60 * 1000,
    max: intEnv("RATE_LIMIT_REPORT_COMMENT_MAX", 60),
    keyPrefix: "rl:report:comment",
    keyGenerator: (req) => req.user?.id || req.ip,
  }),

  appealComment: createRateLimiter({
    windowMs: 24 * 60 * 60 * 1000,
    max: 3,
    keyPrefix: "rl:appeal:comment",
    keyGenerator: (req) => req.user?.id || req.ip,
  }),

  moderateComment: createRateLimiter({
    windowMs: 60 * 1000,
    max: intEnv("RATE_LIMIT_MODERATE_COMMENT_MAX", 300),
    keyPrefix: "rl:moderate:comment",
    keyGenerator: (req) => req.user?.id || req.ip,
  }),

  phoneChangeRequest: createRateLimiter({
    windowMs: 60 * 60 * 1000,
    max: intEnv("RATE_LIMIT_PHONE_CHANGE_REQUEST_MAX", 30),
    keyPrefix: "rl:phone:request",
    keyGenerator: (req) => req.user?.id || req.ip,
  }),

  bulkAdmin: createRateLimiter({
    windowMs: 60 * 1000,
    max: intEnv("RATE_LIMIT_BULK_ADMIN_MAX", 120),
    keyPrefix: "rl:bulk:admin",
    keyGenerator: (req) => req.user?.id || req.ip,
  }),

  // New limiters
  policyWrite: createRateLimiter({
    windowMs: 60 * 60 * 1000,
    max: intEnv("RATE_LIMIT_POLICY_WRITE_MAX", 20),
    keyPrefix: "rl:policy:write",
    keyGenerator: (req) => req.user?.id || req.ip,
  }),

  analyticsRead: createRateLimiter({
    windowMs: 60 * 1000,
    max: intEnv("RATE_LIMIT_ANALYTICS_READ_MAX", 100),
    keyPrefix: "rl:analytics:read",
    keyGenerator: (req) => req.user?.id || req.ip,
  }),

  userProfileUpdate: createRateLimiter({
    windowMs: 60 * 60 * 1000,
    max: intEnv("RATE_LIMIT_USER_PROFILE_UPDATE_MAX", 10),
    keyPrefix: "rl:user:profile:update",
    keyGenerator: (req) => req.user?.id || req.ip,
  }),

  dataExport: createRateLimiter({
    windowMs: 60 * 60 * 1000,
    max: intEnv("RATE_LIMIT_DATA_EXPORT_MAX", 5),
    keyPrefix: "rl:export",
    keyGenerator: (req) => req.user?.id || req.ip,
  }),

  smsReceive: createRateLimiter({
    windowMs: 60 * 1000,
    max: intEnv("RATE_LIMIT_SMS_RECEIVE_MAX", 10),
    keyPrefix: "rl:sms:receive",
    keyGenerator: (req) => req.ip,
  }),
};

module.exports = limiters;
