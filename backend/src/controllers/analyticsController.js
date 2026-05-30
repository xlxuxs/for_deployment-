const mongoose = require("mongoose");
const crypto = require("crypto");
const Vote = require("../models/Vote");
const Comment = require("../models/Comment");
const Policy = require("../models/Policy");
const PolicyAssociate = require("../models/PolicyAssociate");
const logger = require("../utils/logger");
const { getOrSet } = require("../services/cacheService");
const {
  sendSuccess,
  sendError,
  ErrorCodes,
} = require("../utils/responseHelper");

// ---------- Helper: poll‑type aggregation ----------
const getPollTypeAggregation = async (policy, voteFilter) => {
  const votes = await Vote.find(voteFilter);
  const totalVotes = votes.length;

  switch (policy.pollType) {
    case "binary": {
      const yesCount = votes.filter((v) => v.value === "yes").length;
      const noCount = totalVotes - yesCount;
      return {
        totalVotes,
        yesCount,
        noCount,
        yesPercentage: totalVotes
          ? ((yesCount / totalVotes) * 100).toFixed(1)
          : 0,
        noPercentage: totalVotes
          ? ((noCount / totalVotes) * 100).toFixed(1)
          : 0,
      };
    }
    case "multipleChoice": {
      const optionCounts = {};
      policy.pollOptions.forEach((opt) => {
        optionCounts[opt.id] = 0;
      });
      votes.forEach((v) => {
        if (Array.isArray(v.value)) {
          v.value.forEach((optId) => {
            if (optionCounts[optId] !== undefined) optionCounts[optId]++;
          });
        }
      });
      const results = policy.pollOptions.map((opt) => ({
        id: opt.id,
        text: opt.text,
        count: optionCounts[opt.id],
        percentage: totalVotes
          ? ((optionCounts[opt.id] / totalVotes) * 100).toFixed(1)
          : 0,
      }));
      return { totalVotes, results };
    }
    case "likert":
    case "rating": {
      const values = votes.map((v) => v.value);
      const sum = values.reduce((a, b) => a + b, 0);
      const avg = totalVotes ? (sum / totalVotes).toFixed(2) : 0;
      const distribution = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
      values.forEach((v) => {
        distribution[v] = (distribution[v] || 0) + 1;
      });
      return { totalVotes, average: parseFloat(avg), distribution };
    }
    case "approval": {
      const approveCount = votes.filter((v) => v.value === "approve").length;
      const rejectCount = votes.filter((v) => v.value === "reject").length;
      const abstainCount = votes.filter((v) => v.value === "abstain").length;
      const netApproval = approveCount - rejectCount;
      return {
        totalVotes,
        approveCount,
        rejectCount,
        abstainCount,
        approvePercentage: totalVotes
          ? ((approveCount / totalVotes) * 100).toFixed(1)
          : 0,
        rejectPercentage: totalVotes
          ? ((rejectCount / totalVotes) * 100).toFixed(1)
          : 0,
        abstainPercentage: totalVotes
          ? ((abstainCount / totalVotes) * 100).toFixed(1)
          : 0,
        netApproval,
      };
    }
    case "rankedChoice": {
      // Simplified: just return the first‑preference counts
      const firstPref = {};
      policy.pollOptions.forEach((opt) => {
        firstPref[opt.id] = 0;
      });
      votes.forEach((v) => {
        if (Array.isArray(v.value) && v.value.length > 0) {
          const first = v.value[0];
          if (firstPref[first] !== undefined) firstPref[first]++;
        }
      });
      const results = policy.pollOptions.map((opt) => ({
        id: opt.id,
        text: opt.text,
        firstChoiceCount: firstPref[opt.id],
        percentage: totalVotes
          ? ((firstPref[opt.id] / totalVotes) * 100).toFixed(1)
          : 0,
      }));
      return { totalVotes, firstChoiceResults: results };
    }
    default:
      return { totalVotes };
  }
};

// ---------- Helper: date validation ----------
const parseDate = (dateStr, paramName) => {
  if (!dateStr) return null;
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) throw new Error(`Invalid ${paramName}: ${dateStr}`);
  return d;
};

// ---------- Helper: permission check ----------
// type: 'summary' | 'timeseries' | 'comments' | 'demographics' | 'heatmap' | 'correlation' | 'export'
const checkAnalyticsAccess = async (policy, user, type = "summary") => {
  // Admins and planners have full access
  if (user && user.role === "admin") return { allowed: true, includeSentiment: true };
  if (user && user.role === "planner") return { allowed: true, includeSentiment: true };

  // Citizens: enforce policy visibility flags and region/status rules
  if (!user || user.role !== "citizen") {
    return {
      allowed: false,
      errorCode: "FORBIDDEN",
      errorMessage: "Only planners and authorized citizens can view analytics",
      statusCode: 403,
    };
  }

  const vis = policy.citizenAnalyticsVisibility || {};

  // Citizens may only view analytics for policies in allowed statuses
  const allowedStatuses = ["active", "paused", "closed", "archived"];
  if (!allowedStatuses.includes(policy.status)) {
    return {
      allowed: false,
      errorCode: "NOT_FOUND",
      errorMessage: "Policy not available",
      statusCode: 404,
    };
  }

  // Citizens must be in the policy's target region
  if (user.region && Array.isArray(policy.targetRegions)) {
    if (!policy.targetRegions.includes(user.region)) {
      return {
        allowed: false,
        errorCode: "NOT_FOUND",
        errorMessage: "Policy not found",
        statusCode: 404,
      };
    }
  }

  // Determine access per type
  if (type === "summary" || type === "timeseries" || type === "export") {
    if (!vis.showResults) {
      return {
        allowed: false,
        errorCode: "FORBIDDEN",
        errorMessage: "Results are not visible to citizens for this policy",
        statusCode: 403,
      };
    }
  }

  if (["demographics", "heatmap", "correlation"].includes(type)) {
    if (!vis.showBreakdown) {
      return {
        allowed: false,
        errorCode: "FORBIDDEN",
        errorMessage: "Breakdown analytics are not visible to citizens for this policy",
        statusCode: 403,
      };
    }
  }

  if (type === "comments") {
    if (!vis.showComments) {
      return {
        allowed: false,
        errorCode: "FORBIDDEN",
        errorMessage: "Comments are not visible to citizens for this policy",
        statusCode: 403,
      };
    }
  }

  // Return object with guidance for controllers: whether to include sentiment and whether to allow time filters
  return {
    allowed: true,
    includeSentiment: !!vis.showSentiment,
    allowTimeFilter: !!vis.allowTimeFilter,
  };
};

// Helper to generate cache key from query parameters
const generateCacheKey = (prefix, ...parts) => {
  const str = parts.join(":");
  const hash = crypto.createHash("md5").update(str).digest("hex");
  return `${prefix}:${hash}`;
};

// ---------- Main analytics endpoint with optional demographic filters ----------
exports.getAnalytics = async (req, res) => {
  try {
    const { policyId } = req.params;
    if (!mongoose.Types.ObjectId.isValid(policyId)) {
      return sendError(
        res,
        ErrorCodes.VALIDATION,
        "Invalid policy ID format",
        null,
        400,
      );
    }
    const {
      startDate,
      endDate,
      gender,
      ageRange,
      occupation,
      education,
      region,
    } = req.query;

    let start = parseDate(startDate, "startDate");
    let end = parseDate(endDate, "endDate");

    const policy = await Policy.findById(policyId);
    if (!policy)
      return sendError(
        res,
        ErrorCodes.NOT_FOUND,
        "Policy not found",
        null,
        404,
      );

    const access = await checkAnalyticsAccess(policy, req.user, "summary");
    if (!access.allowed)
      return sendError(
        res,
        access.errorCode,
        access.errorMessage,
        null,
        access.statusCode,
      );

    // If citizens are not allowed to set time filters, ignore start/end
    if (access.allowTimeFilter === false) {
      start = null;
      end = null;
    }

    // Build vote filter
    let voteFilter = { policyId: policy._id };
    if (start) voteFilter.createdAt = { $gte: start };
    if (end) voteFilter.createdAt = { ...voteFilter.createdAt, $lte: end };
    if (gender) voteFilter["demographics.gender"] = gender;
    if (ageRange) voteFilter["demographics.ageRange"] = ageRange;
    if (occupation) voteFilter["demographics.occupation"] = occupation;
    if (education) voteFilter["demographics.education"] = education;
    if (region) voteFilter.region = region;

    const cacheKey = generateCacheKey(
      "analytics:summary",
      policyId,
      JSON.stringify({
        start,
        end,
        gender,
        ageRange,
        occupation,
        education,
        region,
      }),
    );

    const [voteAgg, comments] = await getOrSet(cacheKey, 60, async () => {
      const agg = await getPollTypeAggregation(policy, voteFilter);
      const comms = await Comment.find({
        policyId: policy._id,
        visibility: "visible",
        aiStatus: "processed",
        parentCommentId: null, // ← add this
        $or: [
          { "reviewFlags.sentimentReviewNeeded": false },
          { "sentiment.overriddenByModerator": true },
        ],
      }).lean();
      return [agg, comms];
    });

    let sentimentCounts = { positive: 0, negative: 0, neutral: 0 };
    const keywordFreq = {};
    comments.forEach((c) => {
      if (c.sentiment?.label) sentimentCounts[c.sentiment.label]++;
      if (c.keywords) {
        c.keywords.forEach((kw) => {
          keywordFreq[kw] = (keywordFreq[kw] || 0) + 1;
        });
      }
    });
    const topKeywords = Object.entries(keywordFreq)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([keyword, count]) => ({ keyword, count }));

    const response = {
      policyId: policy._id,
      title: policy.title,
      pollType: policy.pollType,
      ...voteAgg,
      // Only include sentiment/top keywords if permitted for citizens
      ...(access.includeSentiment ? { sentimentCounts, topKeywords } : {}),
    };

    logger.info(
      `Analytics delivered for policy ${policyId} to user ${req.user.id}`,
    );
    return sendSuccess(res, response, "Analytics retrieved successfully");
  } catch (err) {
    console.error("Full error:", err);
    console.error("Error stack:", err.stack);
    logger.error({ error: err.message }, "Get analytics error");
    return sendError(
      res,
      ErrorCodes.INTERNAL,
      "Failed to retrieve analytics",
      null,
      500,
    );
  }
};

// ---------- Timeseries endpoint ----------
exports.getTimeseries = async (req, res) => {
  try {
    const { policyId } = req.params;
    if (!mongoose.Types.ObjectId.isValid(policyId)) {
      return sendError(
        res,
        ErrorCodes.VALIDATION,
        "Invalid policy ID format",
        null,
        400,
      );
    }
    const {
      bucket = "day",
      startDate,
      endDate,
      gender,
      ageRange,
      occupation,
      education,
      region,
    } = req.query;

    let start = parseDate(startDate, "startDate");
    let end = parseDate(endDate, "endDate");

    const policy = await Policy.findById(policyId);
    if (!policy)
      return sendError(
        res,
        ErrorCodes.NOT_FOUND,
        "Policy not found",
        null,
        404,
      );

    const access = await checkAnalyticsAccess(policy, req.user, "timeseries");
    if (!access.allowed)
      return sendError(
        res,
        access.errorCode,
        access.errorMessage,
        null,
        access.statusCode,
      );

    if (access.allowTimeFilter === false) {
      start = null;
      end = null;
    }

    let dateFormat;
    switch (bucket) {
      case "hour":
        dateFormat = "%Y-%m-%d %H:00";
        break;
      case "day":
        dateFormat = "%Y-%m-%d";
        break;
      case "week":
        dateFormat = "%Y-%V";
        break;
      case "month":
        dateFormat = "%Y-%m";
        break;
      default:
        dateFormat = "%Y-%m-%d";
    }

    // ---------- VOTE AGGREGATION ----------
    const voteFilter = { policyId: policy._id };
    if (start) voteFilter.createdAt = { $gte: start };
    if (end) voteFilter.createdAt = { ...voteFilter.createdAt, $lte: end };
    if (gender) voteFilter["demographics.gender"] = gender;
    if (ageRange) voteFilter["demographics.ageRange"] = ageRange;
    if (occupation) voteFilter["demographics.occupation"] = occupation;
    if (education) voteFilter["demographics.education"] = education;
    if (region) voteFilter.region = region;

    const pollType = policy.pollType;
    let votePipeline = [{ $match: voteFilter }];

    if (pollType === "binary") {
      votePipeline.push({
        $group: {
          _id: { $dateToString: { format: dateFormat, date: "$createdAt" } },
          total: { $sum: 1 },
          yes: { $sum: { $cond: [{ $eq: ["$value", "yes"] }, 1, 0] } },
        },
      });
    } else if (pollType === "multipleChoice") {
      votePipeline.push(
        { $unwind: { path: "$value", preserveNullAndEmptyArrays: false } },
        {
          $group: {
            _id: {
              period: {
                $dateToString: { format: dateFormat, date: "$createdAt" },
              },
              option: "$value",
            },
            count: { $sum: 1 },
          },
        },
        { $sort: { "_id.period": 1, "_id.option": 1 } },
        {
          $group: {
            _id: "$_id.period",
            total: { $sum: "$count" },
            options: {
              $push: { option: "$_id.option", count: "$count" },
            },
          },
        },
        { $sort: { _id: 1 } },
      );
    } else if (pollType === "likert" || pollType === "rating") {
      votePipeline.push({
        $group: {
          _id: { $dateToString: { format: dateFormat, date: "$createdAt" } },
          total: { $sum: 1 },
          avg: { $avg: "$value" },
        },
      });
    } else if (pollType === "approval") {
      votePipeline.push({
        $group: {
          _id: { $dateToString: { format: dateFormat, date: "$createdAt" } },
          total: { $sum: 1 },
          approve: { $sum: { $cond: [{ $eq: ["$value", "approve"] }, 1, 0] } },
          reject: { $sum: { $cond: [{ $eq: ["$value", "reject"] }, 1, 0] } },
          abstain: { $sum: { $cond: [{ $eq: ["$value", "abstain"] }, 1, 0] } },
        },
      });
    } else if (pollType === "rankedChoice") {
      votePipeline.push(
        { $addFields: { firstChoice: { $arrayElemAt: ["$value", 0] } } },
        { $match: { firstChoice: { $exists: true } } },
        {
          $group: {
            _id: {
              period: {
                $dateToString: { format: dateFormat, date: "$createdAt" },
              },
              firstChoice: "$firstChoice",
            },
            count: { $sum: 1 },
          },
        },
        { $sort: { "_id.period": 1, "_id.firstChoice": 1 } },
        {
          $group: {
            _id: "$_id.period",
            total: { $sum: "$count" },
            firstChoiceCounts: {
              $push: { option: "$_id.firstChoice", count: "$count" },
            },
          },
        },
        { $sort: { _id: 1 } },
      );
    }

    const cacheKey = generateCacheKey(
      "analytics:timeseries",
      policyId,
      bucket,
      JSON.stringify({
        start,
        end,
        gender,
        ageRange,
        occupation,
        education,
        region,
      }),
    );

    const voteTimeseries = await getOrSet(cacheKey, 60, async () => {
      return await Vote.aggregate(votePipeline);
    });

    const voteMap = new Map();
    for (const v of voteTimeseries) {
      const period = v._id;
      const base = { totalVotes: v.total };
      if (pollType === "binary") {
        base.yesCount = v.yes;
        base.noCount = v.total - v.yes;
        base.yesPercentage = v.total ? ((v.yes / v.total) * 100).toFixed(1) : 0;
      } else if (pollType === "multipleChoice") {
        base.options = v.options;
      } else if (pollType === "likert" || pollType === "rating") {
        base.averageRating = parseFloat(v.avg.toFixed(2));
      } else if (pollType === "approval") {
        base.approveCount = v.approve;
        base.rejectCount = v.reject;
        base.abstainCount = v.abstain;
        base.approvePercentage = v.total
          ? ((v.approve / v.total) * 100).toFixed(1)
          : 0;
      } else if (pollType === "rankedChoice") {
        base.firstChoiceCounts = v.firstChoiceCounts;
      }
      voteMap.set(period, base);
    }

    // ---------- COMMENT AGGREGATION (sentiment + keywords) ----------
    const commentFilter = {
      policyId: policy._id,
      visibility: "visible",
      aiStatus: "processed",
      parentCommentId: null, // ← add this
      $or: [
        { "reviewFlags.sentimentReviewNeeded": false },
        { "sentiment.overriddenByModerator": true },
      ],
    };
    if (start) commentFilter.createdAt = { $gte: start };
    if (end)
      commentFilter.createdAt = { ...commentFilter.createdAt, $lte: end };
    const commentPipeline = [
      { $match: commentFilter },
      {
        $group: {
          _id: { $dateToString: { format: dateFormat, date: "$createdAt" } },
          sentimentScores: { $push: "$sentiment.label" },
          keywordsList: { $push: "$keywords" },
        },
      },
      { $sort: { _id: 1 } },
    ];
    const commentBuckets = await Comment.aggregate(commentPipeline);

    const sentimentMap = new Map();
    for (const bucket of commentBuckets) {
      const period = bucket._id;
      const sentiments = bucket.sentimentScores;
      const allKeywords = bucket.keywordsList.flat();
      let totalScore = 0;
      let count = 0;
      for (const s of sentiments) {
        if (s === "positive") totalScore += 1;
        else if (s === "negative") totalScore -= 1;
        else totalScore += 0;
        count++;
      }
      const avgSentiment = count ? (totalScore / count).toFixed(2) : 0;
      const keywordFreq = {};
      for (const kw of allKeywords) {
        if (kw) keywordFreq[kw] = (keywordFreq[kw] || 0) + 1;
      }
      const topKeywords = Object.entries(keywordFreq)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 3)
        .map(([kw, freq]) => ({ keyword: kw, count: freq }));
      sentimentMap.set(period, {
        averageSentiment: parseFloat(avgSentiment),
        topKeywords,
      });
    }

    const allPeriods = new Set([...voteMap.keys(), ...sentimentMap.keys()]);
    let merged = Array.from(allPeriods)
      .sort()
      .map((period) => {
        const voteData = voteMap.get(period) || { totalVotes: 0 };
        const sentimentData = sentimentMap.get(period) || {
          averageSentiment: 0,
          topKeywords: [],
        };
        return {
          bucket: period,
          ...voteData,
          averageSentiment: sentimentData.averageSentiment,
          topKeywords: sentimentData.topKeywords,
        };
      });

    // If citizen is not allowed sentiment, strip those fields
    if (access.includeSentiment === false) {
      merged = merged.map((m) => {
        const { averageSentiment, topKeywords, ...rest } = m;
        return rest;
      });
    }

    logger.info(
      `Timeseries with sentiment for policy ${policyId} (${bucket}) delivered`,
    );
    return sendSuccess(res, { bucket, data: merged }, "Timeseries retrieved");
  } catch (err) {
    logger.error({ error: err.message }, "Timeseries error");
    return sendError(
      res,
      ErrorCodes.INTERNAL,
      "Failed to retrieve timeseries",
      null,
      500,
    );
  }
};

// ---------- Correlation for multipleChoice policies ----------
exports.getCorrelation = async (req, res) => {
  try {
    const { policyId } = req.params;
    const { minSupport = 10 } = req.query;

    const policy = await Policy.findById(policyId);
    if (!policy)
      return sendError(
        res,
        ErrorCodes.NOT_FOUND,
        "Policy not found",
        null,
        404,
      );
    if (policy.pollType !== "multipleChoice") {
      return sendError(
        res,
        ErrorCodes.VALIDATION,
        "Correlation only available for multipleChoice policies",
        null,
        400,
      );
    }

    const access = await checkAnalyticsAccess(policy, req.user, "correlation");
    if (!access.allowed)
      return sendError(
        res,
        access.errorCode,
        access.errorMessage,
        null,
        access.statusCode,
      );

    const votes = await Vote.find({ policyId: policy._id }, "value");
    const optionIds = policy.pollOptions.map((o) => o.id);

    // Build co‑occurrence matrix
    const coOccur = {};
    optionIds.forEach((a) => {
      coOccur[a] = {};
      optionIds.forEach((b) => {
        coOccur[a][b] = 0;
      });
    });
    let totalPairs = 0;
    votes.forEach((v) => {
      const selected = v.value;
      if (Array.isArray(selected) && selected.length > 1) {
        for (let i = 0; i < selected.length; i++) {
          for (let j = i + 1; j < selected.length; j++) {
            const a = selected[i];
            const b = selected[j];
            coOccur[a][b]++;
            coOccur[b][a]++;
            totalPairs++;
          }
        }
      }
    });

    const correlations = [];
    for (let i = 0; i < optionIds.length; i++) {
      for (let j = i + 1; j < optionIds.length; j++) {
        const a = optionIds[i];
        const b = optionIds[j];
        const count = coOccur[a][b];
        if (count >= minSupport) {
          correlations.push({
            optionA: a,
            optionB: b,
            coOccurrenceCount: count,
            percentage: totalPairs
              ? ((count / totalPairs) * 100).toFixed(1)
              : 0,
          });
        }
      }
    }

    logger.info(`Correlation for policy ${policyId} delivered`);
    return sendSuccess(
      res,
      { correlations, totalVotes: votes.length },
      "Correlation matrix retrieved",
    );
  } catch (err) {
    logger.error({ error: err.message }, "Correlation error");
    return sendError(
      res,
      ErrorCodes.INTERNAL,
      "Failed to compute correlation",
      null,
      500,
    );
  }
};

// ---------- Demographic breakdown (with sentiment) ----------
exports.getDemographicBreakdown = async (req, res) => {
  try {
    const { policyId } = req.params;
    const { dimension, startDate, endDate } = req.query;
    if (!dimension) {
      return sendError(
        res,
        ErrorCodes.VALIDATION,
        "dimension parameter required",
        null,
        400,
      );
    }

    const allowedDims = [
      "ageRange",
      "gender",
      "occupation",
      "education",
      "region",
    ];
    if (!allowedDims.includes(dimension)) {
      return sendError(
        res,
        ErrorCodes.VALIDATION,
        `Invalid dimension. Allowed: ${allowedDims.join(", ")}`,
        null,
        400,
      );
    }

    let start = parseDate(startDate, "startDate");
    let end = parseDate(endDate, "endDate");

    const policy = await Policy.findById(policyId);
    if (!policy)
      return sendError(
        res,
        ErrorCodes.NOT_FOUND,
        "Policy not found",
        null,
        404,
      );

    const access = await checkAnalyticsAccess(policy, req.user, "demographics");
    if (!access.allowed)
      return sendError(
        res,
        access.errorCode,
        access.errorMessage,
        null,
        access.statusCode,
      );

    if (access.allowTimeFilter === false) {
      start = null;
      end = null;
    }

    let groupField;
    if (dimension === "region") groupField = "$region";
    else groupField = `$demographics.${dimension}`;

    const voteFilter = { policyId: policy._id };
    if (start) voteFilter.createdAt = { $gte: start };
    if (end) voteFilter.createdAt = { ...voteFilter.createdAt, $lte: end };

    const pollType = policy.pollType;

    // ----- Vote aggregation -----
    let votePipeline = [{ $match: voteFilter }];
    if (pollType === "binary") {
      votePipeline.push({
        $group: {
          _id: groupField,
          totalVotes: { $sum: 1 },
          yesCount: { $sum: { $cond: [{ $eq: ["$value", "yes"] }, 1, 0] } },
        },
      });
    } else if (pollType === "multipleChoice") {
      votePipeline.push(
        { $unwind: { path: "$value", preserveNullAndEmptyArrays: false } },
        {
          $group: {
            _id: { group: groupField, option: "$value" },
            count: { $sum: 1 },
          },
        },
        { $sort: { "_id.group": 1, count: -1 } },
        {
          $group: {
            _id: "$_id.group",
            totalVotes: { $sum: "$count" },
            topOption: { $first: "$_id.option" },
            topOptionCount: { $first: "$count" },
          },
        },
      );
    } else if (pollType === "likert" || pollType === "rating") {
      votePipeline.push({
        $group: {
          _id: groupField,
          totalVotes: { $sum: 1 },
          sumValue: { $sum: { $ifNull: ["$value", 0] } },
        },
      });
    } else if (pollType === "approval") {
      votePipeline.push({
        $group: {
          _id: groupField,
          totalVotes: { $sum: 1 },
          approveCount: {
            $sum: { $cond: [{ $eq: ["$value", "approve"] }, 1, 0] },
          },
          rejectCount: {
            $sum: { $cond: [{ $eq: ["$value", "reject"] }, 1, 0] },
          },
        },
      });
    } else {
      return sendError(
        res,
        ErrorCodes.VALIDATION,
        `Cannot compute demographic breakdown for poll type ${pollType}`,
        null,
        400,
      );
    }

    // ----- Comment aggregation (sentiment + keywords) -----
    const commentFilter = {
      policyId: policy._id,
      visibility: "visible",
      aiStatus: "processed",
      parentCommentId: null, // ← add this
      $or: [
        { "reviewFlags.sentimentReviewNeeded": false },
        { "sentiment.overriddenByModerator": true },
      ],
    };
    if (start) commentFilter.createdAt = { $gte: start };
    if (end)
      commentFilter.createdAt = { ...commentFilter.createdAt, $lte: end };
    if (dimension !== "region") {
      commentFilter[`demographics.${dimension}`] = { $exists: true };
    }

    const commentPipeline = [
      { $match: commentFilter },
      {
        $group: {
          _id:
            dimension === "region" ? "$region" : `$demographics.${dimension}`,
          sentimentScores: { $push: "$sentiment.label" },
          keywordList: { $push: "$keywords" },
          commentCount: { $sum: 1 },
        },
      },
    ];

    const cacheKey = generateCacheKey(
      "analytics:demographics",
      policyId,
      dimension,
      JSON.stringify({ start, end, dimension }),
    );

    const [voteBreakdown, commentBreakdown] = await getOrSet(
      cacheKey,
      60,
      async () => {
        const votes = await Vote.aggregate(votePipeline);
        const comments = await Comment.aggregate(commentPipeline);
        return [votes, comments];
      },
    );

    const groupMap = new Map();
    for (const item of voteBreakdown) {
      const group = item._id || "unknown";
      let entry = { [dimension]: group, totalVotes: item.totalVotes };
      if (pollType === "binary") {
        entry.yesPercentage = item.totalVotes
          ? ((item.yesCount / item.totalVotes) * 100).toFixed(1)
          : 0;
      } else if (pollType === "multipleChoice") {
        entry.topOptionId = item.topOption;
        entry.topOptionPercentage = item.totalVotes
          ? ((item.topOptionCount / item.totalVotes) * 100).toFixed(1)
          : 0;
      } else if (pollType === "likert" || pollType === "rating") {
        entry.averageRating = item.totalVotes
          ? (item.sumValue / item.totalVotes).toFixed(2)
          : 0;
      } else if (pollType === "approval") {
        entry.approvePercentage = item.totalVotes
          ? ((item.approveCount / item.totalVotes) * 100).toFixed(1)
          : 0;
        entry.rejectPercentage = item.totalVotes
          ? ((item.rejectCount / item.totalVotes) * 100).toFixed(1)
          : 0;
        entry.netApproval = item.totalVotes
          ? (
              ((item.approveCount - item.rejectCount) / item.totalVotes) *
              100
            ).toFixed(1)
          : 0;
      }
      groupMap.set(group, entry);
    }

    for (const item of commentBreakdown) {
      const group = item._id || "unknown";
      const sentiments = item.sentimentScores;
      const allKeywords = item.keywordList.flat();
      let totalScore = 0;
      let count = 0;
      for (const s of sentiments) {
        if (s === "positive") totalScore += 1;
        else if (s === "negative") totalScore -= 1;
        else totalScore += 0;
        count++;
      }
      const avgSentiment = count ? (totalScore / count).toFixed(2) : 0;
      const keywordFreq = {};
      for (const kw of allKeywords) {
        if (kw) keywordFreq[kw] = (keywordFreq[kw] || 0) + 1;
      }
      const topKeywords = Object.entries(keywordFreq)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 3)
        .map(([kw, freq]) => ({ keyword: kw, count: freq }));

      if (groupMap.has(group)) {
        const existing = groupMap.get(group);
        existing.averageSentiment = parseFloat(avgSentiment);
        existing.topKeywords = topKeywords;
      } else {
        groupMap.set(group, {
          [dimension]: group,
          totalVotes: 0,
          totalComments: item.commentCount,
          averageSentiment: parseFloat(avgSentiment),
          topKeywords,
        });
      }
    }

    let formatted = Array.from(groupMap.values()).sort((a, b) =>
      (a[dimension] || "").localeCompare(b[dimension] || ""),
    );

    if (access.includeSentiment === false) {
      formatted = formatted.map(({ averageSentiment, topKeywords, ...rest }) => rest);
    }
    logger.info(`Demographic breakdown for ${policyId} by ${dimension}`);
    return sendSuccess(
      res,
      { dimension, data: formatted },
      "Demographic breakdown retrieved",
    );
  } catch (err) {
    logger.error({ error: err.message }, "Demographic breakdown error");
    return sendError(
      res,
      ErrorCodes.INTERNAL,
      "Failed to retrieve breakdown",
      null,
      500,
    );
  }
};

// ---------- CSV Export (enhanced) ----------
exports.exportAnalytics = async (req, res) => {
  try {
    const { policyId } = req.params;
    const {
      startDate,
      endDate,
      gender,
      ageRange,
      occupation,
      education,
      region,
    } = req.query;

    const start = parseDate(startDate, "startDate");
    const end = parseDate(endDate, "endDate");

    const policy = await Policy.findById(policyId);
    if (!policy) {
      return sendError(
        res,
        ErrorCodes.NOT_FOUND,
        "Policy not found",
        null,
        404,
      );
    }

    // Authorization: admin, owner, or accepted associate.
    const isAdmin = req.user.role === "admin";
    const isOwner = policy.createdBy.toString() === req.user.id.toString();
    let canExport = isAdmin || isOwner;

    if (!canExport && req.user.role === "planner") {
      const associate = await PolicyAssociate.findOne({
        policyId: policy._id,
        plannerId: req.user.id,
        invitationStatus: "accepted",
        revokedAt: null,
      });
      canExport = !!associate;
    }

    if (!canExport) {
      return sendError(
        res,
        ErrorCodes.FORBIDDEN,
        "You don't have permission to export data",
        null,
        403,
      );
    }

    let voteFilter = { policyId: policy._id };
    if (start) voteFilter.createdAt = { $gte: start };
    if (end) voteFilter.createdAt = { ...voteFilter.createdAt, $lte: end };
    if (gender) voteFilter["demographics.gender"] = gender;
    if (ageRange) voteFilter["demographics.ageRange"] = ageRange;
    if (occupation) voteFilter["demographics.occupation"] = occupation;
    if (education) voteFilter["demographics.education"] = education;
    if (region) voteFilter.region = region;

    const votes = await Vote.find(voteFilter).lean();

    let csv =
      "voteId,channel,value,region,ageRange,gender,occupation,education,createdAt\n";
    votes.forEach((v) => {
      const valueStr = Array.isArray(v.value) ? v.value.join("|") : v.value;
      csv += `${v._id},${v.channel},${valueStr},${v.region || ""},${v.demographics?.ageRange || ""},${v.demographics?.gender || ""},${v.demographics?.occupation || ""},${v.demographics?.education || ""},${v.createdAt.toISOString()}\n`;
    });

    res.setHeader("Content-Type", "text/csv");
    res.setHeader(
      "Content-Disposition",
      `attachment; filename="policy-${policyId}-export.csv"`,
    );
    return res.send(csv);
  } catch (err) {
    logger.error({ error: err.message }, "Export error");
    return sendError(
      res,
      ErrorCodes.INTERNAL,
      "Failed to export data",
      null,
      500,
    );
  }
};

// ---------- Comments list (with filtering) ----------
exports.getComments = async (req, res) => {
  try {
    const { policyId } = req.params;
    const {
      page = 1,
      limit = 20,
      sentiment,
      status,
      language,
      parentCommentId = null,
    } = req.query;

    const policy = await Policy.findById(policyId);
    if (!policy)
      return sendError(
        res,
        ErrorCodes.NOT_FOUND,
        "Policy not found",
        null,
        404,
      );

    const access = await checkAnalyticsAccess(policy, req.user, "comments");
    if (!access.allowed)
      return sendError(
        res,
        access.errorCode,
        access.errorMessage,
        null,
        access.statusCode,
      );

    const filter = { policyId: policy._id };
    if (parentCommentId === "null") filter.parentCommentId = null;
    else if (parentCommentId) filter.parentCommentId = parentCommentId;
    if (sentiment) filter["sentiment.label"] = sentiment;
    if (language) filter.language = language;

    // Map old status parameter to new fields
    if (status) {
      if (status === "none") {
        filter.visibility = "visible";
        filter.aiStatus = "processed";
        filter.$or = [
          { "reviewFlags.sentimentReviewNeeded": false },
          { "sentiment.overriddenByModerator": true },
        ];
      } else if (status === "needs_review") {
        filter.visibility = "visible";
        filter.aiStatus = "processed";
        filter["reviewFlags.sentimentReviewNeeded"] = true;
      } else if (status === "pending_ai") {
        filter.aiStatus = "pending";
      } else if (status === "flagged") {
        filter.reportState = { $in: ["reported", "under_review"] };
      }
    } else {
      // Default: show only approved comments (visible, processed, and either high confidence or overridden)
      filter.visibility = "visible";
      filter.aiStatus = "processed";
      filter.$or = [
        { "reviewFlags.sentimentReviewNeeded": false },
        { "sentiment.overriddenByModerator": true },
      ];
    }

    const comments = await Comment.find(filter)
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(Number(limit))
      .populate("userId", "displayName")
      .lean();
    const total = await Comment.countDocuments(filter);

    const formatted = comments.map((c) => {
      let moderationStatus;
      if (c.aiStatus === "pending") {
        moderationStatus = "pending_ai";
      } else if (c.aiStatus === "processed") {
        if (c.reviewFlags?.sentimentReviewNeeded) {
          moderationStatus = "needs_review";
        } else {
          moderationStatus = "none";
        }
      } else {
        moderationStatus = "pending_review";
      }
      const base = {
        id: c._id,
        text: c.text,
        moderationStatus: moderationStatus,
        visibility: c.visibility,
        isOfficialReply: c.isOfficialReply,
        createdAt: c.createdAt,
        userDisplayName: c.userId?.displayName || "Anonymous",
        isEdited: (c.editedHistory && c.editedHistory.length > 0) || false,
      };

      // Only include sentiment/keywords when allowed for citizens
      if (access.includeSentiment !== false) {
        base.sentiment = c.sentiment?.label;
        base.confidence = c.sentiment?.confidence;
        base.keywords = c.keywords;
      }
      return base;
    });
    return sendSuccess(
      res,
      { comments: formatted, total, page: Number(page) },
      "Comments retrieved",
    );
  } catch (err) {
    logger.error({ error: err.message }, "Get comments error");
    return sendError(
      res,
      ErrorCodes.INTERNAL,
      "Failed to retrieve comments",
      null,
      500,
    );
  }
};
// ---------- Heatmap (with caching) ----------
exports.getHeatmap = async (req, res) => {
  try {
    const {
      startDate,
      endDate,
      interval = "week",
      policyId,
      byRegion = "false",
      regions,
      gender,
      ageRange,
      occupation,
      education,
    } = req.query;
    const byRegionFlag = byRegion === "true";

    if (!policyId) {
      return sendError(
        res,
        ErrorCodes.VALIDATION,
        "policyId is required for heatmap",
        null,
        400,
      );
    }

    // Check access according to policy visibility (planners/admins allowed by checkAnalyticsAccess)

    const parseDate = (dateStr, paramName) => {
      if (!dateStr) return null;
      const d = new Date(dateStr);
      if (isNaN(d.getTime()))
        throw new Error(`Invalid ${paramName}: ${dateStr}`);
      return d;
    };

    let start, end;
    try {
      start = parseDate(startDate, "startDate");
      end = parseDate(endDate, "endDate");
    } catch (err) {
      return sendError(res, ErrorCodes.VALIDATION, err.message, null, 400);
    }

    if (!mongoose.Types.ObjectId.isValid(policyId)) {
      return sendError(
        res,
        ErrorCodes.VALIDATION,
        "Invalid policyId format",
        null,
        400,
      );
    }
    const policy = await Policy.findById(policyId);
    if (!policy)
      return sendError(
        res,
        ErrorCodes.NOT_FOUND,
        "Policy not found",
        null,
        404,
      );

    const access = await checkAnalyticsAccess(policy, req.user, "heatmap");
    if (!access.allowed) {
      return sendError(
        res,
        access.errorCode,
        access.errorMessage,
        null,
        access.statusCode,
      );
    }

    if (access.allowTimeFilter === false) {
      start = null;
      end = null;
    }

    // Build vote match with demographics
    const voteMatch = {
      policyId: new mongoose.Types.ObjectId(policyId),
      channel: "app",
      region: { $ne: null },
    };
    if (start) voteMatch.createdAt = { $gte: start };
    if (end) voteMatch.createdAt = { ...voteMatch.createdAt, $lte: end };
    if (regions) {
      const regionList = regions.split(",").map((r) => r.trim());
      voteMatch.region = { $in: regionList };
    }
    if (gender) voteMatch["demographics.gender"] = gender;
    if (ageRange) voteMatch["demographics.ageRange"] = ageRange;
    if (occupation) voteMatch["demographics.occupation"] = occupation;
    if (education) voteMatch["demographics.education"] = education;

    let dateFormat;
    switch (interval) {
      case "day":
        dateFormat = "%Y-%m-%d";
        break;
      case "week":
        dateFormat = "%Y-%V";
        break;
      case "month":
        dateFormat = "%Y-%m";
        break;
      default:
        dateFormat = "%Y-%V";
    }

    const pollType = policy.pollType;

    // ----- VOTE AGGREGATION -----
    let votePipeline = [{ $match: voteMatch }];
    let voteIdFields;
    if (byRegionFlag) {
      voteIdFields = {
        period: { $dateToString: { format: dateFormat, date: "$createdAt" } },
        region: "$region",
      };
    } else {
      voteIdFields = {
        $dateToString: { format: dateFormat, date: "$createdAt" },
      };
    }

    if (pollType === "binary") {
      votePipeline.push({
        $group: {
          _id: voteIdFields,
          totalVotes: { $sum: 1 },
          yesCount: { $sum: { $cond: [{ $eq: ["$value", "yes"] }, 1, 0] } },
        },
      });
    } else if (pollType === "multipleChoice") {
      votePipeline.push(
        { $unwind: { path: "$value", preserveNullAndEmptyArrays: false } },
        {
          $group: {
            _id: byRegionFlag
              ? {
                  period: {
                    $dateToString: { format: dateFormat, date: "$createdAt" },
                  },
                  region: "$region",
                  option: "$value",
                }
              : {
                  period: {
                    $dateToString: { format: dateFormat, date: "$createdAt" },
                  },
                  option: "$value",
                },
            count: { $sum: 1 },
          },
        },
        { $sort: { "_id.period": 1, "_id.region": 1, count: -1 } },
        {
          $group: {
            _id: byRegionFlag
              ? { period: "$_id.period", region: "$_id.region" }
              : { period: "$_id.period" },
            totalVotes: { $sum: "$count" },
            topOption: { $first: "$_id.option" },
            topOptionCount: { $first: "$count" },
          },
        },
      );
    } else if (pollType === "likert" || pollType === "rating") {
      votePipeline.push({
        $group: {
          _id: voteIdFields,
          totalVotes: { $sum: 1 },
          sumValue: { $sum: { $ifNull: ["$value", 0] } },
        },
      });
    } else if (pollType === "approval") {
      votePipeline.push({
        $group: {
          _id: voteIdFields,
          totalVotes: { $sum: 1 },
          approveCount: {
            $sum: { $cond: [{ $eq: ["$value", "approve"] }, 1, 0] },
          },
          rejectCount: {
            $sum: { $cond: [{ $eq: ["$value", "reject"] }, 1, 0] },
          },
        },
      });
    } else if (pollType === "rankedChoice") {
      votePipeline.push(
        { $addFields: { firstChoice: { $arrayElemAt: ["$value", 0] } } },
        { $match: { firstChoice: { $exists: true } } },
        {
          $group: {
            _id: byRegionFlag
              ? {
                  period: {
                    $dateToString: { format: dateFormat, date: "$createdAt" },
                  },
                  region: "$region",
                  firstChoice: "$firstChoice",
                }
              : {
                  period: {
                    $dateToString: { format: dateFormat, date: "$createdAt" },
                  },
                  firstChoice: "$firstChoice",
                },
            count: { $sum: 1 },
          },
        },
        { $sort: { "_id.period": 1, "_id.region": 1, count: -1 } },
        {
          $group: {
            _id: byRegionFlag
              ? { period: "$_id.period", region: "$_id.region" }
              : { period: "$_id.period" },
            totalVotes: { $sum: "$count" },
            topFirstChoice: { $first: "$_id.firstChoice" },
            topFirstChoiceCount: { $first: "$count" },
          },
        },
      );
    }

    const cacheKey = generateCacheKey(
      "analytics:heatmap",
      policyId,
      interval,
      byRegionFlag,
      JSON.stringify({
        start,
        end,
        regions,
        gender,
        ageRange,
        occupation,
        education,
      }),
    );

    const voteResults = await getOrSet(cacheKey, 60, async () => {
      return await Vote.aggregate(votePipeline);
    });

    const voteMap = new Map();
    for (const v of voteResults) {
      const key = byRegionFlag ? `${v._id.period}|${v._id.region}` : v._id;
      let obj = {
        totalVotes: v.totalVotes,
      };
      if (pollType === "binary") {
        const yes = v.yesCount;
        obj.yesPercentage = v.totalVotes
          ? ((yes / v.totalVotes) * 100).toFixed(1)
          : 0;
      } else if (pollType === "multipleChoice") {
        obj.topOptionId = v.topOption;
        obj.topOptionPercentage = v.totalVotes
          ? ((v.topOptionCount / v.totalVotes) * 100).toFixed(1)
          : 0;
      } else if (pollType === "likert" || pollType === "rating") {
        obj.averageRating = v.totalVotes
          ? (v.sumValue / v.totalVotes).toFixed(2)
          : 0;
      } else if (pollType === "approval") {
        obj.approvePercentage = v.totalVotes
          ? ((v.approveCount / v.totalVotes) * 100).toFixed(1)
          : 0;
        obj.netApproval = v.totalVotes
          ? (((v.approveCount - v.rejectCount) / v.totalVotes) * 100).toFixed(1)
          : 0;
      } else if (pollType === "rankedChoice") {
        obj.topFirstChoiceId = v.topFirstChoice;
        obj.topFirstChoicePercentage = v.totalVotes
          ? ((v.topFirstChoiceCount / v.totalVotes) * 100).toFixed(1)
          : 0;
      }
      voteMap.set(key, obj);
    }

    // ----- COMMENT AGGREGATION (sentiment + keywords) -----
    const commentMatch = {
      policyId: policy._id,
      visibility: "visible",
      aiStatus: "processed",
      parentCommentId: null, // ← add this
      $or: [
        { "reviewFlags.sentimentReviewNeeded": false },
        { "sentiment.overriddenByModerator": true },
      ],
    };
    if (start) commentMatch.createdAt = { $gte: start };
    if (end) commentMatch.createdAt = { ...commentMatch.createdAt, $lte: end };
    if (gender) commentMatch["demographics.gender"] = gender;
    if (ageRange) commentMatch["demographics.ageRange"] = ageRange;
    if (occupation) commentMatch["demographics.occupation"] = occupation;
    if (education) commentMatch["demographics.education"] = education;
    if (byRegionFlag && regions) {
      const regionList = regions.split(",").map((r) => r.trim());
      commentMatch.region = { $in: regionList };
    }

    let commentGroupId;
    if (byRegionFlag) {
      commentGroupId = {
        period: { $dateToString: { format: dateFormat, date: "$createdAt" } },
        region: "$region",
      };
    } else {
      commentGroupId = {
        $dateToString: { format: dateFormat, date: "$createdAt" },
      };
    }

    const commentPipeline = [
      { $match: commentMatch },
      {
        $group: {
          _id: commentGroupId,
          sentimentScores: { $push: "$sentiment.label" },
          keywordsList: { $push: "$keywords" },
        },
      },
    ];
    const commentResults = await Comment.aggregate(commentPipeline);
    const commentMap = new Map();
    for (const c of commentResults) {
      const key = byRegionFlag ? `${c._id.period}|${c._id.region}` : c._id;
      const sentiments = c.sentimentScores;
      const allKeywords = c.keywordsList.flat();
      let totalScore = 0;
      let count = 0;
      for (const s of sentiments) {
        if (s === "positive") totalScore += 1;
        else if (s === "negative") totalScore -= 1;
        else totalScore += 0;
        count++;
      }
      const avgSentiment = count ? (totalScore / count).toFixed(2) : 0;
      const keywordFreq = {};
      for (const kw of allKeywords) {
        if (kw) keywordFreq[kw] = (keywordFreq[kw] || 0) + 1;
      }
      const topKeywords = Object.entries(keywordFreq)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 3)
        .map(([kw, freq]) => ({ keyword: kw, count: freq }));
      commentMap.set(key, {
        averageSentiment: parseFloat(avgSentiment),
        topKeywords,
      });
    }

    const allKeys = new Set([...voteMap.keys(), ...commentMap.keys()]);
    let results = Array.from(allKeys)
      .sort()
      .map((key) => {
        const voteData = voteMap.get(key) || { totalVotes: 0 };
        const commentData = commentMap.get(key) || {
          averageSentiment: 0,
          topKeywords: [],
        };
        const [period, region] = byRegionFlag ? key.split("|") : [key, null];
        const base = {
          period,
          ...voteData,
          averageSentiment: commentData.averageSentiment,
          topKeywords: commentData.topKeywords,
        };
        if (byRegionFlag && region) base.region = region;
        return base;
      });

    if (access.includeSentiment === false) {
      results = results.map(({ averageSentiment, topKeywords, ...rest }) => rest);
    }

    logger.info(`Heatmap data generated for policy ${policyId}`);
    return sendSuccess(res, { interval, data: results }, "Heatmap retrieved");
  } catch (err) {
    logger.error({ error: err.message }, "Heatmap error");
    return sendError(
      res,
      ErrorCodes.INTERNAL,
      "Failed to retrieve heatmap",
      null,
      500,
    );
  }
};
