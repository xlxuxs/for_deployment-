const User = require("../models/User");
const Comment = require("..//models/Comment");
const PlannerRequest = require("../models/PlannerRequest");
const Policy = require("../models/Policy");
const PolicyAssociate = require("../models/PolicyAssociate");
const Vote = require("../models/Vote");
const SmsSubscription = require("../models/SmsSubscription");
const SmsActivity = require("../models/SmsActivity");
const crypto = require("crypto");
const mongoose = require("mongoose");
const { hashPassword } = require("../utils/helpers");
const logger = require("../utils/logger");
const { createAuditLog } = require("../utils/audit");
const { createNotification } = require("../services/notificationService");
const client = require("../config/redis");
const {
  sendAdminInitiatedResetEmail,
  sendPlannerPasswordSetupEmail,
  sendRolePasswordSetupEmail,
} = require("../utils/email");
const {
  sendSuccess,
  sendError,
  ErrorCodes,
} = require("../utils/responseHelper");
const { normalizePhone, hashPhone } = require("../utils/helpers");
const { simulateInboundSms } = require("../services/mockSmsService");
// ========== PLANNER MANAGEMENT ==========

// GET /admin/planners
exports.listPlanners = async (req, res) => {
  try {
    const { active, page = 1, limit = 10 } = req.query;

    const query = { role: "planner" };
    if (active !== undefined) query.active = active === "true";

    const skip = (parseInt(page) - 1) * parseInt(limit);
    const [planners, total] = await Promise.all([
      User.find(query)
        .select("-passwordHash -phoneHash")
        .skip(skip)
        .limit(parseInt(limit))
        .sort({ createdAt: -1 }),
      User.countDocuments(query),
    ]);

    logger.info(
      `Admin ${req.user.id} listed planners (page ${page}, total ${total})`,
    );
    return sendSuccess(
      res,
      {
        total,
        page: parseInt(page),
        pages: Math.ceil(total / limit),
        planners,
      },
      "Planners retrieved successfully",
    );
  } catch (err) {
    logger.error(
      { error: err.message, stack: err.stack },
      "List planners error",
    );
    return sendError(
      res,
      ErrorCodes.INTERNAL,
      "Failed to retrieve planners. Please try again later.",
      null,
      500,
    );
  }
};

// GET /admin/planners/:id
exports.getPlannerById = async (req, res) => {
  try {
    const { id } = req.params;
    const planner = await User.findOne({ _id: id, role: "planner" }).select(
      "-passwordHash -phoneHash",
    );
    if (!planner) {
      return sendError(
        res,
        ErrorCodes.NOT_FOUND,
        "Planner not found",
        null,
        404,
      );
    }

    // Fetch owned policies (policies created by this planner)
    const ownedPolicies = await Policy.find({ createdBy: id })
      .select(
        "title policyCode status targetRegions pollType createdAt endDate",
      )
      .sort({ createdAt: -1 })
      .lean();

    // Fetch delegated policies (where this planner is an accepted associate)
    const delegatedAssociations = await PolicyAssociate.find({
      plannerId: id,
      invitationStatus: "accepted",
      revokedAt: null,
    })
      .populate(
        "policyId",
        "title policyCode status targetRegions pollType createdAt endDate",
      )
      .populate("assignedBy", "email firstName lastName")
      .sort({ acceptedAt: -1 })
      .lean();

    const delegatedPolicies = delegatedAssociations.map((assoc) => ({
      policy: assoc.policyId,
      permissions: assoc.permissions,
      invitedBy: assoc.assignedBy,
      acceptedAt: assoc.acceptedAt,
      associateId: assoc._id,
    }));

    // Build enriched response
    const response = {
      ...planner.toObject(),
      ownedPolicies,
      delegatedPolicies,
      stats: {
        ownedCount: ownedPolicies.length,
        delegatedCount: delegatedPolicies.length,
      },
    };

    return sendSuccess(res, response, "Planner retrieved with policies");
  } catch (err) {
    logger.error({ error: err.message }, "Get planner by ID error");
    return sendError(
      res,
      ErrorCodes.INTERNAL,
      "Failed to retrieve planner",
      null,
      500,
    );
  }
};
// POST /admin/planners
exports.createPlanner = async (req, res) => {
  try {
    const {
      email,
      region,
      ageRange,
      gender,
      occupation,
      education,
      preferredLanguage,
      languagesSpoken,
    } = req.body;

    if (!email || !region || !ageRange || !gender || !occupation || !education) {
      return sendError(
        res,
        ErrorCodes.VALIDATION,
        "Email, region, age range, gender, occupation, and education level are required",
        {
          required: [
            "email",
            "region",
            "ageRange",
            "gender",
            "occupation",
            "education",
          ],
        },
        400,
      );
    }

    const existing = await User.findOne({ email });
    if (existing) {
      logger.warn(
        `Admin ${req.user.id} attempted to create planner with existing email: ${email}`,
      );
      return sendError(
        res,
        ErrorCodes.DUPLICATE,
        "A user with this email already exists",
        null,
        409,
      );
    }

    const temporaryPassword = crypto.randomBytes(32).toString("hex");
    const passwordHash = await hashPassword(temporaryPassword);
    const uniquePhonePlaceholder = `planner_no_phone_${Date.now()}_${Math.random().toString(36).substring(2)}`;
    const planner = new User({
      email,
      passwordHash,
      role: "planner",
      phoneHash: uniquePhonePlaceholder,
      region,
      ageRange,
      gender,
      occupation,
      education,
      preferredLanguage: preferredLanguage || "en",
      languagesSpoken: languagesSpoken || ["en"],
      verified: true,
      active: true,
      trainingCompletedAt: new Date(),
    });
    await planner.save();

    const setupToken = crypto.randomBytes(32).toString("hex");
    const setupTokenKey = `reset:token:${setupToken}`;
    await client.setEx(setupTokenKey, 86400, planner._id.toString());
    await sendPlannerPasswordSetupEmail(planner.email, setupToken);

    await createAuditLog({
      userId: req.user.id,
      userRole: req.user.role,
      action: "CREATE_PLANNER",
      targetType: "User",
      targetId: planner._id,
      details: { email: planner.email },
      req,
    });

    logger.info(
      `Admin ${req.user.id} created planner: ${email} (${planner._id})`,
    );
    return sendSuccess(
      res,
      { id: planner._id, email: planner.email },
      "Planner account created successfully. A password setup link was sent to the planner.",
      201,
    );
  } catch (err) {
    logger.error(
      {
        error: err.message,
        stack: err.stack,
        name: err.name,
        code: err.code,
      },
      "Create planner error",
    );
    return sendError(
      res,
      ErrorCodes.INTERNAL,
      "Failed to create planner. Please try again.",
      null,
      500,
    );
  }
};

// PUT /admin/planners/:id
exports.updatePlanner = async (req, res) => {
  try {
    const { id } = req.params;
    const { password, active } = req.body;

    const planner = await User.findOne({ _id: id, role: "planner" });
    if (!planner) {
      return sendError(
        res,
        ErrorCodes.NOT_FOUND,
        "Planner not found",
        null,
        404,
      );
    }

    const changes = {};
    const updates = {};
    if (password) {
      updates.passwordHash = await hashPassword(password);
      changes.password = "updated";
    }
    if (active !== undefined) {
      updates.active = active;
      changes.active = active;
    }
    if (Object.keys(updates).length) {
      await User.updateOne(
        { _id: planner._id },
        { $set: updates },
        { runValidators: false },
      );
    }

    await createAuditLog({
      userId: req.user.id,
      userRole: req.user.role,
      action: "UPDATE_PLANNER",
      targetType: "User",
      targetId: planner._id,
      details: { email: planner.email, changes },
      req,
    });

    logger.info(
      `Admin ${req.user.id} updated planner: ${planner.email} (${planner._id})`,
    );
    return sendSuccess(
      res,
      {
        id: planner._id,
        email: planner.email,
        active: active ?? planner.active,
      },
      "Planner updated successfully",
    );
  } catch (err) {
    logger.error(
      { error: err.message, stack: err.stack },
      "Update planner error",
    );
    return sendError(
      res,
      ErrorCodes.INTERNAL,
      "Failed to update planner. Please try again.",
      null,
      500,
    );
  }
};

// PUT /admin/planners/:id/status
exports.updatePlannerStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const { active } = req.body;
    if (active === undefined) {
      return sendError(
        res,
        ErrorCodes.VALIDATION,
        "active field is required (true/false)",
        null,
        400,
      );
    }

    const planner = await User.findOne({ _id: id, role: "planner" });
    if (!planner) {
      return sendError(
        res,
        ErrorCodes.NOT_FOUND,
        "Planner not found",
        null,
        404,
      );
    }

    await User.updateOne(
      { _id: planner._id },
      { $set: { active } },
      { runValidators: false },
    );

    await createAuditLog({
      userId: req.user.id,
      userRole: req.user.role,
      action: "UPDATE_PLANNER_STATUS",
      targetType: "User",
      targetId: planner._id,
      details: { email: planner.email, active },
      req,
    });

    const statusText = active ? "activated" : "deactivated";
    logger.info(
      `Admin ${req.user.id} ${statusText} planner: ${planner.email} (${planner._id})`,
    );
    return sendSuccess(
      res,
      { plannerId: planner._id, active },
      `Planner account ${statusText} successfully`,
    );
  } catch (err) {
    logger.error(
      { error: err.message, stack: err.stack },
      "Update planner status error",
    );
    return sendError(
      res,
      ErrorCodes.INTERNAL,
      "Failed to update planner status",
      null,
      500,
    );
  }
};

// ========== COMMENT MODERATOR MANAGEMENT ==========

// GET /admin/comment-moderators
exports.listCommentModerators = async (req, res) => {
  try {
    const { active, page = 1, limit = 10 } = req.query;

    const query = { role: "comment_moderator" };
    if (active !== undefined) query.active = active === "true";

    const skip = (parseInt(page) - 1) * parseInt(limit);
    const [moderators, total] = await Promise.all([
      User.find(query)
        .select("-passwordHash -phoneHash")
        .skip(skip)
        .limit(parseInt(limit))
        .sort({ createdAt: -1 }),
      User.countDocuments(query),
    ]);

    logger.info(
      `Admin ${req.user.id} listed comment moderators (page ${page}, total ${total})`,
    );
    return sendSuccess(
      res,
      {
        total,
        page: parseInt(page),
        pages: Math.ceil(total / limit),
        moderators,
      },
      "Comment moderators retrieved successfully",
    );
  } catch (err) {
    logger.error(
      { error: err.message, stack: err.stack },
      "List comment moderators error",
    );
    return sendError(
      res,
      ErrorCodes.INTERNAL,
      "Failed to retrieve comment moderators. Please try again later.",
      null,
      500,
    );
  }
};

// POST /admin/comment-moderators
exports.createCommentModerator = async (req, res) => {
  try {
    const {
      email,
      region,
      ageRange,
      gender,
      occupation,
      education,
      preferredLanguage,
      languagesSpoken,
    } = req.body;

    if (
      !email ||
      !region ||
      !ageRange ||
      !gender ||
      !occupation ||
      !education ||
      !preferredLanguage
    ) {
      return sendError(
        res,
        ErrorCodes.VALIDATION,
        "Email, region, age range, gender, occupation, education, and preferred language are required",
        {
          required: [
            "email",
            "region",
            "ageRange",
            "gender",
            "occupation",
            "education",
            "preferredLanguage",
          ],
        },
        400,
      );
    }

    const existing = await User.findOne({ email });
    if (existing) {
      logger.warn(
        `Admin ${req.user.id} attempted to create comment moderator with existing email: ${email}`,
      );
      return sendError(
        res,
        ErrorCodes.DUPLICATE,
        "A user with this email already exists",
        null,
        409,
      );
    }

    const temporaryPassword = crypto.randomBytes(32).toString("hex");
    const passwordHash = await hashPassword(temporaryPassword);
    const uniquePhonePlaceholder = `comment_moderator_no_phone_${Date.now()}_${Math.random().toString(36).substring(2)}`;
    const moderator = new User({
      email,
      passwordHash,
      role: "comment_moderator",
      phoneHash: uniquePhonePlaceholder,
      region,
      ageRange,
      gender,
      occupation,
      education,
      preferredLanguage,
      languagesSpoken: Array.isArray(languagesSpoken)
        ? languagesSpoken
        : String(languagesSpoken || preferredLanguage)
            .split(",")
            .map((item) => item.trim())
            .filter(Boolean),
      verified: true,
      active: true,
      trainingCompletedAt: null,
    });
    await moderator.save();

    const setupToken = crypto.randomBytes(32).toString("hex");
    const setupTokenKey = `reset:token:${setupToken}`;
    await client.setEx(setupTokenKey, 86400, moderator._id.toString());
    await sendRolePasswordSetupEmail(
      moderator.email,
      setupToken,
      "Comment Moderator",
    );

    await createAuditLog({
      userId: req.user.id,
      userRole: req.user.role,
      action: "CREATE_COMMENT_MODERATOR",
      targetType: "User",
      targetId: moderator._id,
      details: { email: moderator.email },
      req,
    });

    logger.info(
      `Admin ${req.user.id} created comment moderator: ${email} (${moderator._id})`,
    );
    return sendSuccess(
      res,
      { id: moderator._id, email: moderator.email },
      "Comment moderator account created successfully. A password setup link was sent to the user.",
      201,
    );
  } catch (err) {
    logger.error(
      {
        error: err.message,
        stack: err.stack,
        name: err.name,
        code: err.code,
      },
      "Create comment moderator error",
    );
    return sendError(
      res,
      ErrorCodes.INTERNAL,
      "Failed to create comment moderator. Please try again.",
      null,
      500,
    );
  }
};

// PUT /admin/comment-moderators/:id
exports.updateCommentModerator = async (req, res) => {
  try {
    const { id } = req.params;
    const { password, active } = req.body;

    const moderator = await User.findOne({ _id: id, role: "comment_moderator" });
    if (!moderator) {
      return sendError(
        res,
        ErrorCodes.NOT_FOUND,
        "Comment moderator not found",
        null,
        404,
      );
    }

    const changes = {};
    const updates = {};
    if (password) {
      updates.passwordHash = await hashPassword(password);
      changes.password = "updated";
    }
    if (active !== undefined) {
      updates.active = active;
      changes.active = active;
    }
    if (Object.keys(updates).length) {
      await User.updateOne(
        { _id: moderator._id },
        { $set: updates },
        { runValidators: false },
      );
    }

    await createAuditLog({
      userId: req.user.id,
      userRole: req.user.role,
      action: "UPDATE_COMMENT_MODERATOR",
      targetType: "User",
      targetId: moderator._id,
      details: { email: moderator.email, changes },
      req,
    });

    logger.info(
      `Admin ${req.user.id} updated comment moderator: ${moderator.email} (${moderator._id})`,
    );
    return sendSuccess(
      res,
      {
        id: moderator._id,
        email: moderator.email,
        active: active ?? moderator.active,
      },
      "Comment moderator updated successfully",
    );
  } catch (err) {
    logger.error(
      { error: err.message, stack: err.stack },
      "Update comment moderator error",
    );
    return sendError(
      res,
      ErrorCodes.INTERNAL,
      "Failed to update comment moderator. Please try again.",
      null,
      500,
    );
  }
};

// PUT /admin/comment-moderators/:id/status
exports.updateCommentModeratorStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const { active } = req.body;
    if (active === undefined) {
      return sendError(
        res,
        ErrorCodes.VALIDATION,
        "active field is required (true/false)",
        null,
        400,
      );
    }

    const moderator = await User.findOne({ _id: id, role: "comment_moderator" });
    if (!moderator) {
      return sendError(
        res,
        ErrorCodes.NOT_FOUND,
        "Comment moderator not found",
        null,
        404,
      );
    }

    await User.updateOne(
      { _id: moderator._id },
      { $set: { active } },
      { runValidators: false },
    );

    await createAuditLog({
      userId: req.user.id,
      userRole: req.user.role,
      action: "UPDATE_COMMENT_MODERATOR_STATUS",
      targetType: "User",
      targetId: moderator._id,
      details: { email: moderator.email, active },
      req,
    });

    const statusText = active ? "activated" : "deactivated";
    logger.info(
      `Admin ${req.user.id} ${statusText} comment moderator: ${moderator.email} (${moderator._id})`,
    );
    return sendSuccess(
      res,
      { moderatorId: moderator._id, active },
      `Comment moderator account ${statusText} successfully`,
    );
  } catch (err) {
    logger.error(
      { error: err.message, stack: err.stack },
      "Update comment moderator status error",
    );
    return sendError(
      res,
      ErrorCodes.INTERNAL,
      "Failed to update comment moderator status",
      null,
      500,
    );
  }
};

// ========== COMMENT MANAGEMENT ==========

// GET /admin/comments/pending – AI low confidence comments (visible)
exports.getPendingComments = async (req, res) => {
  try {
    const { policyId } = req.query;
    const user = req.user;
    const isAdmin = user.role === "admin";
    const isCommentModerator = user.role === "comment_moderator";

    let filter = {
      visibility: "visible",
      $or: [
        { "reviewFlags.sentimentReviewNeeded": true },
        { aiStatus: "pending", lastAnalyzedAt: { $ne: null } },
      ],
    };

    // If a specific policyId is provided, check permissions
    if (policyId && mongoose.Types.ObjectId.isValid(policyId)) {
      const policy = await Policy.findById(policyId).select("createdBy");
      if (!policy) {
        return sendError(
          res,
          ErrorCodes.NOT_FOUND,
          "Policy not found",
          null,
          404,
        );
      }

      const isOwner = policy.createdBy.toString() === user.id.toString();
      const isAssociate = await PolicyAssociate.findOne({
        policyId,
        plannerId: user.id,
        invitationStatus: "accepted",
        permissions: { $in: ["moderate_comments"] },
      });

      if (!isAdmin && !isCommentModerator && !isOwner && !isAssociate) {
        return sendError(
          res,
          ErrorCodes.FORBIDDEN,
          "You do not have permission to view pending comments for this policy",
          null,
          403,
        );
      }
      filter.policyId = new mongoose.Types.ObjectId(policyId);
    } else if (!isAdmin && !isCommentModerator) {
      // No policyId, planner: only show comments from policies they own or are associated with
      const ownedPolicies = await Policy.find({ createdBy: user.id }).distinct(
        "_id",
      );
      const associatedPolicies = await PolicyAssociate.find({
        plannerId: user.id,
        invitationStatus: "accepted",
      }).distinct("policyId");
      const allowedPolicyIds = [...ownedPolicies, ...associatedPolicies];
      if (allowedPolicyIds.length === 0) {
        // No accessible policies, return empty result
        return sendSuccess(res, { comments: [] }, "No accessible policies");
      }
      filter.policyId = { $in: allowedPolicyIds };
    }

    const comments = await Comment.find(filter)
      .populate("policyId", "title")
      .populate("userId", "email firstName lastName")
      .sort({ createdAt: -1 });

    logger.info(
      `User ${user.id} retrieved ${comments.length} pending comments`,
    );
    return sendSuccess(res, { comments }, "Pending comments retrieved");
  } catch (err) {
    logger.error(
      { error: err.message, stack: err.stack },
      "Get pending comments error",
    );
    return sendError(
      res,
      ErrorCodes.INTERNAL,
      "Failed to retrieve pending comments",
      null,
      500,
    );
  }
};
// GET /admin/comments/flagged – reported comments (hidden)
exports.getFlaggedComments = async (req, res) => {
  try {
    const { policyId } = req.query;
    const user = req.user;
    const isAdmin = user.role === "admin";
    const isCommentModerator = user.role === "comment_moderator";

    let filter = {
      reportState: { $in: ["reported", "under_review"] },
      visibility: "hidden",
    };

    if (policyId && mongoose.Types.ObjectId.isValid(policyId)) {
      const policy = await Policy.findById(policyId).select("createdBy");
      if (!policy) {
        return sendError(
          res,
          ErrorCodes.NOT_FOUND,
          "Policy not found",
          null,
          404,
        );
      }

      const isOwner = policy.createdBy.toString() === user.id.toString();
      const isAssociate = await PolicyAssociate.findOne({
        policyId,
        plannerId: user.id,
        invitationStatus: "accepted",
        permissions: { $in: ["moderate_comments"] },
      });

      if (!isAdmin && !isCommentModerator && !isOwner && !isAssociate) {
        return sendError(
          res,
          ErrorCodes.FORBIDDEN,
          "You do not have permission to view flagged comments for this policy",
          null,
          403,
        );
      }
      filter.policyId = new mongoose.Types.ObjectId(policyId);
    } else if (!isAdmin && !isCommentModerator) {
      const ownedPolicies = await Policy.find({ createdBy: user.id }).distinct(
        "_id",
      );
      const associatedPolicies = await PolicyAssociate.find({
        plannerId: user.id,
        invitationStatus: "accepted",
        permissions: { $in: ["moderate_comments"] },
      }).distinct("policyId");
      const allowedPolicyIds = [...ownedPolicies, ...associatedPolicies];
      if (allowedPolicyIds.length === 0) {
        return sendSuccess(res, { comments: [] }, "No accessible policies");
      }
      filter.policyId = { $in: allowedPolicyIds };
    }

    const comments = await Comment.find(filter)
      .populate("policyId", "title")
      .populate("userId", "email firstName lastName")
      .sort({ createdAt: -1 });

    logger.info(
      `User ${user.id} retrieved ${comments.length} flagged comments`,
    );
    return sendSuccess(res, { comments }, "Flagged comments retrieved");
  } catch (err) {
    logger.error(
      { error: err.message, stack: err.stack },
      "Get flagged comments error",
    );
    return sendError(
      res,
      ErrorCodes.INTERNAL,
      "Failed to retrieve flagged comments",
      null,
      500,
    );
  }
};
// PUT /admin/comments/:id – manual override (sentiment & keywords only)
exports.updateComment = async (req, res) => {
  try {
    const { id } = req.params;
    const { sentiment, keywords } = req.body;
    const updateData = {};
    if (sentiment !== undefined) {
      updateData.sentiment = {
        label: sentiment.label,
        confidence: 1,
        overriddenByModerator: true,
      };
    }
    if (keywords !== undefined) updateData.keywords = keywords;
    if (Object.keys(updateData).length === 0) {
      return sendError(
        res,
        ErrorCodes.VALIDATION,
        "No valid fields provided (sentiment or keywords)",
        null,
        400,
      );
    }

    const comment = await Comment.findByIdAndUpdate(id, updateData, {
      new: true,
      runValidators: true,
    });
    if (!comment)
      return sendError(
        res,
        ErrorCodes.NOT_FOUND,
        "Comment not found",
        null,
        404,
      );

    comment.events.push({
      type: "moderated",
      actor: req.user.id,
      data: { action: "override_sentiment_keywords", updates: updateData },
      createdAt: new Date(),
    });
    await comment.save();

    await createAuditLog({
      userId: req.user.id,
      userRole: req.user.role,
      action: "UPDATE_COMMENT",
      targetType: "Comment",
      targetId: comment._id,
      details: { policyId: comment.policyId, updates: updateData },
      req,
    });

    logger.info(`Admin ${req.user.id} updated comment ${id}`);
    return sendSuccess(res, comment, "Comment updated successfully");
  } catch (err) {
    logger.error(
      { error: err.message, stack: err.stack },
      "Update comment error",
    );
    return sendError(
      res,
      ErrorCodes.INTERNAL,
      "Failed to update comment",
      null,
      500,
    );
  }
};

// Retry AI analysis for a comment (force re‑analysis)
exports.retryComment = async (req, res) => {
  try {
    const { id } = req.params;
    const comment = await Comment.findById(id);
    if (!comment) {
      return sendError(
        res,
        ErrorCodes.NOT_FOUND,
        "Comment not found",
        null,
        404,
      );
    }

    // Reset AI status to pending and clear previous analysis
    comment.aiStatus = "pending";
    comment.sentiment = {
      label: null,
      confidence: null,
      overriddenByModerator: false,
    };
    comment.keywords = [];
    comment.aiAnalysis = { raw: null, version: null, analyzedAt: null };
    comment.lastAnalyzedAt = null;
    comment.reviewFlags.sentimentReviewNeeded = false;
    comment.retryCount = 0;
    comment.nextRetry = new Date(); // trigger immediately

    // Push an event
    comment.events.push({
      type: "ai_failed", // or "ai_retry" – we can add new type, but existing is fine
      actor: req.user.id,
      data: { reason: "manual_retry" },
      createdAt: new Date(),
    });

    await comment.save();

    logger.info(
      `Comment ${id} manually reset for AI retry by user ${req.user.id}`,
    );
    return sendSuccess(
      res,
      { commentId: comment._id },
      "Comment queued for AI retry",
    );
  } catch (err) {
    logger.error(`Retry comment error: ${err.message}`);
    return sendError(
      res,
      ErrorCodes.INTERNAL,
      "Failed to retry comment",
      null,
      500,
    );
  }
};

// Force retry – any comment, no checks
exports.forceRetryComment = async (req, res) => {
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

    comment.aiStatus = "pending";
    comment.sentiment = {
      label: null,
      confidence: null,
      overriddenByModerator: false,
    };
    comment.keywords = [];
    comment.retryCount = 0;
    comment.nextRetry = null;
    comment.reviewFlags.sentimentReviewNeeded = false;
    // Keep lastAnalyzedAt unchanged

    comment.events.push({
      type: "ai_analyzed",
      actor: req.user.id,
      data: { action: "force_retry" },
      createdAt: new Date(),
    });
    await comment.save();

    await createAuditLog({
      userId: req.user.id,
      userRole: req.user.role,
      action: "FORCE_RETRY_COMMENT",
      targetType: "Comment",
      targetId: comment._id,
      details: { policyId: comment.policyId },
      req,
    });

    logger.info(`Admin ${req.user.id} force‑retried comment ${id}`);
    return sendSuccess(
      res,
      { commentId: id },
      "Comment force‑queued for AI reprocessing.",
    );
  } catch (err) {
    logger.error({ error: err.message, stack: err.stack }, "Force retry error");
    return sendError(
      res,
      ErrorCodes.INTERNAL,
      "Failed to force‑retry comment",
      null,
      500,
    );
  }
};

// Bulk retry by IDs – strict criteria (only processed/failed, visible)
exports.bulkRetryCommentsByIds = async (req, res) => {
  try {
    const { commentIds } = req.body;
    const dryRun = req.query.dryRun === "true";

    if (!commentIds || !Array.isArray(commentIds) || commentIds.length === 0) {
      return sendError(
        res,
        ErrorCodes.VALIDATION,
        "commentIds array is required",
        null,
        400,
      );
    }

    const succeeded = [];
    const failed = [];

    for (const id of commentIds) {
      if (!mongoose.Types.ObjectId.isValid(id)) {
        failed.push({ id, reason: "Invalid ObjectId" });
        continue;
      }

      const comment = await Comment.findOne({
        _id: id,
        aiStatus: { $in: ["processed", "failed"] },
        visibility: "visible",
      });

      if (!comment) {
        failed.push({
          id,
          reason:
            "Comment not found or not eligible (must be processed/failed and visible)",
        });
        continue;
      }

      if (dryRun) {
        succeeded.push(id);
        continue;
      }

      comment.aiStatus = "pending";
      comment.sentiment = {
        label: null,
        confidence: null,
        overriddenByModerator: false,
      };
      comment.keywords = [];
      comment.retryCount = 0;
      comment.nextRetry = null;
      comment.reviewFlags.sentimentReviewNeeded = false;
      comment.events.push({
        type: "ai_analyzed",
        actor: req.user.id,
        data: { action: "bulk_retry" },
        createdAt: new Date(),
      });
      await comment.save();
      succeeded.push(id);
    }

    if (dryRun) {
      return sendSuccess(
        res,
        { totalMatched: succeeded.length, failed },
        `Dry run: ${succeeded.length} comments would be retried.`,
      );
    }

    await createAuditLog({
      userId: req.user.id,
      userRole: "admin",
      action: "BULK_RETRY_COMMENTS_BY_IDS",
      targetType: "Comment",
      details: {
        commentIds,
        succeededCount: succeeded.length,
        failedCount: failed.length,
      },
      req,
    });

    logger.info(
      `Admin ${req.user.id} bulk retried ${succeeded.length} comments by IDs`,
    );

    return sendSuccess(
      res,
      { succeeded, failed },
      `Bulk retry completed: ${succeeded.length} succeeded, ${failed.length} failed.`,
    );
  } catch (err) {
    console.error("=== BULK RETRY BY IDS ERROR ===", err);
    logger.error(
      { error: err.message, stack: err.stack },
      "Bulk retry by IDs error",
    );
    return sendError(
      res,
      ErrorCodes.INTERNAL,
      "Failed to process bulk retry",
      null,
      500,
    );
  }
};

// Soft delete a single comment (version)
exports.deleteComment = async (req, res) => {
  try {
    const { id } = req.params;
    const comment = await Comment.findById(id);
    if (!comment) {
      return sendError(
        res,
        ErrorCodes.NOT_FOUND,
        "Comment not found",
        null,
        404,
      );
    }

    comment.visibility = "deleted";
    comment.events.push({
      type: "deleted",
      actor: req.user.id,
      data: { note: "admin_deleted" },
      createdAt: new Date(),
    });
    await comment.save();

    await createAuditLog({
      userId: req.user.id,
      userRole: req.user.role,
      action: "DELETE_COMMENT",
      targetType: "Comment",
      targetId: comment._id,
      details: { policyId: comment.policyId },
      req,
    });

    logger.info(`Admin ${req.user.id} deleted comment ${id}`);
    return sendSuccess(res, null, "Comment deleted successfully");
  } catch (err) {
    logger.error(
      { error: err.message, stack: err.stack },
      "Delete comment error",
    );
    return sendError(
      res,
      ErrorCodes.INTERNAL,
      "Failed to delete comment",
      null,
      500,
    );
  }
};

// ========== CITIZEN MANAGEMENT ==========

// GET /admin/users/citizens
exports.listCitizens = async (req, res) => {
  try {
    const { active, page = 1, limit = 10 } = req.query;
    const query = { role: "citizen" };
    if (active !== undefined) query.active = active === "true";

    const skip = (parseInt(page) - 1) * parseInt(limit);
    const [citizens, total] = await Promise.all([
      User.find(query)
        .select("-passwordHash -phoneHash")
        .skip(skip)
        .limit(parseInt(limit))
        .sort({ createdAt: -1 }),
      User.countDocuments(query),
    ]);
    logger.info(
      `Admin ${req.user.id} listed citizens (page ${page}, total ${total})`,
    );
    return sendSuccess(
      res,
      {
        total,
        page: parseInt(page),
        pages: Math.ceil(total / limit),
        citizens,
      },
      "Citizens retrieved successfully",
    );
  } catch (err) {
    logger.error(
      { error: err.message, stack: err.stack },
      "List citizens error",
    );
    return sendError(
      res,
      ErrorCodes.INTERNAL,
      "Failed to retrieve citizens",
      null,
      500,
    );
  }
};

exports.updateCitizenStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const { active } = req.body;

    console.log("updateCitizenStatus called with id:", id, "active:", active);

    if (active === undefined) {
      return sendError(
        res,
        ErrorCodes.VALIDATION,
        "active field is required",
        null,
        400,
      );
    }

    const user = await User.findOne({ _id: id, role: "citizen" });

    if (!user) {
      return sendError(
        res,
        ErrorCodes.NOT_FOUND,
        "Citizen not found",
        null,
        404,
      );
    }

    user.active = active;

    await user.save();

    // IMPORTANT: send response
    return res.status(200).json({
      success: true,
      message: `Citizen ${active ? "activated" : "deactivated"}`,
      user,
    });
  } catch (err) {
    console.error("Full error:", err);

    logger.error(
      { error: err.message, stack: err.stack },
      "Update citizen status error",
    );

    return sendError(
      res,
      ErrorCodes.INTERNAL,
      "Failed to update citizen status",
      null,
      500,
    );
  }
};

// ========== PASSWORD RESET (ADMIN INITIATED) ==========

exports.initiatePasswordReset = async (req, res) => {
  try {
    const { id } = req.params;
    const user = await User.findById(id);
    if (!user) {
      return sendError(res, ErrorCodes.NOT_FOUND, "User not found", null, 404);
    }

    if (user._id.toString() === req.user.id.toString()) {
      return sendError(
        res,
        ErrorCodes.FORBIDDEN,
        "Use /auth/forgot-password to reset your own password",
        null,
        403,
      );
    }

    const token = crypto.randomBytes(32).toString("hex");
    const tokenKey = `reset:token:${token}`;
    await client.setEx(tokenKey, 3600, user._id.toString());

    await sendAdminInitiatedResetEmail(user.email, token);

    await createAuditLog({
      userId: req.user.id,
      userRole: req.user.role,
      action: "INITIATE_PASSWORD_RESET",
      targetType: "User",
      targetId: user._id,
      details: { email: user.email },
      req,
    });

    logger.info(
      `Admin ${req.user.id} initiated password reset for user ${user.email}`,
    );
    return sendSuccess(
      res,
      null,
      `Password reset email sent to ${user.email}. The user will receive a link to set a new password.`,
      200,
    );
  } catch (err) {
    logger.error(
      { error: err.message, stack: err.stack },
      "Admin initiate password reset error",
    );
    return sendError(
      res,
      ErrorCodes.INTERNAL,
      "Failed to initiate password reset",
      null,
      500,
    );
  }
};

// ========== NEW: REPORT MANAGEMENT ==========

// GET /admin/comments/:commentId/reports
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

    const reports = comment.reports.map((report) => ({
      id: report._id,
      reason: report.reason,
      details: report.details,
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

// PUT /admin/comments/:commentId/reports/:reportId
exports.resolveReport = async (req, res) => {
  try {
    const { commentId, reportId } = req.params;
    const { resolution, moderatorNote = "" } = req.body;
    if (!["valid", "invalid", "resolved"].includes(resolution)) {
      return sendError(
        res,
        ErrorCodes.VALIDATION,
        "Resolution must be 'valid', 'invalid', or 'resolved'",
        null,
        400,
      );
    }

    const comment = await Comment.findById(commentId);
    if (!comment)
      return sendError(
        res,
        ErrorCodes.NOT_FOUND,
        "Comment not found",
        null,
        404,
      );

    const report = comment.reports.id(reportId);
    if (!report)
      return sendError(
        res,
        ErrorCodes.NOT_FOUND,
        "Report not found",
        null,
        404,
      );

    report.status = resolution;
    report.resolvedAt = new Date();
    report.resolvedBy = req.user.id;
    report.moderatorNotes = moderatorNote;

    if (resolution === "valid" && comment.visibility === "visible") {
      comment.visibility = "hidden";
      comment.moderationActions.push({
        action: "hide",
        reason: "report_validated",
        actor: req.user.id,
        createdAt: new Date(),
      });
      comment.reportState = "actioned";
    }

    comment.events.push({
      type: "moderated",
      actor: req.user.id,
      data: { action: "resolve_report", reportId, resolution, moderatorNote },
      createdAt: new Date(),
    });
    await comment.save();

    await createAuditLog({
      userId: req.user.id,
      userRole: req.user.role,
      action: "RESOLVE_REPORT",
      targetType: "Comment",
      targetId: comment._id,
      details: { reportId, resolution, moderatorNote },
      req,
    });

    return sendSuccess(res, { reportId, resolution }, "Report resolved");
  } catch (err) {
    logger.error({ error: err.message }, "Resolve report error");
    return sendError(
      res,
      ErrorCodes.INTERNAL,
      "Failed to resolve report",
      null,
      500,
    );
  }
};

// ========== NEW: APPEAL MANAGEMENT ==========

// GET /admin/appeals
exports.getAppeals = async (req, res) => {
  try {
    const { status = "pending", page = 1, limit = 20, policyId } = req.query;
    const user = req.user;
    const isAdmin = user.role === "admin";
    const isCommentModerator = user.role === "comment_moderator";

    let filter = { "appeal.status": status };

    if (policyId && mongoose.Types.ObjectId.isValid(policyId)) {
      const policy = await Policy.findById(policyId).select("createdBy");
      if (!policy) {
        return sendError(
          res,
          ErrorCodes.NOT_FOUND,
          "Policy not found",
          null,
          404,
        );
      }

      const isOwner = policy.createdBy.toString() === user.id.toString();
      const isAssociate = await PolicyAssociate.findOne({
        policyId,
        plannerId: user.id,
        invitationStatus: "accepted",
        permissions: { $in: ["moderate_comments"] },
      });

      if (!isAdmin && !isCommentModerator && !isOwner && !isAssociate) {
        return sendError(
          res,
          ErrorCodes.FORBIDDEN,
          "You do not have permission to view appeals for this policy",
          null,
          403,
        );
      }
      filter.policyId = new mongoose.Types.ObjectId(policyId);
    } else if (!isAdmin && !isCommentModerator) {
      const ownedPolicies = await Policy.find({ createdBy: user.id }).distinct(
        "_id",
      );
      const associatedPolicies = await PolicyAssociate.find({
        plannerId: user.id,
        invitationStatus: "accepted",
        permissions: { $in: ["moderate_comments"] },
      }).distinct("policyId");
      const allowedPolicyIds = [...ownedPolicies, ...associatedPolicies];
      if (allowedPolicyIds.length === 0) {
        return sendSuccess(
          res,
          { appeals: [], pagination: { total: 0, page: 1, limit, pages: 0 } },
          "No accessible policies",
        );
      }
      filter.policyId = { $in: allowedPolicyIds };
    }

    const comments = await Comment.find(filter)
      .populate("userId", "email firstName lastName")
      .populate("policyId", "title")
      .populate("appeal.appellantId", "email firstName lastName")
      .skip((page - 1) * limit)
      .limit(Number(limit))
      .sort({ createdAt: -1 })
      .lean();

    const appeals = comments.map((c) => ({
      commentId: c._id,
      text: c.text,
      policy: c.policyId?.title || "Unknown policy",
      appeal: c.appeal,
      appellant: c.appeal?.appellantId,
      createdAt: c.createdAt,
    }));

    const total = await Comment.countDocuments(filter);

    return sendSuccess(
      res,
      {
        appeals,
        pagination: {
          total,
          page: Number(page),
          limit: Number(limit),
          pages: Math.ceil(total / limit),
        },
      },
      "Appeals retrieved",
    );
  } catch (err) {
    logger.error({ error: err.message }, "Get appeals error");
    return sendError(
      res,
      ErrorCodes.INTERNAL,
      "Failed to retrieve appeals",
      null,
      500,
    );
  }
};

// POST /admin/appeals/:commentId/resolve
exports.resolveAppeal = async (req, res) => {
  try {
    const { commentId } = req.params;
    let { decision, moderatorNote = "" } = req.body;
    if (decision === "approve") decision = "approved";
    if (decision === "reject") decision = "rejected";
    if (!["approved", "rejected"].includes(decision)) {
      return sendError(
        res,
        ErrorCodes.VALIDATION,
        "Decision must be 'approve'/'approved' or 'reject'/'rejected'",
        null,
        400,
      );
    }

    const comment = await Comment.findById(commentId).populate(
      "policyId",
      "createdBy",
    );
    if (!comment) {
      return sendError(
        res,
        ErrorCodes.NOT_FOUND,
        "Comment not found",
        null,
        404,
      );
    }

    if (!comment.appeal || comment.appeal.status !== "pending") {
      return sendError(
        res,
        ErrorCodes.VALIDATION,
        "No pending appeal found",
        null,
        400,
      );
    }

    const user = req.user;
    const isAdmin = user.role === "admin";
    const isCommentModerator = user.role === "comment_moderator";
    const policy = comment.policyId;
    if (!policy) {
      return sendError(
        res,
        ErrorCodes.NOT_FOUND,
        "Policy not found",
        null,
        404,
      );
    }

    // Check permissions: admin, policy owner, or associate with moderate_comments
    let isAuthorized = isAdmin || isCommentModerator;
    if (!isAuthorized && policy.createdBy) {
      const isOwner = policy.createdBy.toString() === user.id.toString();
      if (isOwner) isAuthorized = true;
      else {
        const associate = await PolicyAssociate.findOne({
          policyId: policy._id,
          plannerId: user.id,
          invitationStatus: "accepted",
          permissions: { $in: ["moderate_comments"] },
        });
        if (associate) isAuthorized = true;
      }
    }

    if (!isAuthorized) {
      return sendError(
        res,
        ErrorCodes.FORBIDDEN,
        "You do not have permission to resolve appeals on this policy",
        null,
        403,
      );
    }

    comment.appeal.status = decision;
    comment.appeal.resolvedAt = new Date();
    comment.appeal.resolvedBy = req.user.id;
    comment.appeal.moderatorNotes = moderatorNote;

    if (decision === "approved") {
      comment.visibility = "visible";
      comment.moderationActions.push({
        action: "restore",
        reason: "appeal approved",
        actor: req.user.id,
        createdAt: new Date(),
      });
      comment.reportState = "actioned";
    } else {
      comment.moderationActions.push({
        action: "reject_appeal",
        reason: moderatorNote || "appeal rejected",
        actor: req.user.id,
        createdAt: new Date(),
      });
    }

    comment.events.push({
      type: "appeal_resolved",
      actor: req.user.id,
      data: { decision, moderatorNote },
      createdAt: new Date(),
    });
    await comment.save();

    await createAuditLog({
      userId: req.user.id,
      userRole: req.user.role,
      action: "RESOLVE_APPEAL",
      targetType: "Comment",
      targetId: comment._id,
      details: { decision, moderatorNote },
      req,
    });

    // Notify the appellant without blocking the response.
    if (comment.appeal.appellantId) {
      setImmediate(() => {
        createNotification({
          userId: comment.appeal.appellantId,
          type: "APPEAL_RESOLVED",
          title: `Appeal ${decision}`,
          message: `Your appeal on a comment has been ${decision}. ${moderatorNote ? `Note: ${moderatorNote}` : ""}`,
          data: { commentId: comment._id, decision },
          severity: decision === "approved" ? "info" : "warning",
          source: "system",
        }).catch((err) => {
          logger.error({ error: err.message }, "Deferred appeal notification failed");
        });
      });
    }

    return sendSuccess(res, comment.appeal, "Appeal resolved");
  } catch (err) {
    logger.error({ error: err.message }, "Resolve appeal error");
    return sendError(
      res,
      ErrorCodes.INTERNAL,
      "Failed to resolve appeal",
      null,
      500,
    );
  }
};

// GET /admin/appeals – pending appeals (with optional policyId)
exports.getPendingAppeals = async (req, res) => {
  try {
    const { policyId } = req.query;
    const filter = { "appeal.status": "pending" };
    if (policyId && mongoose.Types.ObjectId.isValid(policyId)) {
      filter.policyId = new mongoose.Types.ObjectId(policyId);
    }
    const comments = await Comment.find(filter)
      .populate("policyId", "title")
      .populate("userId", "email firstName lastName")
      .populate("appeal.appellantId", "email firstName lastName")
      .sort({ createdAt: -1 });
    const appeals = comments.map((c) => ({
      commentId: c._id,
      text: c.text,
      policyTitle: c.policyId?.title || "Unknown",
      author: c.userId ? { email: c.userId.email } : null,
      appealReason: c.appeal?.reason,
      appellant: c.appeal?.appellantId
        ? { email: c.appeal.appellantId.email }
        : null,
      createdAt: c.createdAt,
    }));
    return sendSuccess(res, appeals, "Pending appeals retrieved");
  } catch (err) {
    logger.error({ error: err.message }, "Get pending appeals error");
    return sendError(
      res,
      ErrorCodes.INTERNAL,
      "Failed to retrieve appeals",
      null,
      500,
    );
  }
};
// GET /admin/emerging-topics
exports.getEmergingTopics = async (req, res) => {
  try {
    // Get the baseline (current 24h counts) – the worker stores it as "emerging:baseline"
    // But that's the baseline for comparison. We need the actual emerging topics from the last run.
    // The worker doesn't store the emerging list. Let's compute on demand or store it.
    // Simpler: recompute on demand for the last 24h.

    const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const recentComments = await Comment.find({
      status: "approved",
      createdAt: { $gte: twentyFourHoursAgo },
    }).lean();

    const keywordCount = {};
    recentComments.forEach((c) => {
      if (c.keywords && Array.isArray(c.keywords)) {
        c.keywords.forEach((kw) => {
          const normalized = kw.toLowerCase().trim();
          keywordCount[normalized] = (keywordCount[normalized] || 0) + 1;
        });
      }
    });

    const baselineKey = "emerging:baseline";
    let baseline = await redisClient.get(baselineKey);
    baseline = baseline ? JSON.parse(baseline) : {};

    const emerging = [];
    for (const [keyword, count] of Object.entries(keywordCount)) {
      const prevCount = baseline[keyword] || 0;
      if (prevCount > 0) {
        const increase = (count - prevCount) / prevCount;
        if (increase > 2.0 && count > 5) {
          emerging.push({
            keyword,
            currentCount: count,
            previousCount: prevCount,
            increasePercentage: Math.round(increase * 100),
          });
        }
      }
    }

    emerging.sort((a, b) => b.increasePercentage - a.increasePercentage);
    return sendSuccess(res, emerging, "Emerging topics retrieved");
  } catch (err) {
    logger.error({ error: err.message }, "Get emerging topics error");
    return sendError(
      res,
      ErrorCodes.INTERNAL,
      "Failed to retrieve emerging topics",
      null,
      500,
    );
  }
};
// GET /admin/planners/search?q=email@example.com
exports.searchPlanners = async (req, res) => {
  try {
    const { q } = req.query;
    const query = { role: "planner", active: true };
    if (q && q.trim()) {
      query.email = { $regex: q.trim(), $options: "i" };
    }
    const planners = await User.find(query)
      .select("email languagesSpoken region")
      .limit(20)
      .sort({ email: 1 });
    return sendSuccess(res, planners, "Planners found");
  } catch (err) {
    logger.error({ error: err.message }, "Search planners error");
    return sendError(
      res,
      ErrorCodes.INTERNAL,
      "Failed to search planners",
      null,
      500,
    );
  }
};

// ==================== MOCK SMS TOOLS ====================
exports.simulateSms = async (req, res) => {
  try {
    const { phone, message } = req.body || {};
    const result = await simulateInboundSms({ phone, message });

    return sendSuccess(
      res,
      {
        phoneHash: result.phoneHash,
        phoneLast4: result.phoneLast4,
        normalizedPhone: result.normalizedPhone,
        command: result.command,
        reply: result.reply,
        statusCode: result.statusCode,
        success: result.success,
        subscription: result.subscription,
        metadata: result.metadata,
      },
      "SMS simulated successfully",
    );
  } catch (err) {
    logger.error({ error: err.message, stack: err.stack }, "Simulate SMS error");
    return sendError(
      res,
      ErrorCodes.INTERNAL,
      "Failed to simulate SMS",
      null,
      500,
    );
  }
};

exports.getSmsHistory = async (req, res) => {
  try {
    const { page = 1, limit = 20, q = "", direction = "", command = "" } = req.query;
    const numericPage = Math.max(1, Number.parseInt(page, 10) || 1);
    const numericLimit = Math.min(100, Math.max(1, Number.parseInt(limit, 10) || 20));
    const skip = (numericPage - 1) * numericLimit;

    const filter = {};
    if (direction) filter.direction = direction;
    if (command) filter.command = command.toUpperCase();
    if (q && q.trim()) {
      const term = q.trim();
      filter.$or = [
        { command: { $regex: term, $options: "i" } },
        { inboundMessage: { $regex: term, $options: "i" } },
        { replyMessage: { $regex: term, $options: "i" } },
        { phoneLast4: { $regex: term.slice(-4), $options: "i" } },
      ];
    }

    const [activities, total, smsVotes] = await Promise.all([
      SmsActivity.find(filter)
        .populate("policyId", "title policyCode pollType")
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(numericLimit)
        .lean(),
      SmsActivity.countDocuments(filter),
      Vote.find({ channel: "sms" })
        .populate("policyId", "title policyCode pollType status")
        .sort({ createdAt: -1 })
        .limit(100)
        .lean(),
    ]);

    return sendSuccess(
      res,
      {
        total,
        page: numericPage,
        pages: Math.ceil(total / numericLimit),
        activities,
        votes: smsVotes,
      },
      "SMS history retrieved",
    );
  } catch (err) {
    logger.error({ error: err.message, stack: err.stack }, "Get SMS history error");
    return sendError(
      res,
      ErrorCodes.INTERNAL,
      "Failed to retrieve SMS history",
      null,
      500,
    );
  }
};

exports.getSmsPhoneState = async (req, res) => {
  try {
    const { phone } = req.query;
    if (!phone?.trim()) {
      return sendError(
        res,
        ErrorCodes.VALIDATION,
        "Phone is required",
        null,
        400,
      );
    }

    const normalizedPhone = normalizePhone(phone.trim());
    const phoneHash = hashPhone(normalizedPhone);
    const [subscription, votes, activities, appUser] = await Promise.all([
      SmsSubscription.findOne({ phoneHash }).lean(),
      Vote.find({ phoneHash, channel: "sms" })
        .populate("policyId", "title policyCode pollType status")
        .sort({ createdAt: -1 })
        .lean(),
      SmsActivity.find({ phoneHash })
        .populate("policyId", "title policyCode pollType")
        .sort({ createdAt: -1 })
        .limit(50)
        .lean(),
      User.findOne({ phoneHash, verified: true })
        .select("email region verified")
        .lean(),
    ]);

    return sendSuccess(
      res,
      {
        phoneHash,
        normalizedPhone,
        phoneLast4: normalizedPhone.slice(-4),
        subscription: {
          subscribed: Boolean(subscription?.subscribed),
          subscribedAt: subscription?.subscribedAt || null,
          unsubscribedAt: subscription?.unsubscribedAt || null,
        },
        registeredAppUser: appUser,
        votes,
        activities,
      },
      "SMS phone state retrieved",
    );
  } catch (err) {
    logger.error({ error: err.message, stack: err.stack }, "Get SMS phone state error");
    return sendError(
      res,
      ErrorCodes.INTERNAL,
      "Failed to retrieve SMS phone state",
      null,
      500,
    );
  }
};
