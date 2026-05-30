const express = require("express");
const router = express.Router();
const policyController = require("../controllers/policyController");
const auth = require("../middleware/authMiddleware");
const aiController = require("../controllers/aiController");
const limiters = require("../config/rateLimits");
const validateObjectId = require("../middleware/validateObjectId");

// ========== Categorized endpoint (must be before /:id) ==========
router.get(
  "/categorized",
  auth(["planner", "admin"]),
  policyController.getCategorizedPolicies,
);

// ========== List all policies (basic) ==========
router.get("/", auth(["citizen", "planner", "admin"]), policyController.getAll);

// ========== Policy CRUD ==========
router.post(
  "/",
  auth(["planner", "admin"]),
  limiters.policyWrite,
  policyController.create,
);

router.put(
  "/:id",
  auth(["planner", "admin"]),
  validateObjectId("id"),
  limiters.policyWrite,
  policyController.update,
);

router.delete(
  "/:id",
  auth(["planner", "admin"]),
  validateObjectId("id"),
  limiters.policyWrite,
  policyController.delete,
);

// ========== Policy lifecycle actions ==========
router.post(
  "/:id/close",
  auth(["planner", "admin"]),
  validateObjectId("id"),
  limiters.policyWrite,
  policyController.close,
);

router.post(
  "/suggest-topics",
  auth(["planner", "admin"]),
  limiters.policyWrite,
  aiController.suggestPolicyTopics,
);

router.patch(
  "/:id/publish",
  auth(["planner", "admin"]),
  validateObjectId("id"),
  limiters.policyWrite,
  policyController.publish,
);

router.patch(
  "/:id/unpublish",
  auth(["planner", "admin"]),
  validateObjectId("id"),
  limiters.policyWrite,
  policyController.unpublish,
);

router.patch(
  "/:id/extend",
  auth(["planner", "admin"]),
  validateObjectId("id"),
  limiters.policyWrite,
  policyController.extendEndDate,
);

router.patch(
  "/:id/pause",
  auth(["planner", "admin"]),
  validateObjectId("id"),
  limiters.policyWrite,
  policyController.pause,
);

router.patch(
  "/:id/resume",
  auth(["planner", "admin"]),
  validateObjectId("id"),
  limiters.policyWrite,
  policyController.resume,
);

router.post(
  "/:id/clone",
  auth(["planner", "admin"]),
  validateObjectId("id"),
  limiters.policyWrite,
  policyController.clone,
);

router.get(
  "/:id/history",
  auth(["planner", "admin"]),
  validateObjectId("id"),
  policyController.getHistory,
);

router.patch(
  "/:id/archive",
  auth(["planner", "admin"]),
  validateObjectId("id"),
  limiters.policyWrite,
  policyController.archive,
);

router.patch(
  "/:id/restore",
  auth(["planner", "admin"]),
  validateObjectId("id"),
  limiters.policyWrite,
  policyController.restore,
);

router.get(
  "/:id/associate-permissions",
  auth(["planner", "admin"]),
  validateObjectId("id"),
  policyController.getAssociatePermissions,
);

// ========== Generic policy by ID (must be last) ==========
router.get(
  "/:id",
  auth(["citizen", "planner", "admin"]),
  validateObjectId("id"),
  policyController.getOne,
);

module.exports = router;
