const express = require("express");
const router = express.Router();
const feedController = require("../controllers/feedController");
const auth = require("../middleware/authMiddleware");
const limiters = require("../config/rateLimits");

router.get(
  "/",
  auth(["citizen"]),
  limiters.analyticsRead,
  feedController.getFeed,
);
router.post("/interact", auth(["citizen"]), feedController.recordInteraction);

module.exports = router;
