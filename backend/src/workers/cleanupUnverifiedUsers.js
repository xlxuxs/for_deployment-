const cron = require("node-cron");
const User = require("../models/User");
const logger = require("../utils/logger");

const cleanupUnverifiedUsers = async () => {
  try {
    const cutoff = new Date();
    cutoff.setHours(cutoff.getHours() - 24); // 24 hours ago

    const result = await User.deleteMany({
      verified: false,
      createdAt: { $lt: cutoff },
    });

    if (result.deletedCount > 0) {
      logger.info(
        `Deleted ${result.deletedCount} unverified users older than 24 hours`,
      );
    }
  } catch (err) {
    logger.error({ error: err.message }, "Unverified user cleanup error");
  }
};

const startCleanupWorker = () => {
  // Run once a day at 2 AM
  cron.schedule("0 2 * * *", cleanupUnverifiedUsers);
  logger.info("Unverified user cleanup worker started (daily at 2 AM)");
};

module.exports = { startCleanupWorker };
