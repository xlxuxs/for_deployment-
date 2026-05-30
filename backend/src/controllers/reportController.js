const User = require("../models/User");
const Vote = require("../models/Vote");
const Comment = require("../models/Comment");
const Policy = require("../models/Policy");
const AuditLog = require("../models/AuditLog");
const {
  sendSuccess,
  sendError,
  ErrorCodes,
} = require("../utils/responseHelper");
const logger = require("../utils/logger");
const axios = require("axios");

const AI_BASE = process.env.AI_SERVICE_URL;
const base = AI_BASE;
const AI_HEALTH_URL = `${base}/health`;

const getAIHealth = async () => {
  try {
    const response = await axios.get(AI_HEALTH_URL, {
      timeout: 5000,
      headers: { "X-Internal-API-Key": process.env.INTERNAL_API_KEY },
    });
    return response.data;
  } catch (err) {
    return { status: "unreachable", error: err.message };
  }
};

// GET /admin/dashboard/stats
exports.getDashboardStats = async (req, res) => {
  try {
    const [
      totalCitizens,
      activeCitizens,
      verifiedCitizens,
      totalPlanners,
      activePlanners,
      totalPolicies,
      draftPolicies,
      activePolicies,
      closedPolicies,
      totalVotes,
      appVotes,
      smsVotes,
      totalComments,
      pendingComments,
      processedComments,
    ] = await Promise.all([
      User.countDocuments({ role: "citizen" }),
      User.countDocuments({ role: "citizen", active: true }),
      User.countDocuments({ role: "citizen", verified: true }),
      User.countDocuments({ role: "planner" }),
      User.countDocuments({ role: "planner", active: true }),
      Policy.countDocuments(),
      Policy.countDocuments({ status: "draft" }),
      Policy.countDocuments({ status: "active" }),
      Policy.countDocuments({ status: "closed" }),
      Vote.countDocuments(),
      Vote.countDocuments({ channel: "app" }),
      Vote.countDocuments({ channel: "sms" }),
      Comment.countDocuments(),
      Comment.countDocuments({
        $or: [
          { "reviewFlags.sentimentReviewNeeded": true },
          { aiStatus: "pending", lastAnalyzedAt: { $ne: null } },
          { "appeal.status": "pending" },
          {
            reportState: { $in: ["reported", "under_review"] },
            visibility: "hidden",
          },
        ],
      }),
      Comment.countDocuments({
        visibility: "visible",
        aiStatus: "processed",
        "reviewFlags.sentimentReviewNeeded": false,
      }),
    ]);

    // Calculate average rating from rating-type polls only
    const ratingAgg = await Vote.aggregate([
      {
        $lookup: {
          from: "policies",
          localField: "policyId",
          foreignField: "_id",
          as: "policy",
        },
      },
      {
        $match: {
          "policy.pollType": "rating",
        },
      },
      {
        $group: {
          _id: null,
          avg: { $avg: "$value" },
        },
      },
    ]);
    const avgRatingOverall =
      ratingAgg.length && ratingAgg[0].avg !== null
        ? parseFloat(ratingAgg[0].avg.toFixed(2))
        : 0;

    const aiHealth = await getAIHealth();

    return sendSuccess(
      res,
      {
        users: {
          total: totalCitizens,
          active: activeCitizens,
          verified: verifiedCitizens,
        },
        planners: {
          total: totalPlanners,
          active: activePlanners,
        },
        policies: {
          total: totalPolicies,
          draft: draftPolicies,
          active: activePolicies,
          closed: closedPolicies,
        },
        votes: {
          total: totalVotes,
          app: appVotes,
          sms: smsVotes,
          averageRating: avgRatingOverall,
        },
        comments: {
          total: totalComments,
          pendingReview: pendingComments,
          processed: processedComments,
        },
        aiHealth,
      },
      "Dashboard statistics retrieved successfully",
    );
  } catch (err) {
    logger.error(
      { error: err.message, stack: err.stack },
      "Dashboard stats error",
    );
    return sendError(
      res,
      ErrorCodes.INTERNAL,
      "Failed to retrieve dashboard stats",
      null,
      500,
    );
  }
};

// GET /admin/trends?interval=day&days=30
exports.getTrends = async (req, res) => {
  try {
    const {
      interval = "day",
      days = 30,
      startDate: startDateParam,
      endDate: endDateParam,
    } = req.query;

    const now = new Date();
    const daysInt = parseInt(days);
    let startDate, endDate;

    if (startDateParam) {
      startDate = new Date(startDateParam);
    } else {
      startDate = new Date(now);
      startDate.setDate(startDate.getDate() - daysInt);
    }

    if (endDateParam) {
      endDate = new Date(endDateParam);
    } else {
      endDate = new Date(now);
    }

    if (isNaN(startDate.getTime())) {
      startDate = new Date(now);
      startDate.setDate(startDate.getDate() - daysInt);
    }
    if (isNaN(endDate.getTime())) {
      endDate = new Date(now);
    }

    let groupFormat;
    if (interval === "week") groupFormat = "%Y-%U";
    else if (interval === "month") groupFormat = "%Y-%m";
    else groupFormat = "%Y-%m-%d";

    const votesMatch = { createdAt: { $gte: startDate } };
    if (endDate) votesMatch.createdAt.$lte = endDate;

    const votesTrend = await Vote.aggregate([
      { $match: votesMatch },
      {
        $group: {
          _id: { $dateToString: { format: groupFormat, date: "$createdAt" } },
          count: { $sum: 1 },
        },
      },
      { $sort: { _id: 1 } },
    ]);

    const usersMatch = { role: "citizen", createdAt: { $gte: startDate } };
    if (endDate) usersMatch.createdAt.$lte = endDate;

    const usersTrend = await User.aggregate([
      { $match: usersMatch },
      {
        $group: {
          _id: { $dateToString: { format: groupFormat, date: "$createdAt" } },
          newUsers: { $sum: 1 },
        },
      },
      { $sort: { _id: 1 } },
    ]);

    const trendMap = new Map();
    for (const v of votesTrend) {
      trendMap.set(v._id, {
        date: v._id,
        votes: v.count,
        newUsers: 0,
      });
    }
    for (const u of usersTrend) {
      if (trendMap.has(u._id)) {
        trendMap.get(u._id).newUsers = u.newUsers;
      } else {
        trendMap.set(u._id, {
          date: u._id,
          votes: 0,
          newUsers: u.newUsers,
        });
      }
    }

    const data = Array.from(trendMap.values()).sort((a, b) =>
      a.date.localeCompare(b.date),
    );

    const totalVotes = data.reduce((sum, item) => sum + (item.votes || 0), 0);
    const totalNewUsers = data.reduce(
      (sum, item) => sum + (item.newUsers || 0),
      0,
    );

    return sendSuccess(
      res,
      {
        interval,
        data,
        totalVotes,
        newUsers: totalNewUsers,
      },
      "Trends retrieved successfully",
    );
  } catch (err) {
    logger.error({ error: err.message, stack: err.stack }, "Trends error");
    return sendError(
      res,
      ErrorCodes.INTERNAL,
      "Failed to retrieve trends",
      null,
      500,
    );
  }
};

// GET /admin/audit-logs?page=1&limit=20&action=LOGIN&userId=...
exports.getAuditLogs = async (req, res) => {
  try {
    const {
      page = 1,
      limit = 20,
      action,
      userId,
      userRole,
      startDate,
      endDate,
    } = req.query;
    const filter = {};
    if (action) filter.action = new RegExp(action, "i");
    if (userId) filter.userId = userId;
    if (userRole) filter.userRole = userRole;
    if (startDate || endDate) {
      filter.timestamp = {};
      if (startDate) filter.timestamp.$gte = new Date(startDate);
      if (endDate) filter.timestamp.$lte = new Date(endDate);
    }

    const skip = (parseInt(page) - 1) * parseInt(limit);
    const [logs, total] = await Promise.all([
      AuditLog.find(filter)
        .sort({ timestamp: -1 })
        .skip(skip)
        .limit(parseInt(limit))
        .populate("userId", "email role"),
      AuditLog.countDocuments(filter),
    ]);

    return sendSuccess(
      res,
      { logs, total, page: parseInt(page), pages: Math.ceil(total / limit) },
      "Audit logs retrieved successfully",
    );
  } catch (err) {
    logger.error(
      { error: err.message, stack: err.stack },
      "Get audit logs error",
    );
    return sendError(
      res,
      ErrorCodes.INTERNAL,
      "Failed to retrieve audit logs",
      null,
      500,
    );
  }
};

// GET /admin/audit-logs/export
exports.exportAuditLogs = async (req, res) => {
  try {
    const { action, userId, userRole, startDate, endDate } = req.query;
    const filter = {};
    if (action) filter.action = new RegExp(action, "i");
    if (userId) filter.userId = userId;
    if (userRole) filter.userRole = userRole;
    if (startDate || endDate) {
      filter.timestamp = {};
      if (startDate) filter.timestamp.$gte = new Date(startDate);
      if (endDate) filter.timestamp.$lte = new Date(endDate);
    }

    const logs = await AuditLog.find(filter)
      .sort({ timestamp: -1 })
      .populate("userId", "email role")
      .lean();

    let csv =
      "timestamp,userEmail,userRole,action,targetType,targetId,details,ipAddress,userAgent\n";
    for (const log of logs) {
      const userEmail = log.userId?.email || "unknown";
      const userRole = log.userRole || log.userId?.role || "unknown";
      const details = JSON.stringify(log.details || {}).replace(/,/g, ";");
      csv += `"${log.timestamp}","${userEmail}","${userRole}","${log.action}","${log.targetType || ""}","${log.targetId || ""}","${details}","${log.ipAddress || ""}","${log.userAgent || ""}"\n`;
    }

    res.setHeader("Content-Type", "text/csv");
    res.setHeader(
      "Content-Disposition",
      `attachment; filename="audit-logs-${Date.now()}.csv"`,
    );
    return res.send(csv);
  } catch (err) {
    logger.error(
      { error: err.message, stack: err.stack },
      "Export audit logs error",
    );
    return sendError(
      res,
      ErrorCodes.INTERNAL,
      "Failed to export audit logs",
      null,
      500,
    );
  }
};

// GET /admin/ai/health
exports.getAIHealth = async (req, res) => {
  try {
    const health = await getAIHealth();
    const pendingComments = await Comment.countDocuments({
      $or: [
        { "reviewFlags.sentimentReviewNeeded": true },
        { aiStatus: "pending", lastAnalyzedAt: { $ne: null } },
      ],
    });
    const failedComments = await Comment.countDocuments({
      $or: [
        { "reviewFlags.sentimentReviewNeeded": true },
        { aiStatus: "failed" },
      ],
      retryCount: { $gte: 5 },
    });
    return sendSuccess(
      res,
      { ...health, pendingComments, failedComments },
      "AI service health retrieved",
    );
  } catch (err) {
    logger.error({ error: err.message, stack: err.stack }, "AI health error");
    return sendError(
      res,
      ErrorCodes.INTERNAL,
      "Failed to retrieve AI health",
      null,
      500,
    );
  }
};
