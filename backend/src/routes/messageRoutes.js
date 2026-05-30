const express = require("express");
const router = express.Router();
const messageController = require("../controllers/messageController");
const auth = require("../middleware/authMiddleware");
const limiters = require("../config/rateLimits");
const validateObjectId = require("../middleware/validateObjectId");

router.post(
  "/",
  auth(["planner", "admin"]),
  limiters.comment,
  messageController.sendMessage,
);
router.get(
  "/conversations",
  auth(["planner", "admin"]),
  messageController.getConversations,
);
router.get("/inbox", auth(["planner", "admin"]), messageController.getInbox);
router.get(
  "/:id",
  auth(["planner", "admin"]),
  validateObjectId("id"),
  messageController.getMessage,
);
router.post(
  "/:id/reply",
  auth(["planner", "admin"]),
  validateObjectId("id"),
  limiters.comment,
  messageController.replyToMessage,
);

module.exports = router;
