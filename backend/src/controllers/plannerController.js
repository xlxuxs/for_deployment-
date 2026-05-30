const User = require("../models/User");
const PlannerRequest = require("../models/PlannerRequest");
const PlannerAppeal = require("../models/PlannerAppeal");
const Policy = require("../models/Policy");
const PolicyAssociate = require("../models/PolicyAssociate");
const crypto = require("crypto");
const client = require("../config/redis");
const { createAuditLog } = require("../utils/audit");
const { createNotification } = require("../services/notificationService");
const { comparePassword, hashPassword, hashPhone } = require("../utils/helpers");
const { uploadBufferToCloudinary } = require("../utils/cloudinaryUpload");
const {
  sendSuccess,
  sendError,
  ErrorCodes,
} = require("../utils/responseHelper");
const { sendEmail, sendPlannerPasswordSetupEmail } = require("../utils/email");

const escapeHtml = (value = "") =>
  String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");

const getProofResourceType = (mimetype = "") => {
  if (
    [
      "application/pdf",
      "application/msword",
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    ].includes(mimetype)
  ) {
    return "raw";
  }

  return "image";
};

// Helper: convert permission keys to user‑friendly labels
const formatPermissions = (perms) => {
  const map = {
    moderate_comments: "Moderate Comments",
    reply_official: "Official Replies",
    export_data: "Export Data",
  };
  return perms.map((p) => map[p] || p).join(", ");
};

const normalizeLanguageCode = (value) => {
  const normalized = String(value || "").trim().toLowerCase();
  const map = {
    am: "am",
    amharic: "am",
    om: "om",
    afaanoromoo: "om",
    "afaan oromoo": "om",
    oromo: "om",
    ti: "ti",
    tigrinya: "ti",
    en: "en",
    english: "en",
  };
  return map[normalized] || null;
};

// ==================== CITIZEN REQUESTS TO BECOME PLANNER ====================
exports.requestPlanner = async (req, res) => {
  try {
    const {
      organization,
      reason,
      applicantType,
      fullName,
      email,
      phone,
      region,
      ageRange,
      gender,
      occupation,
      education,
      preferredLanguage,
      languagesSpoken,
    } = req.body;

    if (!req.file) {
      return sendError(
        res,
        ErrorCodes.VALIDATION,
        "Supporting proof file is required.",
        null,
        400,
      );
    }

    if (!reason || reason.length < 50) {
      return sendError(
        res,
        ErrorCodes.VALIDATION,
        "Reason must be at least 50 characters.",
        null,
        400,
      );
    }
    const userId = req.user?.id || null;
    const isCitizenRequest = !!userId;
    const normalizedEmail = email ? email.trim().toLowerCase() : "";
    const normalizedPhone = phone ? phone.trim() : "";

    if (!isCitizenRequest) {
      if (
        !fullName ||
        !email ||
        !phone ||
        !region ||
        !ageRange ||
        !gender ||
        !occupation ||
        !education ||
        !preferredLanguage ||
        !languagesSpoken ||
        !organization
      ) {
        return sendError(
          res,
          ErrorCodes.VALIDATION,
          "Full name, email, phone, region, age range, gender, occupation, education, preferred language, languages spoken, and organization are required for planner requests without login.",
          null,
          400,
        );
      }

      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(normalizedEmail)) {
        return sendError(
          res,
          ErrorCodes.VALIDATION,
          "Invalid email address.",
          null,
          400,
        );
      }

      const phoneRegex = /^(\+251|0)?9\d{8}$/;
      if (!phoneRegex.test(normalizedPhone.replace(/\s/g, ""))) {
        return sendError(
          res,
          ErrorCodes.VALIDATION,
          "Invalid Ethiopian phone number format. Use +2519XXXXXXXX or 09XXXXXXXX.",
          null,
          400,
        );
      }

      const existingPhoneOwner = await User.findOne({
        phoneHash: hashPhone(normalizedPhone),
      });
      if (
        existingPhoneOwner &&
        existingPhoneOwner.email.toLowerCase() !== normalizedEmail
      ) {
        return sendError(
          res,
          ErrorCodes.DUPLICATE,
          "Phone number already belongs to another account.",
          null,
          409,
        );
      }
    }

    const spokenLanguages = Array.isArray(languagesSpoken)
      ? languagesSpoken.filter(Boolean)
      : String(languagesSpoken || "")
          .split(",")
          .map((item) => item.trim())
          .filter(Boolean);
    const normalizedLanguages = spokenLanguages
      .map(normalizeLanguageCode)
      .filter(Boolean);

    const existing = await PlannerRequest.findOne(
      isCitizenRequest
        ? { userId, status: "pending" }
        : { email: normalizedEmail, status: "pending" },
    );
    if (existing) {
      return sendError(
        res,
        ErrorCodes.DUPLICATE,
        "You already have a pending request. Please wait for admin review.",
        null,
        409,
      );
    }
    let uploadResult = { secure_url: "" };
    try {
      uploadResult = await uploadBufferToCloudinary(req.file.buffer, {
        resource_type: getProofResourceType(req.file.mimetype),
        public_id: `planner-proof-${Date.now()}`,
        context: {
          applicant_email: normalizedEmail || userId || "citizen",
          original_filename: req.file.originalname,
        },
      });
    } catch (e) {
      console.error("Cloudinary upload failed (falling back):", e);
      // Continue without failing the request; store empty proof URL so admin
      // can still review the submitted form data.
      uploadResult = { secure_url: "" };
    }

    const request = new PlannerRequest({
      userId,
      applicantType:
        applicantType === "citizen" || isCitizenRequest
          ? "citizen"
          : "nonCitizen",
      fullName: fullName || "",
      email: normalizedEmail,
      phone: normalizedPhone,
      region: region || "",
      ageRange: ageRange || "",
      gender: gender || "",
      occupation: occupation || "",
      education: education || "",
      preferredLanguage: preferredLanguage || "",
      languagesSpoken: normalizedLanguages.length
        ? normalizedLanguages
        : [preferredLanguage || "en"],
      organization: organization || "",
      reason,
      proofFile: uploadResult.secure_url,
    });
    await request.save();
    // Notify admins about the new planner request
    try {
      const admins = await User.find({ role: "admin", active: true }).select("_id");
      if (admins && admins.length) {
        const notifyPromises = admins.map((a) =>
          createNotification({
            userId: a._id,
            type: "PLANNER_REQUEST_CREATED",
            title: "New Planner Request",
            message: `${request.fullName || request.email} submitted a planner request.`,
            data: { requestId: request._id },
            severity: "info",
            source: "system",
          }),
        );
        // Don't block the request response on notification delivery
        Promise.allSettled(notifyPromises).catch(() => {});
      }
    } catch (e) {
      // Log but do not fail the request
      console.error("Failed to notify admins of planner request:", e);
    }
    if (userId) {
      await createAuditLog({
        userId,
        userRole: "citizen",
        action: "PLANNER_REQUEST_CREATED",
        details: { organization, reasonPreview: reason.slice(0, 100) },
        req,
      });
    }
    return sendSuccess(
      res,
      { requestId: request._id },
      "Your request has been submitted. Admins will review it.",
      201,
    );
  } catch (err) {
    console.error(err);
    return sendError(
      res,
      ErrorCodes.INTERNAL,
      "Failed to submit request. Please try again.",
      null,
      500,
    );
  }
};

// ==================== ADMIN ENDPOINTS ====================
exports.listPendingRequests = async (req, res) => {
  try {
    const requests = await PlannerRequest.find({ status: "pending" })
      .populate(
        "userId",
        "email region ageRange gender occupation education createdAt",
      )
      .sort({ createdAt: -1 });
    return sendSuccess(res, requests);
  } catch (err) {
    console.error(err);
    return sendError(
      res,
      ErrorCodes.INTERNAL,
      "Failed to fetch requests",
      null,
      500,
    );
  }
};

exports.listRequestHistory = async (req, res) => {
  try {
    const { status } = req.query;
    const query = {};

    if (status === "approved" || status === "rejected") {
      query.status = status;
    } else {
      query.status = { $in: ["approved", "rejected"] };
    }

    const requests = await PlannerRequest.find(query)
      .populate(
        "userId",
        "email region ageRange gender occupation education createdAt",
      )
      .populate("reviewedBy", "email")
      .sort({ reviewedAt: -1, createdAt: -1 });

    return sendSuccess(res, requests);
  } catch (err) {
    console.error(err);
    return sendError(
      res,
      ErrorCodes.INTERNAL,
      "Failed to fetch request history",
      null,
      500,
    );
  }
};

exports.approveRequest = async (req, res) => {
  try {
    const { id } = req.params;
    const request = await PlannerRequest.findById(id);
    if (!request)
      return sendError(
        res,
        ErrorCodes.NOT_FOUND,
        "Request not found",
        null,
        404,
      );
    if (request.status !== "pending")
      return sendError(
        res,
        ErrorCodes.VALIDATION,
        `Request already ${request.status}`,
        null,
        400,
      );
    let user = request.userId
      ? await User.findById(request.userId)
      : await User.findOne({ email: request.email });

    if (!user) {
      const temporaryPassword = crypto.randomBytes(32).toString("hex");
      user = new User({
        email: request.email,
        passwordHash: await hashPassword(temporaryPassword),
        phoneHash: hashPhone(request.phone),
        role: "planner",
        region: request.region,
        ageRange: request.ageRange,
        gender: request.gender,
        occupation: request.occupation,
        education: request.education,
        preferredLanguage: request.preferredLanguage || "en",
        languagesSpoken: request.languagesSpoken?.length
          ? request.languagesSpoken
          : [request.preferredLanguage || "en"],
        verified: true,
        active: true,
        trainingCompletedAt: null,
      });
    }

    user.role = "planner";
    user.active = true;
    user.verified = true;
    user.tokenVersion += 1;
    await user.save();

    if (!request.userId) {
      request.userId = user._id;
    }

    request.status = "approved";
    request.reviewedBy = req.user.id;
    request.reviewedAt = new Date();
    await request.save();

    const setupToken = crypto.randomBytes(32).toString("hex");
    const setupTokenKey = `reset:token:${setupToken}`;
    await client.setEx(setupTokenKey, 86400, user._id.toString());
    await sendPlannerPasswordSetupEmail(user.email, setupToken);

    await createAuditLog({
      userId: user._id,
      userRole: "admin",
      action: "PLANNER_APPROVED",
      details: { approvedBy: req.user.id, requestId: request._id },
      req,
    });
    // In‑app notification
    await createNotification({
      userId: user._id,
      type: "PLANNER_APPROVED",
      title: "Planner Request Approved",
      message: `Congratulations! You are now a planner. Please log in and complete the mandatory training.`,
      data: {},
      severity: "info",
      source: "system",
    });
    return sendSuccess(
      res,
      null,
      "Planner request approved. A password setup link was sent to the applicant.",
    );
  } catch (err) {
    console.error(err);
    return sendError(
      res,
      ErrorCodes.INTERNAL,
      "Failed to approve request",
      null,
      500,
    );
  }
};

exports.rejectRequest = async (req, res) => {
  try {
    const { id } = req.params;
    const { rejectionReason } = req.body;
    if (!rejectionReason || rejectionReason.length < 10)
      return sendError(
        res,
        ErrorCodes.VALIDATION,
        "Rejection reason must be at least 10 characters.",
        null,
        400,
      );
    const request = await PlannerRequest.findById(id);
    if (!request)
      return sendError(
        res,
        ErrorCodes.NOT_FOUND,
        "Request not found",
        null,
        404,
      );
    if (request.status !== "pending")
      return sendError(
        res,
        ErrorCodes.VALIDATION,
        `Request already ${request.status}`,
        null,
        400,
      );
    request.status = "rejected";
    request.reviewedBy = req.user.id;
    request.reviewedAt = new Date();
    request.rejectionReason = rejectionReason;
    await request.save();
    const user = request.userId ? await User.findById(request.userId) : null;
    const recipient = user?.email || request.email;
    if (recipient) {
      const safeReason = escapeHtml(rejectionReason);
      await sendEmail({
        to: recipient,
        subject: "Planner Request Rejected",
        text: `Your request to become a planner was rejected.\n\nReason: ${rejectionReason}`,
        html: `<p>Your request to become a planner was rejected.</p><p><strong>Reason:</strong> ${safeReason}</p>`,
      });
    }
    await createAuditLog({
      userId: req.user.id,
      userRole: "admin",
      action: "PLANNER_REJECTED",
      details: { requestId: id, reason: rejectionReason },
      req,
    });
    return sendSuccess(res, null, "Request rejected.");
  } catch (err) {
    console.error(err);
    return sendError(
      res,
      ErrorCodes.INTERNAL,
      "Failed to reject request",
      null,
      500,
    );
  }
};

// ==================== DEACTIVATED PLANNER APPEALS ====================
exports.submitDeactivationAppeal = async (req, res) => {
  try {
    const { email, password, reason } = req.body;
    if (!email || !password || !reason || reason.trim().length < 20) {
      return sendError(
        res,
        ErrorCodes.VALIDATION,
        "Email, password, and an appeal reason of at least 20 characters are required.",
        null,
        400,
      );
    }

    const planner = await User.findOne({ email, role: "planner" });
    if (!planner) {
      return sendError(
        res,
        ErrorCodes.NOT_FOUND,
        "Planner account not found.",
        null,
        404,
      );
    }
    if (planner.active) {
      return sendError(
        res,
        ErrorCodes.VALIDATION,
        "This planner account is already active.",
        null,
        400,
      );
    }

    const validPassword = await comparePassword(password, planner.passwordHash);
    if (!validPassword) {
      return sendError(
        res,
        ErrorCodes.INVALID_CREDENTIALS,
        "Invalid email or password.",
        null,
        401,
      );
    }

    const existing = await PlannerAppeal.findOne({
      plannerId: planner._id,
      status: "pending",
    });
    if (existing) {
      return sendError(
        res,
        ErrorCodes.DUPLICATE,
        "You already have a pending appeal. Please wait for admin review.",
        null,
        409,
      );
    }

    const appeal = await PlannerAppeal.create({
      plannerId: planner._id,
      reason: reason.trim(),
    });

    await createAuditLog({
      userId: planner._id,
      userRole: "planner",
      action: "PLANNER_DEACTIVATION_APPEAL_SUBMITTED",
      targetType: "PlannerAppeal",
      targetId: appeal._id,
      details: { email: planner.email },
      req,
    });

    return sendSuccess(
      res,
      { appealId: appeal._id },
      "Your appeal has been submitted for admin review.",
      201,
    );
  } catch (err) {
    console.error(err);
    return sendError(
      res,
      ErrorCodes.INTERNAL,
      "Failed to submit appeal",
      null,
      500,
    );
  }
};

exports.listDeactivationAppeals = async (req, res) => {
  try {
    const { status = "pending" } = req.query;
    const filter =
      status && status !== "all"
        ? { status }
        : { status: { $in: ["pending", "approved", "rejected"] } };
    const appeals = await PlannerAppeal.find(filter)
      .populate("plannerId", "email region active createdAt")
      .populate("resolvedBy", "email")
      .sort({ createdAt: -1 });
    return sendSuccess(res, appeals, "Planner appeals retrieved");
  } catch (err) {
    console.error(err);
    return sendError(
      res,
      ErrorCodes.INTERNAL,
      "Failed to retrieve planner appeals",
      null,
      500,
    );
  }
};

exports.resolveDeactivationAppeal = async (req, res) => {
  try {
    const { id } = req.params;
    const { decision, adminNote = "" } = req.body;
    if (!["approve", "reject"].includes(decision)) {
      return sendError(
        res,
        ErrorCodes.VALIDATION,
        "Decision must be approve or reject.",
        null,
        400,
      );
    }

    const appeal = await PlannerAppeal.findById(id).populate("plannerId");
    if (!appeal) {
      return sendError(res, ErrorCodes.NOT_FOUND, "Appeal not found", null, 404);
    }
    if (appeal.status !== "pending") {
      return sendError(
        res,
        ErrorCodes.VALIDATION,
        `Appeal already ${appeal.status}.`,
        null,
        400,
      );
    }

    appeal.status = decision === "approve" ? "approved" : "rejected";
    appeal.resolvedBy = req.user.id;
    appeal.resolvedAt = new Date();
    appeal.adminNote = adminNote.trim();
    await appeal.save();

    if (decision === "approve") {
      await User.updateOne(
        { _id: appeal.plannerId._id },
        { $set: { active: true }, $inc: { tokenVersion: 1 } },
        { runValidators: false },
      );
    }

    await createAuditLog({
      userId: req.user.id,
      userRole: req.user.role,
      action: "PLANNER_DEACTIVATION_APPEAL_RESOLVED",
      targetType: "PlannerAppeal",
      targetId: appeal._id,
      details: {
        plannerId: appeal.plannerId._id,
        decision,
        adminNote: appeal.adminNote,
      },
      req,
    });

    await sendEmail({
      to: appeal.plannerId.email,
      subject:
        decision === "approve"
          ? "Planner Appeal Approved"
          : "Planner Appeal Rejected",
      html: `<p>Your deactivation appeal was ${appeal.status}.</p>${
        appeal.adminNote ? `<p>Admin note: ${escapeHtml(appeal.adminNote)}</p>` : ""
      }`,
    });

    if (decision === "approve") {
      await createNotification({
        userId: appeal.plannerId._id,
        type: "PLANNER_APPEAL_APPROVED",
        title: "Planner Appeal Approved",
        message: "Your account has been reactivated. You can log in again.",
        data: { appealId: appeal._id },
        severity: "info",
        source: "system",
      });
    }

    return sendSuccess(res, appeal, `Appeal ${appeal.status}.`);
  } catch (err) {
    console.error(err);
    return sendError(
      res,
      ErrorCodes.INTERNAL,
      "Failed to resolve appeal",
      null,
      500,
    );
  }
};

// ==================== TRAINING COMPLETION (PLANNER ONLY) ====================
exports.completeTraining = async (req, res) => {
  try {
    const user = await User.findById(req.user.id);
    if (user.role !== "planner")
      return sendError(
        res,
        ErrorCodes.FORBIDDEN,
        "Only planners can complete training.",
        null,
        403,
      );
    if (user.trainingCompletedAt)
      return sendError(
        res,
        ErrorCodes.VALIDATION,
        "Training already completed.",
        null,
        400,
      );
    const completedAt = new Date();
    await User.updateOne(
      { _id: user._id },
      { $set: { trainingCompletedAt: completedAt } },
      { runValidators: false },
    );
    await createAuditLog({
      userId: user._id,
      userRole: "planner",
      action: "TRAINING_COMPLETED",
      details: {},
      req,
    });
    return sendSuccess(
      res,
      null,
      "Training completed. You can now create policies.",
    );
  } catch (err) {
    console.error(err);
    return sendError(
      res,
      ErrorCodes.INTERNAL,
      "Failed to complete training",
      null,
      500,
    );
  }
};

// ========== SEARCH PLANNERS BY LANGUAGE ==========
exports.searchPlannersByLanguage = async (req, res) => {
  try {
    const { language } = req.query;

    let query = { role: "planner", active: true, deletedAt: null };

    if (
      language &&
      language !== "all" &&
      ["am", "om", "ti", "en"].includes(language)
    ) {
      query.languagesSpoken = language;
    }

    const planners = await User.find(query)
      .select("email region languagesSpoken trainingCompletedAt")
      .limit(50);
    return sendSuccess(res, planners, "Planners found");
  } catch (err) {
    console.error(err);
    return sendError(
      res,
      ErrorCodes.INTERNAL,
      "Failed to search planners",
      null,
      500,
    );
  }
};

// ========== ASSOCIATE ==========

exports.addAssociate = async (req, res) => {
  try {
    const { policyId } = req.params;
    const { plannerEmail, message } = req.body;
    const invitationMessage = (message || "").trim();
    const escapedInvitationMessage = escapeHtml(invitationMessage);

    if (!plannerEmail || !invitationMessage) {
      return sendError(
        res,
        ErrorCodes.VALIDATION,
        "plannerEmail and invitation message required",
        null,
        400,
      );
    }

    const policy = await Policy.findById(policyId);
    if (!policy) {
      return sendError(
        res,
        ErrorCodes.NOT_FOUND,
        "Policy not found",
        null,
        404,
      );
    }

    const isOwner = policy.createdBy.toString() === req.user.id.toString();
    if (req.user.role !== "admin" && !isOwner) {
      return sendError(
        res,
        ErrorCodes.FORBIDDEN,
        "Only the policy owner or an admin can add associates",
        null,
        403,
      );
    }

    const associateUser = await User.findOne({
      email: plannerEmail,
      role: "planner",
      active: true,
    });
    if (!associateUser) {
      return sendError(
        res,
        ErrorCodes.NOT_FOUND,
        "Planner not found with that email",
        null,
        404,
      );
    }

    if (
      associateUser._id.toString() === req.user.id.toString() &&
      req.user.role !== "admin"
    ) {
      return sendError(
        res,
        ErrorCodes.VALIDATION,
        "You cannot assign yourself as associate",
        null,
        400,
      );
    }

    const existing = await PolicyAssociate.findOne({
      policyId,
      plannerId: associateUser._id,
      invitationStatus: { $in: ["pending", "accepted"] },
    });
    if (existing) {
      return sendError(
        res,
        ErrorCodes.DUPLICATE,
        `This planner already has a ${existing.invitationStatus} invitation/association for this policy.`,
        null,
        409,
      );
    }

    const associate = new PolicyAssociate({
      policyId,
      plannerId: associateUser._id,
      permissions: [],
      assignedBy: req.user.id,
      metadata: {
        notes: invitationMessage,
        ipAddress: req.ip,
        userAgent: req.get("user-agent"),
      },
    });
    await associate.save();

    // In-app notification with the owner's invitation message.
    await createNotification({
      userId: associateUser._id,
      type: "ASSOCIATE_INVITED",
      title: "Policy Associate Invitation",
      message: `You have been invited to help analyze policy "${policy.title}". It expires on ${associate.expiresAt.toLocaleDateString()}.`,
      data: { policyId, associateId: associate._id, message: invitationMessage },
      severity: "info",
      source: "system",
    });

    // Email with the invitation message.
    const frontendUrl = (process.env.FRONTEND_URL || "http://localhost:3000").replace(/\/$/, "");
    const acceptUrl = `${frontendUrl}/associates/invitation/${associate._id}?action=accept`;
    const rejectUrl = `${frontendUrl}/associates/invitation/${associate._id}?action=reject`;
    await sendEmail({
      to: associateUser.email,
      subject: `Invitation to become an associate for policy: ${policy.title}`,
      html: `<p>You have been invited by ${req.user.email} to help analyze policy "${policy.title}".</p>
             <p><strong>Message from ${req.user.email}:</strong></p>
             <p>${escapedInvitationMessage}</p>
             <p>This invitation expires on ${associate.expiresAt.toLocaleDateString()}.</p>
             <p><a href="${acceptUrl}">Accept Invitation</a> | <a href="${rejectUrl}">Reject Invitation</a></p>
             <p>If you accept, you will be able to view the policy and analyze its analytics information. If you reject, no further action is needed.</p>`,
    });

    await createAuditLog({
      userId: req.user.id,
      userRole: req.user.role,
      action: "ADD_ASSOCIATE",
      targetType: "PolicyAssociate",
      targetId: associate._id,
      details: {
        policyId,
        plannerId: associateUser._id,
        message: invitationMessage,
        expiresAt: associate.expiresAt,
      },
      req,
    });

    return sendSuccess(
      res,
      {
        associateId: associate._id,
        expiresAt: associate.expiresAt,
        message: invitationMessage,
      },
      "Invitation sent. The associate must accept before it expires.",
    );
  } catch (err) {
    console.error(err);
    return sendError(
      res,
      ErrorCodes.INTERNAL,
      "Failed to add associate",
      null,
      500,
    );
  }
};

// ========== LIST ASSOCIATES (for a policy) ==========
exports.listAssociates = async (req, res) => {
  try {
    const { policyId } = req.params;
    const policy = await Policy.findById(policyId);
    if (!policy) {
      return sendError(
        res,
        ErrorCodes.NOT_FOUND,
        "Policy not found",
        null,
        404,
      );
    }

    const isOwner = policy.createdBy.toString() === req.user.id.toString();
    if (req.user.role !== "admin" && !isOwner) {
      return sendError(
        res,
        ErrorCodes.FORBIDDEN,
        "Only the policy owner or an admin can view associates",
        null,
        403,
      );
    }

    const associates = await PolicyAssociate.find({ policyId })
      .populate("plannerId", "email region languagesSpoken firstName lastName")
      .populate("assignedBy", "email firstName lastName")
      .populate("revokedBy", "email")
      .sort({ createdAt: -1 });

    const enriched = associates.map((a) => ({
      ...a.toObject(),
      displayStatus: a.displayStatus,
      daysRemaining: a.isPending ? a.daysRemaining : null,
    }));

    return sendSuccess(res, enriched, "Associates retrieved");
  } catch (err) {
    console.error(err);
    return sendError(
      res,
      ErrorCodes.INTERNAL,
      "Failed to list associates",
      null,
      500,
    );
  }
};

// ========== UPDATE ASSOCIATE PERMISSIONS ==========
exports.updateAssociatePermissions = async (req, res) => {
  try {
    const { policyId, associateId } = req.params;
    const { permissions } = req.body;

    if (!permissions || !permissions.length) {
      return sendError(
        res,
        ErrorCodes.VALIDATION,
        "permissions array required",
        null,
        400,
      );
    }

    const policy = await Policy.findById(policyId);
    if (!policy) {
      return sendError(
        res,
        ErrorCodes.NOT_FOUND,
        "Policy not found",
        null,
        404,
      );
    }

    const isOwner = policy.createdBy.toString() === req.user.id.toString();
    if (req.user.role !== "admin" && !isOwner) {
      return sendError(
        res,
        ErrorCodes.FORBIDDEN,
        "Only the policy owner or an admin can update permissions",
        null,
        403,
      );
    }

    const associate = await PolicyAssociate.findOne({
      _id: associateId,
      policyId,
    });
    if (!associate) {
      return sendError(
        res,
        ErrorCodes.NOT_FOUND,
        "Associate record not found",
        null,
        404,
      );
    }

    await associate.updatePermissions(permissions, req.user.id);

    await createAuditLog({
      userId: req.user.id,
      userRole: req.user.role,
      action: "UPDATE_ASSOCIATE_PERMISSIONS",
      targetType: "PolicyAssociate",
      targetId: associate._id,
      details: { permissions },
      req,
    });

    await createNotification({
      userId: associate.plannerId,
      type: "ASSOCIATE_PERMISSIONS_UPDATED",
      title: "Permissions Updated",
      message: `Your permissions for policy "${policy.title}" have been updated to: ${formatPermissions(permissions)}.`,
      data: { policyId, permissions },
      severity: "info",
      source: "system",
    });

    return sendSuccess(res, associate, "Permissions updated");
  } catch (err) {
    console.error(err);
    const message = err.message || "Failed to update permissions";
    return sendError(res, ErrorCodes.INTERNAL, message, null, 500);
  }
};

// ========== REVOKE ASSOCIATE (owner or admin) ==========
exports.revokeAssociate = async (req, res) => {
  try {
    const { policyId, associateId } = req.params;
    const policy = await Policy.findById(policyId);
    if (!policy) {
      return sendError(
        res,
        ErrorCodes.NOT_FOUND,
        "Policy not found",
        null,
        404,
      );
    }

    const isOwner = policy.createdBy.toString() === req.user.id.toString();
    if (req.user.role !== "admin" && !isOwner) {
      return sendError(
        res,
        ErrorCodes.FORBIDDEN,
        "Only the policy owner or an admin can revoke associates",
        null,
        403,
      );
    }

    const associate = await PolicyAssociate.findOne({
      _id: associateId,
      policyId,
    });
    if (!associate) {
      return sendError(
        res,
        ErrorCodes.NOT_FOUND,
        "Associate record not found",
        null,
        404,
      );
    }

    const wasPending = associate.invitationStatus === "pending";
    const revocationReason =
      req.user.role === "admin" ? "admin_revoked" : "owner_revoked";
    await associate.revoke(req.user.id, revocationReason);

    await createAuditLog({
      userId: req.user.id,
      userRole: req.user.role,
      action: "REVOKE_ASSOCIATE",
      targetType: "PolicyAssociate",
      targetId: associate._id,
      details: {
        policyId,
        plannerId: associate.plannerId,
        reason: revocationReason,
        wasPending,
      },
      req,
    });

    if (wasPending) {
      await createNotification({
        userId: associate.plannerId,
        type: "ASSOCIATE_INVITATION_CANCELLED",
        title: "Invitation Cancelled",
        message: `Your invitation to become an associate for policy "${policy.title}" has been cancelled by the policy owner.`,
        data: { policyId: policy._id, associateId: associate._id },
        severity: "info",
        source: "system",
      });
    } else {
      await createNotification({
        userId: associate.plannerId,
        type: "ASSOCIATE_REVOKED",
        title: "Associate Role Revoked",
        message: `You have been removed as an associate from policy "${policy.title}".`,
        data: { policyId },
        severity: "info",
        source: "system",
      });
    }

    const successMessage = wasPending
      ? "Invitation cancelled"
      : "Associate revoked successfully";
    return sendSuccess(res, null, successMessage);
  } catch (err) {
    console.error(err);
    return sendError(
      res,
      ErrorCodes.INTERNAL,
      "Failed to revoke associate",
      null,
      500,
    );
  }
};

// ========== ACCEPT INVITATION ==========
exports.acceptAssociateInvitation = async (req, res) => {
  try {
    const { associateId } = req.params;

    const associate = await PolicyAssociate.findOne({
      _id: associateId,
      plannerId: req.user.id,
    }).populate("policyId");

    if (!associate) {
      return sendError(
        res,
        ErrorCodes.NOT_FOUND,
        "Invitation not found",
        null,
        404,
      );
    }

    if (!associate.isPending) {
      let msg = `Invitation cannot be accepted. Current status: ${associate.displayStatus}`;
      if (associate.displayStatus === "expired")
        msg = "This invitation has expired.";
      return sendError(res, ErrorCodes.VALIDATION, msg, null, 400);
    }

    await associate.accept(req.user.id);

    await createAuditLog({
      userId: req.user.id,
      userRole: req.user.role,
      action: "ACCEPT_ASSOCIATE_INVITATION",
      targetType: "PolicyAssociate",
      targetId: associate._id,
      details: { policyId: associate.policyId._id },
      req,
    });

    if (associate.policyId) {
      await createNotification({
        userId: associate.policyId.createdBy,
        type: "ASSOCIATE_ACCEPTED",
        title: "Associate Accepted Invitation",
        message: `${req.user.email} has accepted the invitation for policy "${associate.policyId.title}".`,
        data: { policyId: associate.policyId._id, associateId: associate._id },
        severity: "info",
        source: "system",
      });
    }

    return sendSuccess(
      res,
      null,
      "Invitation accepted. You now have access to the policy.",
    );
  } catch (err) {
    console.error(err);
    return sendError(
      res,
      ErrorCodes.INTERNAL,
      err.message || "Failed to accept invitation",
      null,
      500,
    );
  }
};

// ========== REJECT INVITATION ==========
exports.rejectAssociateInvitation = async (req, res) => {
  try {
    const { associateId } = req.params;
    const { rejectionReason } = req.body;

    const associate = await PolicyAssociate.findOne({
      _id: associateId,
      plannerId: req.user.id,
    }).populate("policyId");

    if (!associate) {
      return sendError(
        res,
        ErrorCodes.NOT_FOUND,
        "Invitation not found",
        null,
        404,
      );
    }

    if (!associate.isPending) {
      return sendError(
        res,
        ErrorCodes.VALIDATION,
        `Invitation cannot be rejected. Current status: ${associate.displayStatus}`,
        null,
        400,
      );
    }

    await associate.reject(req.user.id, rejectionReason || null);

    await createAuditLog({
      userId: req.user.id,
      userRole: req.user.role,
      action: "REJECT_ASSOCIATE_INVITATION",
      targetType: "PolicyAssociate",
      targetId: associate._id,
      details: { policyId: associate.policyId._id, reason: rejectionReason },
      req,
    });

    if (associate.policyId) {
      await createNotification({
        userId: associate.policyId.createdBy,
        type: "ASSOCIATE_REJECTED",
        title: "Associate Rejected Invitation",
        message: `${req.user.email} has declined the invitation for policy "${associate.policyId.title}".`,
        data: { policyId: associate.policyId._id },
        severity: "info",
        source: "system",
      });
    }

    return sendSuccess(res, null, "Invitation rejected.");
  } catch (err) {
    console.error(err);
    return sendError(
      res,
      ErrorCodes.INTERNAL,
      err.message || "Failed to reject invitation",
      null,
      500,
    );
  }
};

// ========== SELF REVOKE (associate leaves) ==========
exports.revokeSelfAsAssociate = async (req, res) => {
  try {
    const { associateId } = req.params;

    const associate = await PolicyAssociate.findOne({
      _id: associateId,
      plannerId: req.user.id,
      invitationStatus: "accepted",
      revokedAt: null,
    }).populate("policyId");

    if (!associate) {
      return sendError(
        res,
        ErrorCodes.NOT_FOUND,
        "Active associate record not found",
        null,
        404,
      );
    }

    await associate.revoke(req.user.id, "self_revoked");

    await createAuditLog({
      userId: req.user.id,
      userRole: req.user.role,
      action: "SELF_REVOKE_ASSOCIATE",
      targetType: "PolicyAssociate",
      targetId: associate._id,
      details: { policyId: associate.policyId._id },
      req,
    });

    if (associate.policyId) {
      await createNotification({
        userId: associate.policyId.createdBy,
        type: "ASSOCIATE_SELF_REVOKED",
        title: "Associate Left",
        message: `${req.user.email} has removed themselves as an associate from policy "${associate.policyId.title}".`,
        data: { policyId: associate.policyId._id },
        severity: "info",
        source: "system",
      });
    }

    return sendSuccess(res, null, "You have been removed as an associate.");
  } catch (err) {
    console.error(err);
    return sendError(
      res,
      ErrorCodes.INTERNAL,
      err.message || "Failed to revoke associate status",
      null,
      500,
    );
  }
};

// ========== GET POLICIES WHERE USER IS AN ACCEPTED ASSOCIATE ==========
exports.getMyAssociatePolicies = async (req, res) => {
  try {
    const associates = await PolicyAssociate.find({
      plannerId: req.user.id,
      invitationStatus: "accepted",
      revokedAt: null,
    })
      .populate(
        "policyId",
        "title policyCode status targetRegions pollType createdAt",
      )
      .populate("assignedBy", "email firstName lastName")
      .sort({ acceptedAt: -1 });

    const policies = associates.map((assoc) => ({
      associateId: assoc._id,
      policy: assoc.policyId,
      permissions: assoc.permissions,
      message: assoc.metadata?.notes || "",
      assignedBy: assoc.assignedBy,
      acceptedAt: assoc.acceptedAt,
    }));

    return sendSuccess(res, policies, "Delegated policies retrieved");
  } catch (err) {
    console.error(err);
    return sendError(
      res,
      ErrorCodes.INTERNAL,
      "Failed to retrieve delegated policies",
      null,
      500,
    );
  }
};

// ========== GET PENDING INVITATIONS FOR CURRENT PLANNER ==========
exports.getPendingInvitations = async (req, res) => {
  try {
    const invitations = await PolicyAssociate.findPendingInvitations(
      req.user.id,
    );
    return sendSuccess(res, invitations, "Pending invitations retrieved");
  } catch (err) {
    console.error(err);
    return sendError(
      res,
      ErrorCodes.INTERNAL,
      "Failed to retrieve pending invitations",
      null,
      500,
    );
  }
};

exports.getInvitationHistory = async (req, res) => {
  try {
    const invitations = await PolicyAssociate.find({ plannerId: req.user.id })
      .populate(
        "policyId",
        "title description policyCode status startDate endDate pollType",
      )
      .populate("assignedBy", "email firstName lastName")
      .sort({ createdAt: -1 });

    const enriched = invitations.map((invitation) => ({
      ...invitation.toObject(),
      displayStatus: invitation.displayStatus,
      daysRemaining: invitation.isPending ? invitation.daysRemaining : null,
    }));

    return sendSuccess(res, enriched, "Invitation history retrieved");
  } catch (err) {
    console.error(err);
    return sendError(
      res,
      ErrorCodes.INTERNAL,
      "Failed to retrieve invitation history",
      null,
      500,
    );
  }
};

// ========== GET SINGLE INVITATION DETAILS (for preview) ==========
exports.getInvitationDetails = async (req, res) => {
  try {
    const { invitationId } = req.params;

    const invitation = await PolicyAssociate.findOne({
      _id: invitationId,
      plannerId: req.user.id,
      invitationStatus: "pending",
      expiresAt: { $gt: new Date() },
    })
      .populate(
        "policyId",
        "title description policyCode status startDate endDate pollType",
      )
      .populate("assignedBy", "email firstName lastName");

    if (!invitation) {
      return sendError(
        res,
        ErrorCodes.NOT_FOUND,
        "Invitation not found, already processed, or expired",
        null,
        404,
      );
    }

    const enriched = {
      ...invitation.toObject(),
      daysRemaining: invitation.daysRemaining,
      isExpired: invitation.isExpired,
    };

    return sendSuccess(res, enriched, "Invitation details retrieved");
  } catch (err) {
    console.error(err);
    return sendError(
      res,
      ErrorCodes.INTERNAL,
      "Failed to retrieve invitation details",
      null,
      500,
    );
  }
};

// ========== SEARCH ACTIVE PLANNERS (for inviting associates) ==========
exports.searchActivePlanners = async (req, res) => {
  try {
    const { search = "", region, language, page = 1, limit = 20 } = req.query;
    const skip = (parseInt(page) - 1) * parseInt(limit);

    const query = {
      role: "planner",
      active: true,
      deletedAt: null,
      _id: { $ne: req.user.id },
    };

    if (search.trim()) {
      query.email = { $regex: search.trim(), $options: "i" };
    }
    if (region && region !== "") {
      query.region = region;
    }
    if (language && language !== "") {
      query.languagesSpoken = language;
    }

    const [planners, total] = await Promise.all([
      User.find(query)
        .select("email firstName lastName region languagesSpoken")
        .skip(skip)
        .limit(parseInt(limit))
        .lean(),
      User.countDocuments(query),
    ]);

    return sendSuccess(
      res,
      {
        planners,
        total,
        page: parseInt(page),
        totalPages: Math.ceil(total / parseInt(limit)),
      },
      "Active planners retrieved",
    );
  } catch (err) {
    console.error(err);
    return sendError(
      res,
      ErrorCodes.INTERNAL,
      "Failed to fetch planners",
      null,
      500,
    );
  }
};
