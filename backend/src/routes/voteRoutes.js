const express = require("express");
const router = express.Router();
const voteController = require("../controllers/voteController");
const auth = require("../middleware/authMiddleware");
const limiters = require("../config/rateLimits");

router.post(
  "/",
  auth(["citizen", "planner"]),
  limiters.vote,
  voteController.submitAppVote,
);

module.exports = router;
