const cron = require("node-cron");
const Comment = require("../models/Comment");
const logger = require("../utils/logger");
const { createAuditLog } = require("../utils/audit");
const mongoose = require("mongoose");

// Configuration (can be moved to .env)
const AUTO_RETRY_ENABLED = process.env.AUTO_RETRY_ENABLED !== "false"; // default true
const AUTO_RETRY_INTERVAL_HOURS = parseInt(
  process.env.AUTO_RETRY_INTERVAL_HOURS || "6",
  10,
);
const AUTO_RETRY_AGE_DAYS = parseInt(
  process.env.AUTO_RETRY_AGE_DAYS || "7",
  10,
);
const AUTO_RETRY_MAX_ATTEMPTS = parseInt(
  process.env.AUTO_RETRY_MAX_ATTEMPTS || "2",
  10,
);

const runAutoRetry = async () => {
  if (!AUTO_RETRY_ENABLED) return;

  const ageLimit = new Date();
  ageLimit.setDate(ageLimit.getDate() - AUTO_RETRY_AGE_DAYS);

  const query = {
    moderationStatus: "needs_review",
    moderationReason: "low_confidence",
    createdAt: { $lte: ageLimit },
    retryCount: { $lt: AUTO_RETRY_MAX_ATTEMPTS },
  };

  try {
    const count = await Comment.countDocuments(query);
    if (count === 0) return;

    const result = await Comment.updateMany(query, {
      $inc: { retryCount: 1 },
      $set: {
        moderationStatus: "pending_ai",
        moderationReason: "pending_ai",
        nextRetry: null,
        lastRetryTriggeredBy: "system:auto",
      },
    });

    await createAuditLog({
      userId: null,
      userRole: "system",
      action: "AUTO_RETRY_COMMENTS",
      targetType: "Comment",
      details: {
        criteria: `low_confidence older than ${AUTO_RETRY_AGE_DAYS} days, max attempts ${AUTO_RETRY_MAX_ATTEMPTS}`,
        countMatched: count,
        succeeded: result.modifiedCount,
      },
    });

    logger.info(
      `Auto retry: ${result.modifiedCount} comments queued for AI reprocessing`,
    );
  } catch (err) {
    logger.error({ error: err.message }, "Auto retry worker failed");
  }
};

// Schedule cron: every X hours (default 6)
const cronSchedule = `0 */${AUTO_RETRY_INTERVAL_HOURS} * * *`;
const startAutoRetryWorker = () => {
  if (AUTO_RETRY_ENABLED) {
    cron.schedule(cronSchedule, runAutoRetry);
    logger.info(
      `Auto retry worker started (every ${AUTO_RETRY_INTERVAL_HOURS} hours)`,
    );
  } else {
    logger.info("Auto retry worker disabled");
  }
};

module.exports = { startAutoRetryWorker };
