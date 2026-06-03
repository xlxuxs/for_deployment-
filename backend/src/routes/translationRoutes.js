const express = require("express");
const router = express.Router();
const translationController = require("../controllers/translationController");
const auth = require("../middleware/authMiddleware");
const limiters = require("../config/rateLimits");

// Allow public translation requests (used by public pages and LanguageSelector).
// Keep rate-limiting to prevent abuse.
router.post("/", limiters.analyticsRead, translationController.translate);

module.exports = router;
