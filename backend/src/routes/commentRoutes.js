const express = require("express");
const router = express.Router();
const commentController = require("../controllers/commentController");
const auth = require("../middleware/authMiddleware");
const limiters = require("../config/rateLimits");
const {
  hasCommentPermission,
} = require("../middleware/commentPermissionMiddleware");
const validateObjectId = require("../middleware/validateObjectId");

// =====================================================
// PUBLIC / AUTHENTICATED ROUTES
// =====================================================

// Post a comment (top‑level or reply)
router.post(
  "/",
  auth(["citizen", "planner", "admin"]),
  limiters.comment,
  commentController.postComment,
);

// Get comments for a policy (respects visibility)
router.get(
  "/policy/:policyId",
  auth(["citizen", "planner", "admin"]),
  validateObjectId("policyId"),
  commentController.getPolicyComments,
);

// Get a single comment by ID (respects visibility)
router.get(
  "/:id",
  auth(["citizen", "planner", "admin"]),
  validateObjectId("id"),
  commentController.getCommentById,
);

// Get all versions of a comment thread (for history)
router.get(
  "/:id/versions",
  auth(["planner", "comment_moderator", "admin"]),
  validateObjectId("id"),
  commentController.getCommentVersions,
);

// Get replies of a comment (paginated)
router.get(
  "/:commentId/replies",
  auth(["citizen", "planner", "admin"]),
  validateObjectId("commentId"),
  commentController.getReplies,
);

// Edit a comment (author only, may create new version)
router.put(
  "/:id",
  auth(["citizen", "planner", "admin"]),
  validateObjectId("id"),
  commentController.editComment,
);

// Delete a comment (soft delete all versions, author or admin)
router.delete(
  "/:id",
  auth(["citizen", "planner", "admin"]),
  validateObjectId("id"),
  commentController.deleteComment,
);

// Restore a soft‑deleted comment (author or admin)
router.put(
  "/:id/restore",
  auth(["citizen", "planner", "admin"]),
  validateObjectId("id"),
  commentController.restoreComment,
);

// Report a comment (citizen)
router.post(
  "/:commentId/report",
  auth(["citizen", "planner", "admin"]),
  validateObjectId("commentId"),
  limiters.reportComment,
  commentController.reportComment,
);

// Moderate a comment (planner/admin with permission)
router.put(
  "/:commentId/moderate",
  auth(["planner", "comment_moderator", "admin"]),
  validateObjectId("commentId"),
  limiters.moderateComment,
  hasCommentPermission("moderate_comments"),
  commentController.moderateComment,
);

// Appeal a moderation decision (citizen)
router.post(
  "/:commentId/appeal",
  auth(["citizen"]),
  validateObjectId("commentId"),
  limiters.appealComment,
  commentController.appealComment,
);

// Get my own reports (citizen)
router.get(
  "/my-reports",
  auth(["citizen", "planner", "admin"]),
  commentController.getMyReports,
);

// Get all reports for a comment (moderator)
router.get(
  "/:commentId/reports",
  auth(["planner", "comment_moderator", "admin"]),
  validateObjectId("commentId"),
  commentController.getCommentReports,
);

// Get full event history (planner/admin only)
router.get(
  "/:id/history",
  auth(["planner", "comment_moderator", "admin"]),
  validateObjectId("id"),
  commentController.getCommentHistory,
);

// Get comments needing AI review (planner/admin only)
router.get(
  "/needs-review",
  auth(["planner", "comment_moderator", "admin"]),
  limiters.analyticsRead,
  commentController.getCommentsNeedingReview,
);

module.exports = router;
