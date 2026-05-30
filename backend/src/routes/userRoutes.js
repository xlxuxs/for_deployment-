const express = require("express");
const router = express.Router();
const userController = require("../controllers/userController");
const authMiddleware = require("../middleware/authMiddleware");
const limiters = require("../config/rateLimits");
const validateObjectId = require("../middleware/validateObjectId");

router.use(authMiddleware(["citizen", "planner", "comment_moderator", "admin"]));

router.get("/me", userController.getMe);
router.put("/me", limiters.userProfileUpdate, userController.updateMe);
router.put(
  "/me/password",
  limiters.userProfileUpdate,
  userController.changePassword,
);
router.delete("/me", limiters.userProfileUpdate, userController.deleteMe);
router.get("/me/export", limiters.dataExport, userController.exportMe);

router.get("/me/history", userController.getHistory);

router.post(
  "/me/email/request",
  limiters.userProfileUpdate,
  userController.requestEmailChange,
);
router.post(
  "/me/email/verify",
  limiters.userProfileUpdate,
  userController.verifyEmailChange,
);

router.get("/me/notifications", userController.getNotifications);
router.patch(
  "/me/notifications/:id/read",
  validateObjectId("id"),
  userController.markNotificationRead,
);
router.patch(
  "/me/notifications/read-all",
  userController.markAllNotificationsRead,
);

router.post(
  "/me/phone/request",
  limiters.phoneChangeRequest,
  userController.requestPhoneChange,
);
router.post(
  "/me/phone/verify",
  limiters.userProfileUpdate,
  userController.verifyPhoneChange,
);

module.exports = router;
