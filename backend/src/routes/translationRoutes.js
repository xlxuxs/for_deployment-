const express = require("express");
const router = express.Router();
const translationController = require("../controllers/translationController");
const auth = require("../middleware/authMiddleware");
const limiters = require("../config/rateLimits");

// All authenticated users (including comment moderators) can translate
router.post(
  "/",
  auth(["citizen", "planner", "admin", "comment_moderator"]),
  limiters.analyticsRead,
  translationController.translate,
);

module.exports = router;
