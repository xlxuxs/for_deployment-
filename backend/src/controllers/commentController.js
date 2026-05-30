const mongoose = require("mongoose");
const Comment = require("../models/Comment");
const Policy = require("../models/Policy");
const logger = require("../utils/logger");
const {
  sendSuccess,
  sendError,
  ErrorCodes,
} = require("../utils/responseHelper");
const { createNotification } = require("../services/notificationService");
const { createAuditLog } = require("../utils/audit");

const REPORT_AUTO_HIDE_THRESHOLD = 5;
const COMMENT_MODERATOR_ROLES = ["planner", "comment_moderator", "admin"];

const createEvent = ({ type, actor = null, data = {} }) => ({
  type,
  actor,
  data,
  createdAt: new Date(),
});

const canEditComment = (comment) => {
  if (!comment) return false;
  return comment.visibility !== "deleted" && comment.visibility !== "removed";
};

const buildVisibilityFilter = (user) => {
  if (user?.role === "admin") return {};
  if (user?.role === "comment_moderator") return {};
  if (user?.role === "planner") return { visibility: { $ne: "removed" } };
  return { visibility: "visible" };
};

const buildSortOption = (sort) => {
  switch (sort) {
    case "top":
      return { replyCount: -1, createdAt: -1 };
    case "old":
      return { createdAt: 1 };
    case "controversial":
      return { reportCount: -1, createdAt: -1 };
    default:
      return { createdAt: -1 };
  }
};

// Helper to get the latest version of a comment thread
const getLatestVersion = async (originalCommentId) => {
  const query = originalCommentId
    ? { originalCommentId }
    : { originalCommentId: null };
  const latest = await Comment.findOne(query).sort({ versionNumber: -1 });
  return latest;
};

// Helper to create a new version (copy aiStatus and demographics)
const createNewVersion = async (originalComment, updates) => {
  const latestVersion = await getLatestVersion(originalComment._id);
  const newVersionNumber = (latestVersion?.versionNumber || 0) + 1;
  const newVersion = new Comment({
    originalCommentId: originalComment.originalCommentId || originalComment._id,
    versionNumber: newVersionNumber,
    userId: originalComment.userId,
    policyId: originalComment.policyId,
    parentCommentId: originalComment.parentCommentId,
    text: updates.text,
    visibility: "visible",
    aiStatus: originalComment.aiStatus, // preserve aiStatus (e.g., "skipped" for replies)
    reportState: "clean",
    reports: [],
    appeal: null,
    moderationActions: [],
    reviewFlags: {
      sentimentReviewNeeded: false,
      moderationReviewNeeded: false,
    },
    demographics: originalComment.demographics, // preserve demographics snapshot
    events: [
      createEvent({
        type: "version_created",
        actor: updates.actor,
        data: {
          previousVersionId: originalComment._id,
          reason: updates.reason,
        },
      }),
    ],
  });
  await newVersion.save();
  return newVersion;
};

// POST COMMENT (first version)
exports.postComment = async (req, res) => {
  try {
    const { policyId, text, parentCommentId = null } = req.body;
    if (!policyId || !text?.trim()) {
      return sendError(
        res,
        ErrorCodes.VALIDATION,
        "policyId and text are required",
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

    let parentComment = null;
    if (parentCommentId) {
      parentComment = await Comment.findById(parentCommentId);
      if (!parentComment)
        return sendError(
          res,
          ErrorCodes.NOT_FOUND,
          "Parent comment not found",
          null,
          404,
        );
      if (parentComment.visibility === "deleted") {
        return sendError(
          res,
          ErrorCodes.VALIDATION,
          "Cannot reply to deleted comment",
          null,
          400,
        );
      }
    }

    const user = req.user;
    const comment = new Comment({
      userId: req.user.id,
      policyId,
      parentCommentId: parentCommentId || null,
      text: text.trim(),
      originalCommentId: null,
      versionNumber: 1,
      visibility: "visible",
      aiStatus: parentCommentId ? "skipped" : "pending",
      reportState: "clean",
      reports: [],
      demographics: {
        ageRange: user.ageRange,
        gender: user.gender,
        occupation: user.occupation,
        education: user.education,
      },
      events: [
        createEvent({
          type: "created",
          actor: req.user.id,
          data: { text: text.trim() },
        }),
      ],
    });
    await comment.save();

    if (parentComment) {
      parentComment.replyCount += 1;
      await parentComment.save();
    }

    logger.info(`Comment created: ${comment._id} by user ${req.user.id}`);
    return sendSuccess(res, comment, "Comment created successfully");
  } catch (err) {
    logger.error({ error: err.message }, "Post comment error");
    return sendError(
      res,
      ErrorCodes.INTERNAL,
      "Failed to create comment",
      null,
      500,
    );
  }
};
// =====================================================
// EDIT COMMENT (with versioning)
// =====================================================
exports.editComment = async (req, res) => {
  try {
    const { id } = req.params;
    const { text } = req.body;
    if (!text?.trim())
      return sendError(
        res,
        ErrorCodes.VALIDATION,
        "Text is required",
        null,
        400,
      );

    const comment = await Comment.findById(id);
    if (!comment)
      return sendError(
        res,
        ErrorCodes.NOT_FOUND,
        "Comment not found",
        null,
        404,
      );
    if (comment.userId.toString() !== req.user.id.toString()) {
      return sendError(
        res,
        ErrorCodes.FORBIDDEN,
        "You do not own this comment",
        null,
        403,
      );
    }
    if (!canEditComment(comment))
      return sendError(
        res,
        ErrorCodes.VALIDATION,
        "Comment cannot be edited",
        null,
        400,
      );

    // Find the latest version of this thread
    const threadId = comment.originalCommentId || comment._id;
    const latestVersion = await getLatestVersion(threadId);

    // If the latest version is pending and never analysed, replace it
    if (
      latestVersion.aiStatus === "pending" &&
      latestVersion.lastAnalyzedAt === null
    ) {
      latestVersion.text = text.trim();
      latestVersion.editedAt = new Date();
      latestVersion.editCount += 1;
      latestVersion.events.push(
        createEvent({
          type: "edited",
          actor: req.user.id,
          data: { previousText: latestVersion.text, newText: text.trim() },
        }),
      );
      await latestVersion.save();
      logger.info(`Comment updated (in‑place) : ${latestVersion._id}`);
      return sendSuccess(res, latestVersion, "Comment updated successfully");
    }

    // Otherwise, create a new version
    const newVersion = await createNewVersion(latestVersion, {
      text: text.trim(),
      actor: req.user.id,
      reason: "user_edit",
    });
    logger.info(`New version created: ${newVersion._id} (was edit of ${id})`);
    return sendSuccess(
      res,
      newVersion,
      "Comment updated (new version created)",
    );
  } catch (err) {
    logger.error({ error: err.message }, "Edit comment error");
    return sendError(
      res,
      ErrorCodes.INTERNAL,
      "Failed to edit comment",
      null,
      500,
    );
  }
};

// =====================================================
// DELETE COMMENT (soft delete all versions)
// =====================================================
exports.deleteComment = async (req, res) => {
  try {
    const { id } = req.params;
    const comment = await Comment.findById(id);
    if (!comment)
      return sendError(
        res,
        ErrorCodes.NOT_FOUND,
        "Comment not found",
        null,
        404,
      );

    const isOwner = comment.userId.toString() === req.user.id.toString();
    const isAdmin = req.user.role === "admin";
    if (!isOwner && !isAdmin)
      return sendError(res, ErrorCodes.FORBIDDEN, "Unauthorized", null, 403);

    const threadId = comment.originalCommentId || comment._id;
    const allVersions = await Comment.find({
      $or: [{ _id: threadId }, { originalCommentId: threadId }],
    });

    for (const ver of allVersions) {
      ver.visibility = "deleted";
      ver.events.push(createEvent({ type: "deleted", actor: req.user.id }));
      if (ver.appeal?.status === "pending") {
        ver.appeal.status = "rejected";
        ver.appeal.resolvedAt = new Date();
        ver.appeal.resolvedBy = req.user.id;
      }
      await ver.save();
    }

    logger.info(`All versions of comment thread ${threadId} deleted`);
    return sendSuccess(res, null, "Comment deleted successfully");
  } catch (err) {
    logger.error({ error: err.message }, "Delete comment error");
    return sendError(
      res,
      ErrorCodes.INTERNAL,
      "Failed to delete comment",
      null,
      500,
    );
  }
};

// =====================================================
// RESTORE COMMENT (restore a single version)
// =====================================================
exports.restoreComment = async (req, res) => {
  try {
    const { id } = req.params;
    const comment = await Comment.findById(id);
    if (!comment)
      return sendError(
        res,
        ErrorCodes.NOT_FOUND,
        "Comment not found",
        null,
        404,
      );

    const isOwner = comment.userId.toString() === req.user.id.toString();
    const isAdmin = req.user.role === "admin";
    if (!isOwner && !isAdmin)
      return sendError(res, ErrorCodes.FORBIDDEN, "Unauthorized", null, 403);

    comment.visibility = "visible";
    comment.events.push(createEvent({ type: "restored", actor: req.user.id }));
    await comment.save();

    logger.info(`Comment restored: ${comment._id}`);
    return sendSuccess(res, comment, "Comment restored successfully");
  } catch (err) {
    logger.error({ error: err.message }, "Restore comment error");
    return sendError(
      res,
      ErrorCodes.INTERNAL,
      "Failed to restore comment",
      null,
      500,
    );
  }
};

// =====================================================
// GET POLICY COMMENTS (only latest version per thread)
// =====================================================
exports.getPolicyComments = async (req, res) => {
  try {
    const { policyId } = req.params;
    const {
      page = 1,
      limit = 20,
      sort = "new",
      sentiment,
      visibility,
      reportState,
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

    const filter = { policyId, ...buildVisibilityFilter(req.user) };
    if (parentCommentId === "null" || parentCommentId === null)
      filter.parentCommentId = null;
    else if (parentCommentId) filter.parentCommentId = parentCommentId;
    if (sentiment) filter["sentiment.label"] = sentiment;
    if (visibility && ["planner", "admin"].includes(req.user.role))
      filter.visibility = visibility;
    if (reportState) filter.reportState = reportState;

    const pipeline = [
      { $match: filter },
      { $sort: { versionNumber: -1, createdAt: -1 } },
      {
        $group: {
          _id: { $ifNull: ["$originalCommentId", "$_id"] },
          doc: { $first: "$$ROOT" },
        },
      },
      { $replaceRoot: { newRoot: "$doc" } },
      { $sort: buildSortOption(sort) },
      { $skip: (page - 1) * limit },
      { $limit: Number(limit) },
    ];

    const comments = await Comment.aggregate(pipeline);
    const total = await Comment.aggregate([
      { $match: filter },
      { $group: { _id: { $ifNull: ["$originalCommentId", "$_id"] } } },
      { $count: "total" },
    ]);

    // Fetch user displayNames for all comment userIds
    const userIds = [
      ...new Set(comments.map((c) => c.userId).filter((id) => id)),
    ];
    let userMap = new Map();
    if (userIds.length) {
      const users = await User.find({ _id: { $in: userIds } })
        .select("displayName")
        .lean();
      userMap = new Map(users.map((u) => [u._id.toString(), u.displayName]));
    }

    const formatted = comments.map((c) => ({
      id: c._id,
      text: c.text,
      user: c.userId
        ? {
            id: c.userId,
            displayName: userMap.get(c.userId.toString()) || "Anonymous",
          }
        : null,
      policyId: c.policyId,
      parentCommentId: c.parentCommentId,
      visibility: c.visibility,
      reportState: c.reportState,
      reportCount: c.reportCount,
      sentiment: c.sentiment,
      keywords: c.keywords,
      replyCount: c.replyCount,
      isOfficialReply: c.isOfficialReply,
      aiStatus: c.aiStatus,
      editedAt: c.editedAt,
      editCount: c.editCount,
      createdAt: c.createdAt,
      updatedAt: c.updatedAt,
    }));

    return sendSuccess(
      res,
      {
        comments: formatted,
        pagination: {
          total: total[0]?.total || 0,
          page: Number(page),
          limit: Number(limit),
          pages: Math.ceil((total[0]?.total || 0) / limit),
        },
      },
      "Comments retrieved",
    );
  } catch (err) {
    logger.error({ error: err.message }, "Get policy comments error");
    return sendError(
      res,
      ErrorCodes.INTERNAL,
      "Failed to retrieve comments",
      null,
      500,
    );
  }
};

// =====================================================
// GET COMMENT BY ID (returns the specific version)
// =====================================================
exports.getCommentById = async (req, res) => {
  try {
    const { id } = req.params;
    const filter = { _id: id, ...buildVisibilityFilter(req.user) };
    const comment = await Comment.findOne(filter)
      .populate("userId", "displayName") // only displayName
      .lean();
    if (!comment)
      return sendError(
        res,
        ErrorCodes.NOT_FOUND,
        "Comment not found",
        null,
        404,
      );

    const formatted = {
      id: comment._id,
      text: comment.text,
      user: comment.userId
        ? {
            id: comment.userId._id,
            displayName: comment.userId.displayName,
          }
        : null,
      policyId: comment.policyId,
      parentCommentId: comment.parentCommentId,
      visibility: comment.visibility,
      reportState: comment.reportState,
      reportCount: comment.reportCount,
      sentiment: comment.sentiment,
      keywords: comment.keywords,
      replyCount: comment.replyCount,
      isOfficialReply: comment.isOfficialReply,
      aiStatus: comment.aiStatus,
      editedAt: comment.editedAt,
      editCount: comment.editCount,
      createdAt: comment.createdAt,
      updatedAt: comment.updatedAt,
      versionNumber: comment.versionNumber,
      originalCommentId: comment.originalCommentId,
    };
    return sendSuccess(res, formatted, "Comment retrieved");
  } catch (err) {
    logger.error({ error: err.message }, "Get comment by ID error");
    return sendError(
      res,
      ErrorCodes.INTERNAL,
      "Failed to retrieve comment",
      null,
      500,
    );
  }
};

// =====================================================
// GET ALL VERSIONS OF A COMMENT THREAD (for history)
// =====================================================
exports.getCommentVersions = async (req, res) => {
  try {
    const { id } = req.params;
    const comment = await Comment.findById(id);
    if (!comment)
      return sendError(
        res,
        ErrorCodes.NOT_FOUND,
        "Comment not found",
        null,
        404,
      );

    const threadId = comment.originalCommentId || comment._id;
    const versions = await Comment.find({
      $or: [{ _id: threadId }, { originalCommentId: threadId }],
    })
      .sort({ versionNumber: 1 })
      .lean();

    const formatted = versions.map((v) => ({
      id: v._id,
      versionNumber: v.versionNumber,
      text: v.text,
      sentiment: v.sentiment,
      keywords: v.keywords,
      aiStatus: v.aiStatus,
      reviewFlags: v.reviewFlags,
      createdAt: v.createdAt,
      editedAt: v.editedAt,
      editCount: v.editCount,
    }));

    return sendSuccess(
      res,
      { versions: formatted },
      "Comment versions retrieved",
    );
  } catch (err) {
    logger.error({ error: err.message }, "Get versions error");
    return sendError(
      res,
      ErrorCodes.INTERNAL,
      "Failed to retrieve versions",
      null,
      500,
    );
  }
};

// =====================================================
// GET REPLIES (for a specific version – same as before)
// =====================================================
exports.getReplies = async (req, res) => {
  try {
    const { commentId } = req.params;
    const { page = 1, limit = 20, sort = "new" } = req.query;

    const parent = await Comment.findById(commentId);
    if (!parent)
      return sendError(
        res,
        ErrorCodes.NOT_FOUND,
        "Parent comment not found",
        null,
        404,
      );

    const filter = {
      parentCommentId: commentId,
      ...buildVisibilityFilter(req.user),
    };
    const replies = await Comment.find(filter)
      .populate("userId", "displayName")
      .sort(buildSortOption(sort))
      .skip((page - 1) * limit)
      .limit(Number(limit))
      .lean();

    const total = await Comment.countDocuments(filter);
    const formatted = replies.map((r) => ({
      id: r._id,
      text: r.text,
      user: r.userId
        ? {
            id: r.userId._id,
            displayName: r.userId.displayName,
          }
        : null,
      parentCommentId: r.parentCommentId,
      visibility: r.visibility,
      reportState: r.reportState,
      reportCount: r.reportCount,
      sentiment: r.sentiment,
      keywords: r.keywords,
      replyCount: r.replyCount,
      isOfficialReply: r.isOfficialReply,
      aiStatus: r.aiStatus,
      editedAt: r.editedAt,
      editCount: r.editCount,
      createdAt: r.createdAt,
      updatedAt: r.updatedAt,
    }));

    return sendSuccess(
      res,
      {
        replies: formatted,
        pagination: {
          total,
          page: Number(page),
          limit: Number(limit),
          pages: Math.ceil(total / limit),
        },
      },
      "Replies retrieved",
    );
  } catch (err) {
    logger.error({ error: err.message }, "Get replies error");
    return sendError(
      res,
      ErrorCodes.INTERNAL,
      "Failed to retrieve replies",
      null,
      500,
    );
  }
};

// =====================================================
// REPORT COMMENT (on a specific version)
// =====================================================
exports.reportComment = async (req, res) => {
  try {
    const { commentId } = req.params;
    const { reason, description = "" } = req.body;
    if (!reason) {
      return sendError(
        res,
        ErrorCodes.VALIDATION,
        "Report reason is required",
        null,
        400,
      );
    }

    const comment = await Comment.findById(commentId).populate("policyId");
    if (!comment) {
      return sendError(
        res,
        ErrorCodes.NOT_FOUND,
        "Comment not found",
        null,
        404,
      );
    }
    if (comment.visibility === "deleted") {
      return sendError(
        res,
        ErrorCodes.VALIDATION,
        "Comment is no longer reportable",
        null,
        400,
      );
    }

    // Check duplicate report
    const alreadyReported = comment.reports.some(
      (r) => r.reporterId.toString() === req.user.id.toString(),
    );
    if (alreadyReported) {
      return sendError(
        res,
        ErrorCodes.VALIDATION,
        "You already reported this comment",
        null,
        400,
      );
    }

    const snapshot = {
      text: comment.text,
      sentiment: comment.sentiment,
      keywords: comment.keywords,
      visibility: comment.visibility,
      aiStatus: comment.aiStatus,
      reportCount: comment.reportCount + 1,
    };

    comment.reports.push({
      reporterId: req.user.id,
      reason,
      details: description || null,
      status: "pending",
      snapshot,
      createdAt: new Date(),
    });
    comment.reportCount += 1;
    if (comment.reportState === "clean") comment.reportState = "reported";

    if (comment.reportCount >= REPORT_AUTO_HIDE_THRESHOLD) {
      comment.visibility = "hidden";
      comment.reportState = "under_review";
      comment.moderationActions.push({
        action: "hide",
        reason: "auto_hide_reports",
        actor: null,
        createdAt: new Date(),
      });
      comment.moderatedBy = null;
      comment.moderatedAt = new Date();
      comment.moderationReason = "auto_hide_reports";

      if (comment.userId && comment.policyId) {
        await createNotification({
          userId: comment.userId,
          type: "COMMENT_HIDDEN",
          title: "Your comment has been hidden",
          message: `Your comment on policy "${comment.policyId.title}" was hidden due to multiple reports. You can appeal this decision.`,
          data: { commentId: comment._id, policyId: comment.policyId._id },
          severity: "warning",
          source: "system",
        });
      }
    }

    comment.events.push(
      createEvent({
        type: "reported",
        actor: req.user.id,
        data: { reason, description, reportCount: comment.reportCount },
      }),
    );
    await comment.save();

    logger.info(`Comment reported: ${comment._id}`);
    return sendSuccess(
      res,
      {
        reportCount: comment.reportCount,
        reportState: comment.reportState,
        visibility: comment.visibility,
      },
      "Comment reported successfully",
    );
  } catch (err) {
    logger.error({ error: err.message }, "Report comment error");
    return sendError(
      res,
      ErrorCodes.INTERNAL,
      "Failed to report comment",
      null,
      500,
    );
  }
};

// =====================================================
// GET MY REPORTS (citizen) – unchanged
// =====================================================
exports.getMyReports = async (req, res) => {
  try {
    const { page = 1, limit = 20 } = req.query;
    const comments = await Comment.find({ "reports.reporterId": req.user.id })
      .populate("userId", "email")
      .lean();

    const extracted = [];
    for (const comment of comments) {
      const myReports = comment.reports.filter(
        (r) => r.reporterId.toString() === req.user.id.toString(),
      );
      for (const report of myReports) {
        extracted.push({
          commentId: comment._id,
          commentText: comment.text,
          commentVisibility: comment.visibility,
          reportId: report._id,
          reason: report.reason,
          description: report.details,
          status: report.status,
          moderatorNote: report.moderatorNotes || null,
          createdAt: report.createdAt,
        });
      }
    }
    const sorted = extracted.sort(
      (a, b) => new Date(b.createdAt) - new Date(a.createdAt),
    );
    const paginated = sorted.slice((page - 1) * limit, page * limit);

    return sendSuccess(
      res,
      {
        reports: paginated,
        pagination: {
          total: sorted.length,
          page: Number(page),
          limit: Number(limit),
          pages: Math.ceil(sorted.length / limit),
        },
      },
      "Reports retrieved",
    );
  } catch (err) {
    logger.error({ error: err.message }, "Get my reports error");
    return sendError(
      res,
      ErrorCodes.INTERNAL,
      "Failed to retrieve reports",
      null,
      500,
    );
  }
};

// =====================================================
// GET COMMENT REPORTS (MODERATOR) – unchanged
// =====================================================
exports.getCommentReports = async (req, res) => {
  try {
    const { commentId } = req.params;
    const comment = await Comment.findById(commentId)
      .populate("reports.reporterId", "email firstName lastName")
      .lean();
    if (!comment)
      return sendError(
        res,
        ErrorCodes.NOT_FOUND,
        "Comment not found",
        null,
        404,
      );
    if (!COMMENT_MODERATOR_ROLES.includes(req.user.role))
      return sendError(res, ErrorCodes.FORBIDDEN, "Unauthorized", null, 403);

    const reports = comment.reports.map((report) => ({
      id: report._id,
      reason: report.reason,
      description: report.details,
      status: report.status,
      moderatorNote: report.moderatorNotes,
      reportedBy: report.reporterId
        ? {
            id: report.reporterId._id,
            email: report.reporterId.email,
            firstName: report.reporterId.firstName,
            lastName: report.reporterId.lastName,
          }
        : null,
      snapshot: report.snapshot,
      createdAt: report.createdAt,
      resolvedAt: report.resolvedAt || null,
    }));

    return sendSuccess(
      res,
      {
        commentId: comment._id,
        reportState: comment.reportState,
        reportCount: comment.reportCount,
        reports,
      },
      "Comment reports retrieved",
    );
  } catch (err) {
    logger.error({ error: err.message }, "Get comment reports error");
    return sendError(
      res,
      ErrorCodes.INTERNAL,
      "Failed to retrieve reports",
      null,
      500,
    );
  }
};

// =====================================================
// MODERATE COMMENT (on a specific version)
// =====================================================
exports.moderateComment = async (req, res) => {
  try {
    const { commentId } = req.params;
    let { action, reason, sentimentOverride, sentiment, keywords } = req.body;
    if (action === "delete" || action === "reject") action = "remove";
    if (!sentimentOverride && sentiment) sentimentOverride = sentiment;
    const allowedActions = ["approve", "hide", "remove", "restore", "reject"];
    if (!allowedActions.includes(action)) {
      return sendError(
        res,
        ErrorCodes.VALIDATION,
        "Invalid moderation action",
        null,
        400,
      );
    }

    const comment = await Comment.findById(commentId).populate("policyId");
    if (!comment) {
      return sendError(
        res,
        ErrorCodes.NOT_FOUND,
        "Comment not found",
        null,
        404,
      );
    }

    const isAssociate = !!req.associate;
    let auditDetails = {
      action,
      reason,
      hadSentimentOverride: !!sentimentOverride,
    };
    if (isAssociate) auditDetails.associateId = req.associate._id;

    switch (action) {
      case "approve":
        if (comment.visibility !== "visible") {
          comment.visibility = "visible";
          comment.moderationActions.push({
            action: "restore",
            reason: reason || "approved_by_moderator",
            actor: req.user.id,
            createdAt: new Date(),
          });
        }
        comment.reportState = "actioned";
        if (comment.reviewFlags)
          comment.reviewFlags.sentimentReviewNeeded = false;
        if (comment.appeal?.status === "pending") {
          comment.appeal.status = "approved";
          comment.appeal.resolvedAt = new Date();
          comment.appeal.resolvedBy = req.user.id;
        }
        break;
      case "hide":
        if (comment.visibility !== "hidden") {
          comment.visibility = "hidden";
          comment.moderationActions.push({
            action: "hide",
            reason: reason || "hidden_by_moderator",
            actor: req.user.id,
            createdAt: new Date(),
          });
          comment.moderatedBy = req.user.id;
          comment.moderatedAt = new Date();
          comment.moderationReason = reason || "hidden_by_moderator";
          if (comment.userId && comment.policyId) {
            await createNotification({
              userId: comment.userId,
              type: "COMMENT_HIDDEN",
              title: "Your comment has been hidden by a moderator",
              message: `Your comment on policy "${comment.policyId.title}" was hidden by a moderator. You can appeal this decision.`,
              data: { commentId: comment._id, policyId: comment.policyId._id },
              severity: "warning",
              source: "system",
            });
          }
        }
        break;
      case "remove":
        comment.visibility = "deleted";
        comment.moderationActions.push({
          action: "delete",
          reason: reason || "removed_by_moderator",
          actor: req.user.id,
          createdAt: new Date(),
        });
        comment.moderatedBy = req.user.id;
        comment.moderatedAt = new Date();
        comment.moderationReason = reason || "removed_by_moderator";
        if (comment.appeal?.status === "pending") {
          comment.appeal.status = "rejected";
          comment.appeal.resolvedAt = new Date();
          comment.appeal.resolvedBy = req.user.id;
        }
        break;
      case "restore":
        if (
          comment.visibility === "hidden" ||
          comment.visibility === "deleted"
        ) {
          comment.visibility = "visible";
          comment.moderationActions.push({
            action: "restore",
            reason: reason || "restored_by_moderator",
            actor: req.user.id,
            createdAt: new Date(),
          });
          comment.moderatedBy = null;
          comment.moderatedAt = null;
          comment.moderationReason = null;
          if (comment.reviewFlags)
            comment.reviewFlags.sentimentReviewNeeded = false;
        }
        break;
    }

    if (sentimentOverride) {
      comment.sentiment = {
        label: sentimentOverride.label,
        confidence: 1,
        overriddenByModerator: true,
      };
      comment.moderationActions.push({
        action: "override_sentiment",
        reason: "manual override",
        actor: req.user.id,
        createdAt: new Date(),
      });
      if (comment.reviewFlags)
        comment.reviewFlags.sentimentReviewNeeded = false;
      auditDetails.sentimentOverride = sentimentOverride;
    }

    if (Array.isArray(keywords)) {
      comment.keywords = keywords.map((keyword) => String(keyword).trim()).filter(Boolean);
      comment.moderationActions.push({
        action: "override_keywords",
        reason: "manual override",
        actor: req.user.id,
        createdAt: new Date(),
      });
      auditDetails.keywords = comment.keywords;
    }

    comment.events.push({
      type: "moderated",
      actor: req.user.id,
      data: { action, reason, sentimentOverride, keywords },
      createdAt: new Date(),
    });

    await comment.save();

    await createAuditLog({
      userId: req.user.id,
      userRole: req.user.role,
      action: "MODERATE_COMMENT",
      targetType: "Comment",
      targetId: comment._id,
      details: auditDetails,
      req,
    });

    return sendSuccess(res, comment, "Comment moderated successfully");
  } catch (err) {
    logger.error({ error: err.message }, "Moderate comment error");
    return sendError(
      res,
      ErrorCodes.INTERNAL,
      "Failed to moderate comment",
      null,
      500,
    );
  }
};
// =====================================================
// APPEAL COMMENT (on a specific version)
// =====================================================
exports.appealComment = async (req, res) => {
  try {
    const { commentId } = req.params;
    const { reason, description = "" } = req.body;
    if (!reason) {
      return sendError(
        res,
        ErrorCodes.VALIDATION,
        "Appeal reason is required",
        null,
        400,
      );
    }

    const comment = await Comment.findById(commentId).populate("policyId");
    if (!comment) {
      return sendError(
        res,
        ErrorCodes.NOT_FOUND,
        "Comment not found",
        null,
        404,
      );
    }
    if (comment.userId.toString() !== req.user.id.toString()) {
      return sendError(
        res,
        ErrorCodes.FORBIDDEN,
        "You can only appeal your own comments",
        null,
        403,
      );
    }
    if (comment.visibility !== "hidden") {
      return sendError(
        res,
        ErrorCodes.VALIDATION,
        "Only hidden comments can be appealed",
        null,
        400,
      );
    }
    if (comment.appeal?.status === "pending") {
      return sendError(
        res,
        ErrorCodes.VALIDATION,
        "An appeal is already pending",
        null,
        400,
      );
    }

    const snapshot = {
      text: comment.text,
      visibility: comment.visibility,
      reportState: comment.reportState,
      reportCount: comment.reportCount,
    };

    comment.appeal = {
      appellantId: req.user.id,
      reason,
      details: description || null,
      status: "pending",
      snapshot,
      createdAt: new Date(),
    };

    comment.events.push(
      createEvent({
        type: "appealed",
        actor: req.user.id,
        data: { reason, description },
      }),
    );
    await comment.save();

    const policy = await Policy.findById(comment.policyId);
    if (policy) {
      await createNotification({
        userId: policy.createdBy,
        type: "COMMENT_APPEAL",
        title: "Comment appeal submitted",
        message: `User appeals the moderation of comment #${commentId}: ${reason.slice(0, 100)}`,
        data: { commentId, policyId: comment.policyId },
        severity: "info",
        source: "system",
      });
    }

    return sendSuccess(res, comment.appeal, "Appeal submitted successfully");
  } catch (err) {
    console.error("Full error in appealComment:", err);
    logger.error({ error: err.message, stack: err.stack }, "Appeal error");
    return sendError(
      res,
      ErrorCodes.INTERNAL,
      "Failed to submit appeal",
      null,
      500,
    );
  }
};

// =====================================================
// GET COMMENT HISTORY (event log) – unchanged
// =====================================================
exports.getCommentHistory = async (req, res) => {
  try {
    const { id } = req.params;
    const comment = await Comment.findById(id).populate(
      "events.actor",
      "displayName role",
    );
    if (!comment)
      return sendError(
        res,
        ErrorCodes.NOT_FOUND,
        "Comment not found",
        null,
        404,
      );

    return sendSuccess(
      res,
      { commentId: comment._id, events: comment.events },
      "Comment history retrieved",
    );
  } catch (err) {
    logger.error({ error: err.message }, "Get history error");
    return sendError(
      res,
      ErrorCodes.INTERNAL,
      "Failed to retrieve comment history",
      null,
      500,
    );
  }
};

// =====================================================
// GET COMMENTS NEEDING REVIEW (for AI tab)
// =====================================================
exports.getCommentsNeedingReview = async (req, res) => {
  try {
    const { page = 1, limit = 20 } = req.query;

    if (!COMMENT_MODERATOR_ROLES.includes(req.user.role)) {
      return sendError(res, ErrorCodes.FORBIDDEN, "Access denied", null, 403);
    }

    const filter = {
      visibility: "visible",
      $and: [
        {
          $or: [
            { "reviewFlags.sentimentReviewNeeded": true },
            { aiStatus: "pending", lastAnalyzedAt: { $ne: null } },
          ],
        },
      ],
    };

    const comments = await Comment.find(filter)
      .populate("userId", "displayName")
      .populate("policyId", "title policyCode")
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(Number(limit))
      .lean();

    const total = await Comment.countDocuments(filter);

    // Transform to remove user object and just keep displayName
    const transformedComments = comments.map((c) => ({
      ...c,
      userDisplayName: c.userId?.displayName || "Anonymous",
      userId: undefined, // remove the full user object
    }));

    return sendSuccess(
      res,
      {
        comments: transformedComments,
        pagination: {
          total,
          page: Number(page),
          limit: Number(limit),
          pages: Math.ceil(total / limit),
        },
      },
      "Comments needing review retrieved",
    );
  } catch (err) {
    logger.error({ error: err.message }, "Get comments needing review error");
    return sendError(
      res,
      ErrorCodes.INTERNAL,
      "Failed to retrieve comments",
      null,
      500,
    );
  }
};
