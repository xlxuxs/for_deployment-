const cron = require("node-cron");
const Comment = require("../models/Comment");
const Policy = require("../models/Policy");
const redisClient = require("../config/redis");
const { createNotification } = require("../services/notificationService");

const processEmergingTopics = async () => {
  try {
    const now = new Date();
    const twentyFourHoursAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);

    // Get all approved comments from last 24 hours
    const recentComments = await Comment.find({
      status: "approved",
      createdAt: { $gte: twentyFourHoursAgo },
    }).lean();

    // Count keyword frequencies
    const keywordCount = {};
    recentComments.forEach((c) => {
      if (c.keywords && Array.isArray(c.keywords)) {
        c.keywords.forEach((kw) => {
          const normalized = kw.toLowerCase().trim();
          keywordCount[normalized] = (keywordCount[normalized] || 0) + 1;
        });
      }
    });

    // Get baseline from previous 7 days (stored in Redis)
    const baselineKey = "emerging:baseline";
    let baseline = await redisClient.get(baselineKey);
    baseline = baseline ? JSON.parse(baseline) : {};

    // Detect emerging topics (>200% increase and >5 occurrences)
    const emerging = [];
    for (const [keyword, count] of Object.entries(keywordCount)) {
      const prevCount = baseline[keyword] || 0;
      if (prevCount > 0) {
        const increase = (count - prevCount) / prevCount;
        if (increase > 2.0 && count > 5) {
          emerging.push({
            keyword,
            count,
            increase: (increase * 100).toFixed(0),
          });
        }
      }
    }

    // Store new baseline for next run
    await redisClient.set(
      baselineKey,
      JSON.stringify(keywordCount),
      "EX",
      7 * 24 * 60 * 60,
    );

    // Notify all planners (or policy owners related to those keywords)
    if (emerging.length > 0) {
      const planners = await User.find({
        role: "planner",
        active: true,
      }).select("_id");
      for (const planner of planners) {
        await createNotification({
          userId: planner._id,
          type: "EMERGING_TOPIC",
          title: "Emerging Topic Detected",
          message: `New trending topic: ${emerging.map((e) => e.keyword).join(", ")}.`,
          data: { topics: emerging },
          severity: "info",
          source: "alert",
        });
      }
    }

    console.log(`Emerging topics processed: ${emerging.length} found`);
  } catch (err) {
    console.error("Emerging topics worker error:", err);
  }
};

// Run every 6 hours
const startEmergingTopicsWorker = () => {
  cron.schedule("0 */6 * * *", processEmergingTopics);
  console.log("Emerging topics worker started (every 6 hours)");
};

module.exports = { startEmergingTopicsWorker };
