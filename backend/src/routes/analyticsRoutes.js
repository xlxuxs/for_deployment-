const express = require("express");
const router = express.Router();
const analyticsController = require("../controllers/analyticsController");
const crossAnalyticsController = require("../controllers/crossAnalyticsController");
const auth = require("../middleware/authMiddleware");
const limiters = require("../config/rateLimits");
const validateObjectId = require("../middleware/validateObjectId");

const analyticsReadLimiter = limiters.analyticsRead;

router.get(
  "/cross",
  auth(["planner", "admin"]),
  analyticsReadLimiter,
  crossAnalyticsController.getCrossAnalytics,
);

router.get(
  "/heatmap",
  auth(["planner", "admin", "citizen"]),
  analyticsReadLimiter,
  analyticsController.getHeatmap,
);

router.get(
  "/:policyId/timeseries",
  auth(["planner", "admin", "citizen"]),
  validateObjectId("policyId"),
  analyticsReadLimiter,
  analyticsController.getTimeseries,
);

router.get(
  "/:policyId/correlation",
  auth(["planner", "admin", "citizen"]),
  validateObjectId("policyId"),
  analyticsReadLimiter,
  analyticsController.getCorrelation,
);

router.get(
  "/:policyId/demographics",
  auth(["planner", "admin", "citizen"]),
  validateObjectId("policyId"),
  analyticsReadLimiter,
  analyticsController.getDemographicBreakdown,
);

// ✅ Open analytics: any planner can view (no associate permission required)
router.get(
  "/:policyId",
  auth(["planner", "admin", "citizen"]),
  validateObjectId("policyId"),
  analyticsReadLimiter,
  analyticsController.getAnalytics,
);

// Export is available to admins, owners, and accepted associates.
router.get(
  "/:policyId/export",
  auth(["planner", "admin", "citizen"]),
  validateObjectId("policyId"),
  analyticsReadLimiter,
  analyticsController.exportAnalytics,
);

// Comments list still requires moderate_comments permission
router.get(
  "/:policyId/comments",
  auth(["planner", "admin", "citizen"]),
  validateObjectId("policyId"),
  analyticsReadLimiter,
  analyticsController.getComments,
);

module.exports = router;
