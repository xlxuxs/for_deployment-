const Policy = require("../models/Policy");
const Vote = require("../models/Vote");
const Comment = require("../models/Comment");
const {
  sendSuccess,
  sendError,
  ErrorCodes,
} = require("../utils/responseHelper");

const mongoose = require("mongoose");

function toIdString(value) {
  return value ? value.toString() : "";
}

exports.getLandingData = async (_req, res) => {
  try {
    const closedPolicies = await Policy.find({ status: "closed" })
      .sort({ endDate: -1, createdAt: -1 })
      .limit(10)
      .populate("createdBy", "email");

    const policyIds = closedPolicies.map((policy) => policy._id);

    const [voteStats, commentStats] = await Promise.all([
      Vote.aggregate([
        { $match: { policyId: { $in: policyIds } } },
        {
          $group: {
            _id: "$policyId",
            totalVotes: { $sum: 1 },
          },
        },
      ]),
      Comment.aggregate([
        {
          $match: {
            policyId: { $in: policyIds },
            visibility: "visible",
          },
        },
        {
          $group: {
            _id: "$policyId",
            totalComments: { $sum: 1 },
            positive: {
              $sum: { $cond: [{ $eq: ["$sentiment.label", "positive"] }, 1, 0] },
            },
            negative: {
              $sum: { $cond: [{ $eq: ["$sentiment.label", "negative"] }, 1, 0] },
            },
            neutral: {
              $sum: { $cond: [{ $eq: ["$sentiment.label", "neutral"] }, 1, 0] },
            },
          },
        },
      ]),
    ]);

    const votesByPolicy = new Map(
      voteStats.map((entry) => [toIdString(entry._id), entry.totalVotes]),
    );
    const commentsByPolicy = new Map(
      commentStats.map((entry) => [
        toIdString(entry._id),
        {
          totalComments: entry.totalComments,
          sentiment: {
            positive: entry.positive,
            negative: entry.negative,
            neutral: entry.neutral,
          },
        },
      ]),
    );

    // Only include closed policies that are explicitly marked public via citizenAnalyticsVisibility
    const policies = closedPolicies
      .map((policy) => {
        const vis = policy.citizenAnalyticsVisibility || {};
        const allAllowed = vis.showResults && vis.showBreakdown && vis.showComments && vis.showSentiment && vis.allowTimeFilter;
        if (!allAllowed) return null;
        const policyId = toIdString(policy._id);
        const voteCount = votesByPolicy.get(policyId) || 0;
        const commentSummary = commentsByPolicy.get(policyId) || {
          totalComments: 0,
          sentiment: { positive: 0, negative: 0, neutral: 0 },
        };

        return {
          id: policyId,
          title: policy.title,
          description: policy.description,
          policyCode: policy.policyCode,
          targetRegions: policy.targetRegions,
          endDate: policy.endDate,
          voteCount,
          commentCount: commentSummary.totalComments,
          sentiment: commentSummary.sentiment,
        };
      })
      .filter(Boolean)
      .sort((left, right) => right.voteCount - left.voteCount || new Date(right.endDate) - new Date(left.endDate));

    const summary = policies.reduce(
      (accumulator, policy) => {
        accumulator.totalVotes += policy.voteCount;
        accumulator.totalComments += policy.commentCount;
        accumulator.positive += policy.sentiment.positive;
        accumulator.negative += policy.sentiment.negative;
        accumulator.neutral += policy.sentiment.neutral;
        return accumulator;
      },
      {
        closedPolicies: policies.length,
        totalVotes: 0,
        totalComments: 0,
        positive: 0,
        negative: 0,
        neutral: 0,
      },
    );

    return sendSuccess(
      res,
      {
        summary,
        policies,
      },
      "Public landing data retrieved",
    );
  } catch (err) {
    console.error(err);
    return sendError(
      res,
      ErrorCodes.INTERNAL,
      "Failed to load public landing data",
      null,
      500,
    );
  }
};

// Public policy analytics for closed policies where citizen visibility is fully enabled
exports.getPolicyAnalytics = async (req, res) => {
  try {
    const { id } = req.params;
    if (!mongoose.Types.ObjectId.isValid(id))
      return sendError(res, ErrorCodes.VALIDATION, "Invalid policy id", null, 400);

    const policy = await Policy.findById(id);
    if (!policy) return sendError(res, ErrorCodes.NOT_FOUND, "Policy not found", null, 404);

    if (policy.status !== "closed")
      return sendError(res, ErrorCodes.NOT_FOUND, "Policy not available", null, 404);

    const vis = policy.citizenAnalyticsVisibility || {};
    // Only expose to public when all visibility flags are enabled
    const allAllowed = vis.showResults && vis.showBreakdown && vis.showComments && vis.showSentiment && vis.allowTimeFilter;
    if (!allAllowed) return sendError(res, ErrorCodes.FORBIDDEN, "Policy not public", null, 403);

    // Basic vote aggregation
    const votes = await Vote.find({ policyId: policy._id });
    const totalVotes = votes.length;
    let voteAgg = { totalVotes };
    switch (policy.pollType) {
      case "binary": {
        const yesCount = votes.filter((v) => v.value === "yes").length;
        const noCount = totalVotes - yesCount;
        voteAgg = {
          totalVotes,
          yesCount,
          noCount,
          yesPercentage: totalVotes ? ((yesCount / totalVotes) * 100).toFixed(1) : 0,
          noPercentage: totalVotes ? ((noCount / totalVotes) * 100).toFixed(1) : 0,
        };
        break;
      }
      case "multipleChoice": {
        const optionCounts = {};
        (policy.pollOptions || []).forEach((opt) => (optionCounts[opt.id] = 0));
        votes.forEach((v) => {
          if (Array.isArray(v.value)) v.value.forEach((o) => { if (optionCounts[o] !== undefined) optionCounts[o]++; });
        });
        voteAgg = {
          totalVotes,
          results: (policy.pollOptions || []).map((opt) => ({ id: opt.id, text: opt.text, count: optionCounts[opt.id] || 0 })),
        };
        break;
      }
      case "likert":
      case "rating": {
        const values = votes.map((v) => v.value);
        const sum = values.reduce((a, b) => a + b, 0);
        const avg = totalVotes ? (sum / totalVotes).toFixed(2) : 0;
        const distribution = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
        values.forEach((v) => (distribution[v] = (distribution[v] || 0) + 1));
        voteAgg = { totalVotes, average: parseFloat(avg), distribution };
        break;
      }
      case "approval": {
        const approveCount = votes.filter((v) => v.value === "approve").length;
        const rejectCount = votes.filter((v) => v.value === "reject").length;
        const abstainCount = votes.filter((v) => v.value === "abstain").length;
        voteAgg = {
          totalVotes,
          approveCount,
          rejectCount,
          abstainCount,
        };
        break;
      }
      default:
        voteAgg = { totalVotes };
    }

    // Comments sentiment and keywords
    const comments = await Comment.find({ policyId: policy._id, visibility: "visible", aiStatus: "processed", parentCommentId: null }).lean();
    const sentimentCounts = { positive: 0, negative: 0, neutral: 0 };
    const keywordFreq = {};
    comments.forEach((c) => {
      if (c.sentiment?.label) sentimentCounts[c.sentiment.label]++;
      if (c.keywords) c.keywords.forEach((kw) => { keywordFreq[kw] = (keywordFreq[kw] || 0) + 1; });
    });
    const topKeywords = Object.entries(keywordFreq).sort((a, b) => b[1] - a[1]).slice(0, 10).map(([keyword, count]) => ({ keyword, count }));

    return sendSuccess(res, {
      policyId: policy._id,
      title: policy.title,
      description: policy.description,
      pollType: policy.pollType,
      ...voteAgg,
      sentimentCounts,
      topKeywords,
    }, "Public analytics retrieved");
  } catch (err) {
    console.error(err);
    return sendError(res, ErrorCodes.INTERNAL, "Failed to retrieve public analytics", null, 500);
  }
};

exports.getPolicyComments = async (req, res) => {
  try {
    const { id } = req.params;
    if (!mongoose.Types.ObjectId.isValid(id))
      return sendError(res, ErrorCodes.VALIDATION, "Invalid policy id", null, 400);

    const policy = await Policy.findById(id);
    if (!policy) return sendError(res, ErrorCodes.NOT_FOUND, "Policy not found", null, 404);

    if (policy.status !== "closed")
      return sendError(res, ErrorCodes.NOT_FOUND, "Policy not available", null, 404);

    const vis = policy.citizenAnalyticsVisibility || {};
    const allAllowed = vis.showResults && vis.showBreakdown && vis.showComments && vis.showSentiment && vis.allowTimeFilter;
    if (!allAllowed) return sendError(res, ErrorCodes.FORBIDDEN, "Policy not public", null, 403);

    const comments = await Comment.find({ policyId: policy._id, visibility: "visible", aiStatus: "processed", parentCommentId: null })
      .sort({ createdAt: -1 })
      .lean();

    const formatted = comments.map((c) => ({
      id: c._id,
      text: c.text,
      sentiment: c.sentiment?.label,
      confidence: c.sentiment?.confidence,
      keywords: c.keywords,
      createdAt: c.createdAt,
    }));

    return sendSuccess(res, { comments: formatted, total: formatted.length }, "Public comments retrieved");
  } catch (err) {
    console.error(err);
    return sendError(res, ErrorCodes.INTERNAL, "Failed to retrieve public comments", null, 500);
  }
};