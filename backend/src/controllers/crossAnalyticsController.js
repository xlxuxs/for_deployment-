const mongoose = require("mongoose");
const Policy = require("../models/Policy");
const Vote = require("../models/Vote");
const Comment = require("../models/Comment");
const logger = require("../utils/logger");
const { createAuditLog } = require("../utils/audit");
const {
  sendSuccess,
  sendError,
  ErrorCodes,
} = require("../utils/responseHelper");

const parseDate = (dateStr, paramName) => {
  if (!dateStr) return null;
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) throw new Error(`Invalid ${paramName}: ${dateStr}`);
  return d;
};

// Helper: check if user can view the aggregated policies (planner/admin)
const checkCrossAnalyticsAccess = (user) => {
  if (user.role === "admin") return true;
  if (user.role === "planner") return true;
  return false;
};

exports.getCrossAnalytics = async (req, res) => {
  try {
    const {
      topics,
      region,
      gender,
      ageRange,
      occupation,
      education,
      startDate,
      endDate,
    } = req.query;

    if (!checkCrossAnalyticsAccess(req.user)) {
      return sendError(
        res,
        ErrorCodes.FORBIDDEN,
        "Only planners and admins can access cross‑policy analytics",
        null,
        403,
      );
    }

    // Build policy filter. Admins see platform-wide analytics; planners only
    // see policies they own, so cross-policy totals cannot leak app-wide data.
    const policyFilter = {};
    if (topics) {
      const topicArray = topics.split(",").map((t) => t.trim());
      policyFilter.topics = { $in: topicArray };
    }
    if (region) {
      policyFilter.targetRegions = region;
    }
    // Only include policies that are active, paused, or closed (non‑draft)
    policyFilter.status = { $in: ["active", "paused", "closed"] };
    if (req.user.role === "planner") {
      policyFilter.createdBy = req.user.id;
    }

    const policies = await Policy.find(policyFilter).select("_id");
    if (policies.length === 0) {
      return sendSuccess(
        res,
        {
          totalVotes: 0,
          totalComments: 0,
          sentimentCounts: { positive: 0, negative: 0, neutral: 0 },
          topKeywords: [],
          policyCount: 0,
        },
        "No policies match the criteria",
        200,
      );
    }
    const policyIds = policies.map((p) => p._id);

    const start = parseDate(startDate, "startDate");
    const end = parseDate(endDate, "endDate");

    // ---------- VOTE AGGREGATION ----------
    const voteMatch = {
      policyId: { $in: policyIds },
      channel: "app", // we ignore SMS for cross‑policy (keep consistent with demographics)
    };
    if (start) voteMatch.createdAt = { $gte: start };
    if (end) voteMatch.createdAt = { ...voteMatch.createdAt, $lte: end };
    if (gender) voteMatch["demographics.gender"] = gender;
    if (ageRange) voteMatch["demographics.ageRange"] = ageRange;
    if (occupation) voteMatch["demographics.occupation"] = occupation;
    if (education) voteMatch["demographics.education"] = education;

    const totalVotes = await Vote.countDocuments(voteMatch);

    // ---------- COMMENT AGGREGATION (updated for new schema) ----------
    const commentMatch = {
      policyId: { $in: policyIds },
      visibility: "visible",
      $or: [
        { "sentiment.overriddenByModerator": true },
        { "reviewFlags.sentimentReviewNeeded": false },
      ],
    };
    if (start) commentMatch.createdAt = { $gte: start };
    if (end) commentMatch.createdAt = { ...commentMatch.createdAt, $lte: end };
    // Comments have demographics snapshot
    if (gender) commentMatch["demographics.gender"] = gender;
    if (ageRange) commentMatch["demographics.ageRange"] = ageRange;
    if (occupation) commentMatch["demographics.occupation"] = occupation;
    if (education) commentMatch["demographics.education"] = education;

    const totalComments = await Comment.countDocuments(commentMatch);

    // Sentiment counts and top keywords
    const sentimentPipeline = [
      { $match: commentMatch },
      {
        $group: {
          _id: null,
          positive: {
            $sum: { $cond: [{ $eq: ["$sentiment.label", "positive"] }, 1, 0] },
          },
          negative: {
            $sum: { $cond: [{ $eq: ["$sentiment.label", "negative"] }, 1, 0] },
          },
          neutral: {
            $sum: { $cond: [{ $eq: ["$sentiment.label", "neutral"] }, 1, 0] },
          },
          allKeywords: { $push: "$keywords" },
        },
      },
    ];
    const sentimentResult = await Comment.aggregate(sentimentPipeline);
    let sentimentCounts = { positive: 0, negative: 0, neutral: 0 };
    let keywordFreq = {};
    if (sentimentResult.length > 0) {
      const agg = sentimentResult[0];
      sentimentCounts = {
        positive: agg.positive,
        negative: agg.negative,
        neutral: agg.neutral,
      };
      const allKeywords = agg.allKeywords.flat();
      for (const kw of allKeywords) {
        if (kw) keywordFreq[kw] = (keywordFreq[kw] || 0) + 1;
      }
    }
    const topKeywords = Object.entries(keywordFreq)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([kw, count]) => ({ keyword: kw, count }));

    // Audit log
    await createAuditLog({
      userId: req.user.id,
      userRole: req.user.role,
      action: "CROSS_ANALYTICS",
      details: {
        topics,
        region,
        gender,
        ageRange,
        occupation,
        education,
        startDate,
        endDate,
      },
      req,
    });

    logger.info(`Cross‑policy analytics accessed by user ${req.user.id}`);

    return sendSuccess(
      res,
      {
        totalVotes,
        totalComments,
        sentimentCounts,
        topKeywords,
        policyCount: policyIds.length,
      },
      "Cross‑policy analytics retrieved",
    );
  } catch (err) {
    logger.error({ error: err.message }, "Cross‑policy analytics error");
    return sendError(
      res,
      ErrorCodes.INTERNAL,
      "Failed to retrieve cross‑policy analytics",
      null,
      500,
    );
  }
};
