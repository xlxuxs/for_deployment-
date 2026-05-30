const Comment = require("../models/Comment");
const Policy = require("../models/Policy");
const PolicyAssociate = require("../models/PolicyAssociate");

const hasCommentPermission = (requiredPermission) => {
  return async (req, res, next) => {
    try {
      const commentId = req.params.id || req.params.commentId;

      if (!commentId) {
        return res.status(400).json({
          status: "error",
          error: {
            code: "BAD_REQUEST",
            message: "Comment ID required",
          },
        });
      }

      const comment = await Comment.findById(commentId).select("policyId");

      if (!comment || !comment.policyId) {
        return res.status(404).json({
          status: "error",
          error: {
            code: "NOT_FOUND",
            message: "Comment not found",
          },
        });
      }

      const policy = await Policy.findById(comment.policyId).select(
        "createdBy",
      );

      if (!policy) {
        return res.status(404).json({
          status: "error",
          error: {
            code: "NOT_FOUND",
            message: "Policy not found",
          },
        });
      }

      const ownerId =
        typeof policy.createdBy === "object"
          ? policy.createdBy._id?.toString()
          : policy.createdBy?.toString();

      const userId = req.user.id.toString();

      if (req.user.role === "comment_moderator") {
        return next();
      }

      // owner/admin bypass
      if (ownerId === userId || req.user.role === "admin") {
        return next();
      }

      const associate = await PolicyAssociate.findOne({
        policyId: comment.policyId,
        plannerId: req.user.id,
        revokedAt: null,
        acceptedAt: { $ne: null },
        permissions: requiredPermission,
      });

      if (associate) {
        req.associate = associate;
        return next();
      }

      return res.status(403).json({
        status: "error",
        error: {
          code: "FORBIDDEN",
          message: "Insufficient permissions",
        },
      });
    } catch (err) {
      return next(err);
    }
  };
};

module.exports = { hasCommentPermission };
