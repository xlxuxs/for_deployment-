const redisClient = require("../config/redis");
const { createNotification } = require("./notificationService");

// Record a vote in Redis sliding windows
const recordVote = async (policyId, rating) => {
  const now = Date.now();
  const voteKey = `vote:count:${policyId}`;
  const ratingKey = `vote:rating:${policyId}`;

  // Add to sorted sets with timestamp as score
  await redisClient.zAdd(voteKey, { score: now, value: `${now}` });
  await redisClient.zAdd(ratingKey, { score: now, value: `${rating}` });

  // Remove data older than 24 hours (keep only recent)
  const dayAgo = now - 24 * 60 * 60 * 1000;
  await redisClient.zRemRangeByScore(voteKey, 0, dayAgo);
  await redisClient.zRemRangeByScore(ratingKey, 0, dayAgo);
};

// Get count of votes in last X minutes
const getVoteCountLastMinutes = async (policyId, minutes) => {
  const now = Date.now();
  const start = now - minutes * 60 * 1000;
  const voteKey = `vote:count:${policyId}`;
  const count = await redisClient.zCount(voteKey, start, now);
  return count;
};

// Get average rating in last X minutes
const getAverageRatingLastMinutes = async (policyId, minutes) => {
  const now = Date.now();
  const start = now - minutes * 60 * 1000;
  const ratingKey = `vote:rating:${policyId}`;
  const entries = await redisClient.zRangeByScoreWithScores(
    ratingKey,
    start,
    now,
  );
  if (entries.length === 0) return null;
  const sum = entries.reduce((acc, entry) => acc + parseFloat(entry.value), 0);
  return sum / entries.length;
};

// Check for anomalies (vote surge, rating drop) after each vote
const checkForAnomalies = async (
  policyId,
  currentRating,
  policyTitle,
  ownerId,
  associateIds = [],
) => {
  const now = Date.now();

  // Baseline: previous 6 hours (excluding last 1 hour)
  const baselineStart = now - 7 * 60 * 60 * 1000;
  const baselineEnd = now - 1 * 60 * 60 * 1000;
  const recentStart = now - 1 * 60 * 60 * 1000;

  const baselineCount = await redisClient.zCount(
    `vote:count:${policyId}`,
    baselineStart,
    baselineEnd,
  );
  const recentCount = await redisClient.zCount(
    `vote:count:${policyId}`,
    recentStart,
    now,
  );

  const baselineAvg = await getAverageRatingLastMinutes(policyId, 360); // last 6 hours
  const recentAvg = await getAverageRatingLastMinutes(policyId, 60); // last hour

  const surgeThreshold = 3; // 3x baseline
  const ratingDropThreshold = 1.0; // drop of 1 point

  // Vote surge detection
  if (baselineCount > 0 && recentCount > baselineCount * surgeThreshold) {
    await createNotification({
      userId: ownerId,
      type: "VOTE_SURGE",
      title: "Vote Surge Detected",
      message: `Policy "${policyTitle}" received ${recentCount} votes in the last hour (${Math.round(recentCount / baselineCount)}x normal).`,
      data: { policyId, recentCount, baselineCount },
      severity: "warning",
      source: "alert",
    });
    // Also notify associates (if any)
    for (const associateId of associateIds) {
      await createNotification({
        userId: associateId,
        type: "VOTE_SURGE",
        title: "Vote Surge Detected",
        message: `Policy "${policyTitle}" experienced a vote surge.`,
        data: { policyId },
        severity: "warning",
        source: "alert",
      });
    }
  }

  // Rating drop detection (only for numeric rating policies)
  if (
    baselineAvg !== null &&
    recentAvg !== null &&
    baselineAvg - recentAvg > ratingDropThreshold
  ) {
    await createNotification({
      userId: ownerId,
      type: "RATING_DROP",
      title: "Rating Drop Alert",
      message: `Policy "${policyTitle}" average rating dropped from ${baselineAvg.toFixed(1)} to ${recentAvg.toFixed(1)} in the last hour.`,
      data: { policyId, baselineAvg, recentAvg },
      severity: "warning",
      source: "alert",
    });
  }
};

module.exports = { recordVote, checkForAnomalies };
