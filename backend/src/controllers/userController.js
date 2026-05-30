const User = require("../models/User");
const Vote = require("../models/Vote");
const Comment = require("../models/Comment");
const Notification = require("../models/Notification");
const Message = require("../models/Message");
const PlannerRequest = require("../models/PlannerRequest");
const client = require("../config/redis");
const {
  hashPassword,
  comparePassword,
  generateOTP,
  hashPhone,
} = require("../utils/helpers");
const logger = require("../utils/logger");
const { createAuditLog } = require("../utils/audit");
const { sendEmail, sendOtpEmail } = require("../utils/email");
const {
  sendSuccess,
  sendError,
  ErrorCodes,
} = require("../utils/responseHelper");

// GET /users/me
exports.getMe = async (req, res) => {
  try {
    const user = await User.findById(req.user.id).select(
      "-passwordHash -phoneHash",
    );
    if (!user) {
      return sendError(res, ErrorCodes.NOT_FOUND, "User not found", null, 404);
    }
    logger.info(`User ${req.user.id} retrieved their profile`);
    return sendSuccess(res, user, "User profile retrieved successfully");
  } catch (err) {
    logger.error({ error: err.message, stack: err.stack }, "Get user error");
    return sendError(
      res,
      ErrorCodes.INTERNAL,
      "Failed to retrieve user profile",
      null,
      500,
    );
  }
};

// PUT /users/me – allows updating region and preferredLanguage
exports.updateMe = async (req, res) => {
  try {
    const { region, preferredLanguage } = req.body;
    const updates = {};
    if (region) updates.region = region;
    if (preferredLanguage) updates.preferredLanguage = preferredLanguage;

    if (Object.keys(updates).length === 0) {
      return sendError(
        res,
        ErrorCodes.VALIDATION,
        "No valid fields provided for update (only region and preferredLanguage are allowed)",
        null,
        400,
      );
    }

    const user = await User.findByIdAndUpdate(req.user.id, updates, {
      new: true,
    }).select("-passwordHash -phoneHash");
    if (!user) {
      return sendError(res, ErrorCodes.NOT_FOUND, "User not found", null, 404);
    }

    await createAuditLog({
      userId: req.user.id,
      userRole: user.role,
      action: "UPDATE_PROFILE",
      details: { updatedFields: Object.keys(updates) },
      req,
    });

    logger.info(
      `User ${req.user.id} updated profile: ${Object.keys(updates).join(", ")}`,
    );
    return sendSuccess(res, user, "User profile updated successfully");
  } catch (err) {
    logger.error({ error: err.message, stack: err.stack }, "Update user error");
    return sendError(
      res,
      ErrorCodes.INTERNAL,
      "Failed to update user profile",
      null,
      500,
    );
  }
};

// PUT /users/me/password
exports.changePassword = async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;
    if (!currentPassword || !newPassword) {
      return sendError(
        res,
        ErrorCodes.VALIDATION,
        "Current password and new password are required",
        null,
        400,
      );
    }

    const user = await User.findById(req.user.id);
    if (!user) {
      return sendError(res, ErrorCodes.NOT_FOUND, "User not found", null, 404);
    }

    const valid = await comparePassword(currentPassword, user.passwordHash);
    if (!valid) {
      logger.warn(
        `User ${req.user.id} attempted password change with incorrect current password`,
      );
      return sendError(
        res,
        ErrorCodes.INVALID_CREDENTIALS,
        "Current password is incorrect",
        null,
        401,
      );
    }

    const passwordHash = await hashPassword(newPassword);
    await User.updateOne(
      { _id: user._id },
      { $set: { passwordHash } },
      { runValidators: false },
    );

    await createAuditLog({
      userId: req.user.id,
      userRole: user.role,
      action: "CHANGE_PASSWORD",
      details: {},
      req,
    });

    logger.info(`User ${req.user.id} changed password`);
    return sendSuccess(res, null, "Password changed successfully");
  } catch (err) {
    logger.error(
      { error: err.message, stack: err.stack },
      "Change password error",
    );
    return sendError(
      res,
      ErrorCodes.INTERNAL,
      "Failed to change password",
      null,
      500,
    );
  }
};

// GET /users/me/history
exports.getHistory = async (req, res) => {
  try {
    const votes = await Vote.find({ userId: req.user.id })
      .populate("policyId", "title policyCode pollType")
      .sort({ createdAt: -1 })
      .lean();

    const formatted = [];
    for (const vote of votes) {
      const comment = await Comment.findOne({ voteId: vote._id }).lean();
      formatted.push({
        id: vote._id,
        policy: vote.policyId
          ? {
              id: vote.policyId._id,
              title: vote.policyId.title,
              policyCode: vote.policyId.policyCode,
              pollType: vote.policyId.pollType,
            }
          : null,
        value: vote.value,
        comment: comment?.text || null,
        channel: vote.channel,
        sentiment: comment?.sentiment?.label || null,
        createdAt: vote.createdAt,
      });
    }

    logger.info(
      `User ${req.user.id} retrieved history (${formatted.length} items)`,
    );
    return sendSuccess(
      res,
      { history: formatted },
      "User history retrieved successfully",
    );
  } catch (err) {
    logger.error({ error: err.message, stack: err.stack }, "Get history error");
    return sendError(
      res,
      ErrorCodes.INTERNAL,
      "Failed to retrieve history",
      null,
      500,
    );
  }
};

// DELETE /users/me – GDPR compliant anonymisation
exports.deleteMe = async (req, res) => {
  try {
    const userId = req.user.id;
    const user = await User.findById(userId);
    if (!user) {
      return sendError(res, ErrorCodes.NOT_FOUND, "User not found", null, 404);
    }

    const originalEmail = user.email;

    // Anonymise profile
    user.email = `deleted_${Date.now()}_${user._id}@anonymised.com`;
    user.region = "Addis Ababa";
    user.ageRange = "18-24";
    user.gender = "prefer-not-to-say";
    user.occupation = "other";
    user.education = "no-formal";
    user.phoneHash = null;
    user.active = false;
    user.tokenVersion += 1;
    await user.save();

    // Unlink votes and comments
    await Vote.updateMany({ userId: userId }, { $set: { userId: null } });
    await Comment.updateMany({ userId: userId }, { $set: { userId: null } });

    // Delete notifications and messages
    await Notification.deleteMany({ userId: userId });
    try {
      const Message = require("../models/Message");
      await Message.deleteMany({
        $or: [{ senderId: userId }, { recipientId: userId }],
      });
    } catch (msgErr) {
      logger.info("Message model not loaded; skipping message deletion");
    }

    await createAuditLog({
      userId: userId,
      userRole: user.role,
      action: "DELETE_ACCOUNT",
      details: { email: originalEmail },
      req,
    });

    // Send deletion confirmation email
    await sendEmail({
      to: originalEmail,
      subject: "Account Deleted – Civic Engagement Platform",
      html: `<p>Your account has been successfully deleted and all personal data anonymised.</p>
             <p>If you did not request this, please contact support immediately.</p>`,
    });

    logger.info(`User ${userId} (${originalEmail}) deleted their account`);
    return sendSuccess(
      res,
      null,
      "Account deleted successfully. Your data has been anonymized.",
    );
  } catch (err) {
    console.error("=== DELETE ACCOUNT ERROR ===");
    console.error(err);
    logger.error(
      { error: err.message, stack: err.stack },
      "Delete account error",
    );
    return sendError(
      res,
      ErrorCodes.INTERNAL,
      err.message || "Failed to delete account",
      null,
      500,
    );
  }
};

// GET /users/me/export – GDPR data portability
exports.exportMe = async (req, res) => {
  try {
    const userId = req.user.id;
    const { startDate, endDate } = req.query;

    let start = startDate ? new Date(startDate) : null;
    let end = endDate ? new Date(endDate) : null;
    if (start && isNaN(start.getTime())) start = null;
    if (end && isNaN(end.getTime())) end = null;
    if (start && end && start > end) {
      return sendError(
        res,
        ErrorCodes.VALIDATION,
        "startDate must be before endDate",
        null,
        400,
      );
    }

    const dateFilter = {};
    if (start) dateFilter.$gte = start;
    if (end) dateFilter.$lte = end;

    const voteFilter = { userId: userId };
    const commentFilter = { userId: userId };
    const notificationFilter = { userId: userId };
    const messageFilter = {
      $or: [{ senderId: userId }, { recipientId: userId }],
    };
    if (Object.keys(dateFilter).length) {
      voteFilter.createdAt = dateFilter;
      commentFilter.createdAt = dateFilter;
      notificationFilter.createdAt = dateFilter;
      messageFilter.createdAt = dateFilter;
    }

    const user = await User.findById(userId).select(
      "-passwordHash -phoneHash -tokenVersion",
    );
    if (!user) {
      return sendError(res, ErrorCodes.NOT_FOUND, "User not found", null, 404);
    }

    const [votes, comments, notifications, messages, plannerRequests] =
      await Promise.all([
        Vote.find(voteFilter).populate("policyId", "title policyCode").lean(),
        Comment.find(commentFilter).lean(),
        Notification.find(notificationFilter).lean(),
        Message.find(messageFilter).lean(),
        PlannerRequest.find({ userId: userId }).lean(),
      ]);

    const exportData = {
      profile: {
        email: user.email,
        region: user.region,
        ageRange: user.ageRange,
        gender: user.gender,
        occupation: user.occupation,
        education: user.education,
        preferredLanguage: user.preferredLanguage,
        createdAt: user.createdAt,
      },
      votes: votes.map((v) => ({
        policyId: v.policyId?._id || v.policyId,
        policyTitle: v.policyId?.title,
        policyCode: v.policyId?.policyCode,
        value: v.value,
        channel: v.channel,
        createdAt: v.createdAt,
      })),
      comments: comments.map((c) => ({
        text: c.text,
        sentiment: c.sentiment,
        keywords: c.keywords,
        createdAt: c.createdAt,
      })),
      notifications: notifications.map((n) => ({
        type: n.type,
        title: n.title,
        message: n.message,
        read: n.read,
        createdAt: n.createdAt,
      })),
      messages: messages.map((m) => ({
        direction: m.senderId.toString() === userId ? "sent" : "received",
        subject: m.subject,
        body: m.body,
        read: m.read,
        createdAt: m.createdAt,
      })),
      plannerRequests: plannerRequests.map((r) => ({
        organization: r.organization,
        reason: r.reason,
        status: r.status,
        createdAt: r.createdAt,
        reviewedAt: r.reviewedAt,
        rejectionReason: r.rejectionReason,
      })),
    };

    // Audit log for data export
    await createAuditLog({
      userId: user._id,
      userRole: user.role,
      action: "EXPORT_DATA",
      details: { startDate, endDate },
      req,
    });

    logger.info(
      `User ${userId} exported their data with filters start=${startDate} end=${endDate}`,
    );
    res.setHeader("Content-Type", "application/json");
    res.setHeader(
      "Content-Disposition",
      `attachment; filename="user-data-${Date.now()}.json"`,
    );
    return res.send(JSON.stringify(exportData, null, 2));
  } catch (err) {
    logger.error(
      { error: err.message, stack: err.stack },
      "Export user data error",
    );
    return sendError(
      res,
      ErrorCodes.INTERNAL,
      "Failed to export user data",
      null,
      500,
    );
  }
};

// ==================== EMAIL CHANGE ====================

exports.requestEmailChange = async (req, res) => {
  try {
    const { newEmail } = req.body;
    const userId = req.user.id;

    if (!newEmail) {
      return sendError(
        res,
        ErrorCodes.VALIDATION,
        "New email is required",
        null,
        400,
      );
    }

    const user = await User.findById(userId);
    if (!user) {
      return sendError(res, ErrorCodes.NOT_FOUND, "User not found", null, 404);
    }
    const oldEmail = user.email;

    const existing = await User.findOne({ email: newEmail });
    if (existing && existing._id.toString() !== userId) {
      return sendError(
        res,
        ErrorCodes.DUPLICATE,
        "Email already in use by another account",
        null,
        409,
      );
    }

    // Rate limit (3 per hour)
    const rateKey = `email_change:rate:${userId}`;
    const rateAttempts = await client.incr(rateKey);
    if (rateAttempts === 1) await client.expire(rateKey, 3600);
    if (rateAttempts > 3) {
      logger.warn(`Email change rate limit exceeded for user ${userId}`);
      return sendError(
        res,
        ErrorCodes.RATE_LIMIT,
        "Too many email change requests. Please try again later.",
        null,
        429,
      );
    }

    const otp = generateOTP();
    const otpKey = `email_change:otp:${userId}`;
    await client.setEx(otpKey, 300, JSON.stringify({ otp, newEmail }));

    await sendOtpEmail(newEmail, otp);

    // Send security alert to old email
    await sendEmail(
      oldEmail,
      "Security Alert: Email change requested",
      `We received a request to change your email address from ${oldEmail} to ${newEmail}. If you did not make this request, please contact support immediately. No changes have been made yet.`,
      `<p>We received a request to change your email address from <strong>${oldEmail}</strong> to <strong>${newEmail}</strong>.</p>
       <p>If you did not make this request, please contact support immediately.</p>
       <p>No changes have been made yet.</p>`,
    );

    // Audit log for request
    await createAuditLog({
      userId: user._id,
      userRole: user.role,
      action: "REQUEST_EMAIL_CHANGE",
      details: { oldEmail, newEmail },
      req,
    });

    logger.info(`Email change OTP sent to ${newEmail} for user ${userId}`);
    return sendSuccess(
      res,
      null,
      "Verification code sent to the new email address. It expires in 5 minutes. A security alert was also sent to your original email.",
      200,
    );
  } catch (err) {
    logger.error(
      { error: err.message, stack: err.stack },
      "Request email change error",
    );
    return sendError(
      res,
      ErrorCodes.INTERNAL,
      "Failed to request email change",
      null,
      500,
    );
  }
};

exports.verifyEmailChange = async (req, res) => {
  try {
    const { code } = req.body;
    const userId = req.user.id;

    if (!code) {
      return sendError(
        res,
        ErrorCodes.VALIDATION,
        "Verification code is required",
        null,
        400,
      );
    }

    // Rate limit for verification attempts (5 per 15 minutes)
    const verifyRateKey = `email_change:verify_rate:${userId}`;
    const verifyAttempts = await client.incr(verifyRateKey);
    if (verifyAttempts === 1) await client.expire(verifyRateKey, 900);
    if (verifyAttempts > 5) {
      logger.warn(`Email change OTP brute force attempt for user ${userId}`);
      return sendError(
        res,
        ErrorCodes.RATE_LIMIT,
        "Too many verification attempts. Please request a new code.",
        null,
        429,
      );
    }

    const otpKey = `email_change:otp:${userId}`;
    const data = await client.get(otpKey);
    if (!data) {
      return sendError(
        res,
        ErrorCodes.VALIDATION,
        "No pending email change request or code expired. Please request a new one.",
        null,
        400,
      );
    }

    const { otp, newEmail } = JSON.parse(data);
    if (otp !== code) {
      logger.warn(`Invalid email change OTP for user ${userId}`);
      return sendError(
        res,
        ErrorCodes.VALIDATION,
        "Invalid verification code",
        null,
        400,
      );
    }

    const user = await User.findById(userId);
    if (!user) {
      return sendError(res, ErrorCodes.NOT_FOUND, "User not found", null, 404);
    }

    const oldEmail = user.email;
    user.email = newEmail;
    await user.save();

    await client.del(otpKey);
    await client.del(verifyRateKey);

    await createAuditLog({
      userId: user._id,
      userRole: user.role,
      action: "CHANGE_EMAIL",
      details: { oldEmail, newEmail },
      req,
    });

    logger.info(`User ${userId} changed email from ${oldEmail} to ${newEmail}`);
    return sendSuccess(res, null, "Email address updated successfully.", 200);
  } catch (err) {
    logger.error(
      { error: err.message, stack: err.stack },
      "Verify email change error",
    );
    return sendError(
      res,
      ErrorCodes.INTERNAL,
      "Failed to verify email change",
      null,
      500,
    );
  }
};

// ==================== PHONE NUMBER CHANGE ====================

exports.requestPhoneChange = async (req, res) => {
  try {
    const { newPhone } = req.body;
    if (!newPhone) {
      return sendError(
        res,
        ErrorCodes.VALIDATION,
        "New phone number required",
        null,
        400,
      );
    }

    const user = await User.findById(req.user.id);
    if (!user) {
      return sendError(res, ErrorCodes.NOT_FOUND, "User not found", null, 404);
    }

    // Rate limit (3 per hour)
    const rateKey = `phone_change:rate:${req.user.id}`;
    const attempts = await client.incr(rateKey);
    if (attempts === 1) await client.expire(rateKey, 3600);
    if (attempts > 3) {
      logger.warn(`Phone change rate limit exceeded for user ${req.user.id}`);
      return sendError(
        res,
        ErrorCodes.RATE_LIMIT,
        "Too many phone change requests. Please try again later.",
        null,
        429,
      );
    }

    const existing = await User.findOne({ phoneHash: hashPhone(newPhone) });
    if (existing && existing._id.toString() !== user._id.toString()) {
      return sendError(
        res,
        ErrorCodes.DUPLICATE,
        "Phone number already in use",
        null,
        409,
      );
    }

    const otp = generateOTP();
    const key = `phone_change:otp:${req.user.id}:${newPhone}`;
    await client.setEx(key, 300, otp);

    // Mock SMS
    logger.info(`[MOCK SMS] Phone change OTP for ${newPhone}: ${otp}`);

    // Audit log for request
    await createAuditLog({
      userId: user._id,
      userRole: user.role,
      action: "REQUEST_PHONE_CHANGE",
      details: { newPhone },
      req,
    });

    return sendSuccess(
      res,
      null,
      "OTP sent to new phone number. It expires in 5 minutes.",
    );
  } catch (err) {
    logger.error(err);
    return sendError(
      res,
      ErrorCodes.INTERNAL,
      "Failed to request phone change",
      null,
      500,
    );
  }
};

exports.verifyPhoneChange = async (req, res) => {
  try {
    const { newPhone, otp } = req.body;
    if (!newPhone || !otp) {
      return sendError(
        res,
        ErrorCodes.VALIDATION,
        "New phone and OTP required",
        null,
        400,
      );
    }

    // Rate limit for verification attempts (5 per 15 minutes)
    const verifyRateKey = `phone_change:verify_rate:${req.user.id}`;
    const verifyAttempts = await client.incr(verifyRateKey);
    if (verifyAttempts === 1) await client.expire(verifyRateKey, 900);
    if (verifyAttempts > 5) {
      logger.warn(
        `Phone change OTP brute force attempt for user ${req.user.id}`,
      );
      return sendError(
        res,
        ErrorCodes.RATE_LIMIT,
        "Too many verification attempts. Please request a new OTP.",
        null,
        429,
      );
    }

    const key = `phone_change:otp:${req.user.id}:${newPhone}`;
    const stored = await client.get(key);
    if (!stored || stored !== otp) {
      return sendError(
        res,
        ErrorCodes.VALIDATION,
        "Invalid or expired OTP",
        null,
        400,
      );
    }

    const user = await User.findById(req.user.id);
    if (!user) {
      return sendError(res, ErrorCodes.NOT_FOUND, "User not found", null, 404);
    }

    const newPhoneHash = hashPhone(newPhone);
    user.phoneHash = newPhoneHash;
    user.tokenVersion += 1;
    await user.save();

    await client.del(key);
    await client.del(verifyRateKey);

    await createAuditLog({
      userId: user._id,
      userRole: user.role,
      action: "PHONE_CHANGE",
      details: { newPhoneHash },
      req,
    });

    return sendSuccess(
      res,
      null,
      "Phone number updated successfully. Please log in again.",
    );
  } catch (err) {
    logger.error(err);
    return sendError(
      res,
      ErrorCodes.INTERNAL,
      "Failed to verify phone change",
      null,
      500,
    );
  }
};

// ==================== NOTIFICATIONS ====================

exports.getNotifications = async (req, res) => {
  try {
    const { page = 1, limit = 20, unreadOnly = false } = req.query;
    const filter = { userId: req.user.id };
    if (unreadOnly === "true") filter.read = false;

    const skip = (page - 1) * limit;
    const [notifications, total] = await Promise.all([
      Notification.find(filter)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(Number(limit))
        .lean(),
      Notification.countDocuments(filter),
    ]);

    logger.info(
      `User ${req.user.id} retrieved notifications (page ${page}, total ${total})`,
    );
    return sendSuccess(
      res,
      { notifications, total, page: Number(page) },
      "Notifications retrieved successfully",
    );
  } catch (err) {
    logger.error(
      { error: err.message, stack: err.stack },
      "Get notifications error",
    );
    return sendError(
      res,
      ErrorCodes.INTERNAL,
      "Failed to retrieve notifications",
      null,
      500,
    );
  }
};

exports.markNotificationRead = async (req, res) => {
  try {
    const notification = await Notification.findOneAndUpdate(
      { _id: req.params.id, userId: req.user.id },
      { read: true },
      { new: true },
    );
    if (!notification) {
      return sendError(
        res,
        ErrorCodes.NOT_FOUND,
        "Notification not found",
        null,
        404,
      );
    }

    logger.info(
      `User ${req.user.id} marked notification ${req.params.id} as read`,
    );
    return sendSuccess(res, notification, "Notification marked as read");
  } catch (err) {
    logger.error(
      { error: err.message, stack: err.stack },
      "Mark notification read error",
    );
    return sendError(
      res,
      ErrorCodes.INTERNAL,
      "Failed to mark notification as read",
      null,
      500,
    );
  }
};

exports.markAllNotificationsRead = async (req, res) => {
  try {
    const result = await Notification.updateMany(
      { userId: req.user.id, read: false },
      { read: true },
    );

    logger.info(
      `User ${req.user.id} marked all notifications as read (${result.modifiedCount} updated)`,
    );
    return sendSuccess(
      res,
      { modifiedCount: result.modifiedCount },
      "All notifications marked as read",
    );
  } catch (err) {
    logger.error(
      { error: err.message, stack: err.stack },
      "Mark all notifications read error",
    );
    return sendError(
      res,
      ErrorCodes.INTERNAL,
      "Failed to mark notifications as read",
      null,
      500,
    );
  }
};
