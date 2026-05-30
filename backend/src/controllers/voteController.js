const Vote = require("../models/Vote");
const Policy = require("../models/Policy");
const User = require("../models/User");
const PolicyAssociate = require("../models/PolicyAssociate");
const logger = require("../utils/logger");
const { createAuditLog } = require("../utils/audit");
const {
  sendSuccess,
  sendError,
  ErrorCodes,
} = require("../utils/responseHelper");
const { validateVoteValue, normalizeVoteValue } = require("../utils/pollTypes");
const { recordVote, checkForAnomalies } = require("../services/alertDetection");

exports.submitAppVote = async (req, res) => {
  try {
    const { policyId, value, comment } = req.body;
    if (!policyId || value === undefined) {
      return sendError(
        res,
        ErrorCodes.VALIDATION,
        "policyId and value are required",
        null,
        400,
      );
    }

    // Validate policyId is a valid ObjectId
    if (!mongoose.Types.ObjectId.isValid(policyId)) {
      return sendError(
        res,
        ErrorCodes.VALIDATION,
        "Invalid policyId format",
        null,
        400,
      );
    }

    const user = await User.findById(req.user.id);
    if (!user) {
      return sendError(res, ErrorCodes.NOT_FOUND, "User not found", null, 404);
    }
    if (!user.verified) {
      return sendError(
        res,
        ErrorCodes.NOT_VERIFIED,
        "Please verify your phone number first",
        null,
        403,
      );
    }

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
    if (policy.status !== "active") {
      let msg = "Policy not open for voting";
      if (policy.status === "paused") msg = "Voting is temporarily paused";
      else if (policy.status === "closed") msg = "Policy is closed for voting";
      return sendError(res, ErrorCodes.FORBIDDEN, msg, null, 403);
    }

    const now = new Date();
    const start = new Date(policy.startDate);
    const end = new Date(policy.endDate);
    if (now < start || now > end) {
      return sendError(
        res,
        ErrorCodes.VOTING_CLOSED,
        "Voting not allowed at this time",
        null,
        400,
      );
    }

    if (!validateVoteValue(policy.pollType, value, policy)) {
      return sendError(
        res,
        ErrorCodes.VALIDATION,
        `Invalid vote value for poll type ${policy.pollType}`,
        null,
        400,
      );
    }

    const existing = await Vote.findOne({
      policyId,
      $or: [{ userId: user._id }, { phoneHash: user.phoneHash }],
    });
    if (existing) {
      return sendError(
        res,
        ErrorCodes.ALREADY_VOTED,
        "You have already voted on this policy",
        null,
        409,
      );
    }

    const normalizedValue = normalizeVoteValue(policy.pollType, value);

    const vote = new Vote({
      policyId,
      userId: user._id,
      phoneHash: user.phoneHash,
      channel: "app",
      value: normalizedValue,
      region: user.region,
      demographics: {
        ageRange: user.ageRange,
        gender: user.gender,
        occupation: user.occupation,
        education: user.education,
      },
    });
    await vote.save();

    let commentDoc = null;
    if (comment && comment.trim().length > 0) {
      if (comment.length > 2000) {
        await Vote.deleteOne({ _id: vote._id });
        return sendError(
          res,
          ErrorCodes.VALIDATION,
          "Comment too long (max 2000 characters)",
          null,
          400,
        );
      }
      const Comment = require("../models/Comment");
      
      // Fetch user demographics snapshot
      const demographicsSnapshot = {
        ageRange: user.ageRange,
        gender: user.gender,
        occupation: user.occupation,
        education: user.education,
      };
      
      commentDoc = new Comment({
        policyId,
        userId: user._id,
        voteId: vote._id,
        text: comment.trim(),
        demographics: demographicsSnapshot,
        visibility: "visible",
        moderationStatus: "pending_ai",
        moderationReason: "pending_ai",
      });
      await commentDoc.save();
    }

    await recordVote(policyId, normalizedValue);

    const ownerId = policy.createdBy.toString();
    const associates = await PolicyAssociate.find({
      policyId,
      revokedAt: null,
      permissions: "view_analytics",
    }).select("plannerId");
    const associateIds = associates.map((a) => a.plannerId.toString());

    await checkForAnomalies(
      policyId,
      normalizedValue,
      policy.title,
      ownerId,
      associateIds,
    );

    await createAuditLog({
      userId: user._id,
      userRole: user.role,
      action: "SUBMIT_VOTE",
      targetType: "Vote",
      targetId: vote._id,
      details: {
        policyId,
        pollType: policy.pollType,
        value: normalizedValue,
        hasComment: !!commentDoc,
      },
      req,
    });

    logger.info(
      `User ${user._id} voted on policy ${policyId} (${policy.pollType})`,
    );

    return sendSuccess(
      res,
      { voteId: vote._id, commentId: commentDoc?._id || null },
      commentDoc
        ? "Vote and comment recorded. AI will process comment."
        : "Vote recorded successfully",
      201,
    );
  } catch (err) {
    console.error("Full vote error:", err);
    if (err.code === 11000) {
      return sendError(
        res,
        ErrorCodes.ALREADY_VOTED,
        "You have already voted on this policy",
        null,
        409,
      );
    }
    logger.error({ error: err.message, stack: err.stack }, "App vote error");
    return sendError(
      res,
      ErrorCodes.INTERNAL,
      "Failed to submit vote",
      null,
      500,
    );
  }
};
