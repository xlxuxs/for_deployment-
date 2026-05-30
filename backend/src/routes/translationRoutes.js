const express = require("express");
const router = express.Router();
const translationController = require("../controllers/translationController");
const auth = require("../middleware/authMiddleware");
const limiters = require("../config/rateLimits");

// All authenticated users (citizen, planner, admin) can translate
router.post(
  "/",
  auth(["citizen", "planner", "admin"]),
  limiters.analyticsRead,
  translationController.translate,
);

module.exports = router;
