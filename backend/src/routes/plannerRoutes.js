const express = require("express");
const multer = require("multer");
const router = express.Router();
const plannerController = require("../controllers/plannerController");
const auth = require("../middleware/authMiddleware");
const limiters = require("../config/rateLimits");
const validateObjectId = require("../middleware/validateObjectId");

const ALLOWED_PROOF_MIME_TYPES = new Set([
  "application/pdf",
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
]);

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    if (ALLOWED_PROOF_MIME_TYPES.has(file.mimetype)) {
      return cb(null, true);
    }

    const error = new multer.MulterError("LIMIT_UNEXPECTED_FILE", file.fieldname);
    error.message = "Only image, PDF, DOC, or DOCX files are allowed.";
    return cb(error, false);
  },
});

const optionalCitizenAuth = (req, res, next) => {
  const token = req.header("Authorization")?.replace("Bearer ", "");
  if (!token) return next();
  return auth(["citizen"])(req, res, next);
};

// ==================== PLANNER REQUESTS (Citizen -> Planner) ====================
router.post(
  "/request",
  optionalCitizenAuth,
  limiters.plannerRequest,
  upload.single("proofFile"),
  plannerController.requestPlanner,
);

router.post(
  "/appeals",
  limiters.plannerRequest,
  plannerController.submitDeactivationAppeal,
);

router.get(
  "/appeals",
  auth(["admin"]),
  plannerController.listDeactivationAppeals,
);

router.post(
  "/appeals/:id/resolve",
  auth(["admin"]),
  validateObjectId("id"),
  plannerController.resolveDeactivationAppeal,
);

router.post(
  "/training/complete",
  auth(["planner"]),
  plannerController.completeTraining,
);

router.get(
  "/requests/pending",
  auth(["admin"]),
  plannerController.listPendingRequests,
);

router.get(
  "/requests/history",
  auth(["admin"]),
  plannerController.listRequestHistory,
);

router.post(
  "/requests/:id/approve",
  auth(["admin"]),
  validateObjectId("id"),
  plannerController.approveRequest,
);

router.post(
  "/requests/:id/reject",
  auth(["admin"]),
  validateObjectId("id"),
  plannerController.rejectRequest,
);

router.get(
  "/search",
  auth(["planner", "admin"]),
  plannerController.searchPlannersByLanguage,
);

// ==================== ASSOCIATE MANAGEMENT (Policy Owner / Admin) ====================
router.post(
  "/policies/:policyId/associates",
  auth(["planner", "admin"]),
  validateObjectId("policyId"),
  plannerController.addAssociate,
);

router.get(
  "/policies/:policyId/associates",
  auth(["planner", "admin"]),
  validateObjectId("policyId"),
  plannerController.listAssociates,
);

router.patch(
  "/policies/:policyId/associates/:associateId",
  auth(["planner", "admin"]),
  validateObjectId("policyId"),
  validateObjectId("associateId"),
  plannerController.updateAssociatePermissions,
);

router.delete(
  "/policies/:policyId/associates/:associateId",
  auth(["planner", "admin"]),
  validateObjectId("policyId"),
  validateObjectId("associateId"),
  plannerController.revokeAssociate,
);

// ==================== INVITATION ACTIONS (Associate) ====================
router.post(
  "/associates/:associateId/accept",
  auth(["planner"]),
  validateObjectId("associateId"),
  plannerController.acceptAssociateInvitation,
);

router.post(
  "/associates/:associateId/reject",
  auth(["planner"]),
  validateObjectId("associateId"),
  plannerController.rejectAssociateInvitation,
);

router.delete(
  "/associates/:associateId",
  auth(["planner"]),
  validateObjectId("associateId"),
  plannerController.revokeSelfAsAssociate,
);

// ==================== ASSOCIATE VIEWS (Accepted & Pending) ====================
router.get(
  "/associates/policies",
  auth(["planner"]),
  plannerController.getMyAssociatePolicies,
);

// NEW: Get all pending invitations for the logged‑in planner
router.get(
  "/associates/invitations/pending",
  auth(["planner"]),
  plannerController.getPendingInvitations,
);

router.get(
  "/associates/invitations/history",
  auth(["planner"]),
  plannerController.getInvitationHistory,
);

// NEW: Get details of a single pending invitation (to preview policy before accepting)
router.get(
  "/associates/invitations/:invitationId",
  auth(["planner"]),
  validateObjectId("invitationId"),
  plannerController.getInvitationDetails,
);
router.get(
  "/active",
  auth(["planner", "admin"]),
  plannerController.searchActivePlanners,
);

module.exports = router;
