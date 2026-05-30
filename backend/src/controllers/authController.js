const User = require("../models/User");
const jwt = require("jsonwebtoken");
const crypto = require("crypto");
const client = require("../config/redis");
const logger = require("../utils/logger");
const { createAuditLog } = require("../utils/audit");
const { sendOtpEmail } = require("../utils/email");
const { sendMobilePasswordResetEmail } = require("../utils/mobileEmail");
const {
  hashPassword,
  comparePassword,
  hashPhone,
  generateOTP,
  normalizePhone,
} = require("../utils/helpers");
const {
  sendSuccess,
  sendError,
  ErrorCodes,
} = require("../utils/responseHelper");

// ==================== REGISTRATION & OTP ====================

exports.register = async (req, res) => {
  try {
    const {
      email,
      password,
      phone,
      region,
      ageRange,
      gender,
      occupation,
      education,
    } = req.body;
    if (
      !email ||
      !password ||
      !phone ||
      !region ||
      !ageRange ||
      !gender ||
      !occupation ||
      !education
    ) {
      return sendError(
        res,
        ErrorCodes.VALIDATION,
        "Missing required fields: email, password, phone, region, and all demographics (ageRange, gender, occupation, education) are required",
        {
          required: [
            "email",
            "password",
            "phone",
            "region",
            "ageRange",
            "gender",
            "occupation",
            "education",
          ],
        },
        400,
      );
    }

    // Email format validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return sendError(
        res,
        ErrorCodes.VALIDATION,
        "Invalid email format",
        null,
        400,
      );
    }

    // Ethiopian phone number validation
    const phoneRegex = /^(\+251|0)?[9]\d{8}$/;
    if (!phoneRegex.test(phone)) {
      return sendError(
        res,
        ErrorCodes.VALIDATION,
        "Invalid Ethiopian phone number format. Use +2519XXXXXXXX or 09XXXXXXXX.",
        null,
        400,
      );
    }

    // Password strength
    if (password.length < 8) {
      return sendError(
        res,
        ErrorCodes.VALIDATION,
        "Password must be at least 8 characters long",
        null,
        400,
      );
    }

    // Check for existing user by email
    const existing = await User.findOne({ email });
    if (existing) {
      // If unverified, reset the timer and send a new OTP
      if (!existing.verified) {
        existing.createdAt = new Date();
        await existing.save();

        const otp = generateOTP();
        const otpKey = `otp:email:${email}`;
        await client.setEx(otpKey, 300, otp);
        await sendOtpEmail(email, otp);

        await createAuditLog({
          userId: existing._id,
          userRole: "citizen",
          action: "RESEND_OTP_ON_RE_REGISTER",
          details: { email, phone: normalizePhone(phone) },
          req,
        });

        logger.info(`Re‑registered existing unverified user: ${email}`);
        return sendSuccess(
          res,
          { userId: existing._id },
          "A new OTP has been sent to your email. Please verify within 5 minutes.",
          200,
        );
      } else {
        // Verified user – duplicate
        return sendError(
          res,
          ErrorCodes.DUPLICATE,
          "Email already registered. Please use a different email or log in.",
          null,
          409,
        );
      }
    }

    // Check phone duplicate
    const phoneHash = hashPhone(phone);
    const existingPhone = await User.findOne({ phoneHash });
    if (existingPhone) {
      return sendError(
        res,
        ErrorCodes.DUPLICATE,
        "Phone number already registered. Please use a different number.",
        null,
        409,
      );
    }

    const passwordHash = await hashPassword(password);

    const user = new User({
      email,
      passwordHash,
      phoneHash,
      region,
      ageRange,
      gender,
      occupation,
      education,
      role: "citizen",
      verified: false,
      active: true,
    });
    await user.save();

    const otp = generateOTP();
    console.log(`[DEV] OTP for ${email}: ${otp}`);
    const otpKey = `otp:email:${email}`;
    await client.setEx(otpKey, 300, otp);
    await sendOtpEmail(email, otp);

    await createAuditLog({
      userId: user._id,
      userRole: "citizen",
      action: "REGISTER",
      details: { email, phone: normalizePhone(phone) },
      req,
    });

    logger.info(`User registered: ${email} (${user._id})`);
    return sendSuccess(
      res,
      { userId: user._id },
      "User registered successfully. A 6-digit OTP has been sent to your email for verification.",
      201,
    );
  } catch (err) {
    logger.error(
      { error: err.message, stack: err.stack },
      "Registration error",
    );
    return sendError(
      res,
      ErrorCodes.INTERNAL,
      "Unable to complete registration. Please try again later.",
      null,
      500,
    );
  }
};

exports.sendOtp = async (req, res) => {
  try {
    const { email } = req.body;
    if (!email) {
      return sendError(
        res,
        ErrorCodes.VALIDATION,
        "Email is required",
        null,
        400,
      );
    }

    const user = await User.findOne({ email });
    if (!user) {
      logger.warn(`OTP requested for non-existent email: ${email}`);
      return sendError(
        res,
        ErrorCodes.NOT_FOUND,
        "No account found with this email address.",
        null,
        404,
      );
    }

    const otp = generateOTP();
    console.log(`[DEV] OTP for ${email}: ${otp}`);
    const otpKey = `otp:email:${email}`;
    await client.setEx(otpKey, 300, otp);

    await sendOtpEmail(email, otp);

    // AUDIT LOG – ADD THIS
    await createAuditLog({
      userId: user._id,
      userRole: user.role,
      action: "SEND_OTP",
      details: { email: user.email },
      req,
    });

    logger.info(`OTP sent to email: ${email}`);
    if (process.env.NODE_ENV !== "production") {
      logger.debug(`[DEV] OTP for ${email}: ${otp}`);
    }
    return sendSuccess(
      res,
      null,
      "OTP sent successfully. It expires in 5 minutes.",
    );
  } catch (err) {
    logger.error({ error: err.message, stack: err.stack }, "Send OTP error");
    return sendError(
      res,
      ErrorCodes.INTERNAL,
      "Failed to send OTP. Please try again.",
      null,
      500,
    );
  }
};
exports.verifyOtp = async (req, res) => {
  try {
    const { email, code } = req.body;
    if (!email || !code) {
      return sendError(
        res,
        ErrorCodes.VALIDATION,
        "Email and verification code are required",
        null,
        400,
      );
    }

    const otpKey = `otp:email:${email}`;
    const stored = await client.get(otpKey);
    if (!stored || stored !== code) {
      logger.warn(`Failed OTP verification for ${email}`);
      return sendError(
        res,
        ErrorCodes.VALIDATION,
        "Invalid or expired OTP. Please request a new one.",
        null,
        400,
      );
    }

    await client.del(otpKey);

    const user = await User.findOne({ email });
    if (!user) {
      return sendError(
        res,
        ErrorCodes.NOT_FOUND,
        "No account found with this email address.",
        null,
        404,
      );
    }

    user.verified = true;
    await user.save();

    await createAuditLog({
      userId: user._id,
      userRole: user.role,
      action: "VERIFY_OTP",
      details: { email },
      req,
    });

    logger.info(`User verified: ${user.email} (${user._id})`);

    // Role-based JWT expiry
    let expiresIn;
    if (user.role === "admin") expiresIn = "6h";
    else if (user.role === "planner" || user.role === "comment_moderator") {
      expiresIn = "12h";
    }
    else expiresIn = "7d";

    const token = jwt.sign(
      {
        id: user._id,
        role: user.role,
        region: user.region,
        verified: user.verified,
      },
      process.env.JWT_SECRET,
      { expiresIn },
    );

    return sendSuccess(
      res,
      { token, role: user.role, userId: user._id },
      "Email verified successfully. You can now log in.",
    );
  } catch (err) {
    logger.error(
      { error: err.message, stack: err.stack },
      "OTP verification error",
    );
    return sendError(
      res,
      ErrorCodes.INTERNAL,
      "Verification failed. Please try again.",
      null,
      500,
    );
  }
};

exports.login = async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      return sendError(
        res,
        ErrorCodes.VALIDATION,
        "Email and password are required",
        null,
        400,
      );
    }

    // Prevent NoSQL injection – reject non‑string inputs
    if (typeof email !== "string" || typeof password !== "string") {
      return sendError(
        res,
        ErrorCodes.VALIDATION,
        "Invalid input format. Email and password must be strings.",
        null,
        400,
      );
    }

    const user = await User.findOne({ email });
    if (!user) {
      logger.warn(`Failed login attempt for non-existent email: ${email}`);
      return sendError(
        res,
        ErrorCodes.INVALID_CREDENTIALS,
        "Invalid email or password.",
        null,
        401,
      );
    }

    if (!user.active) {
      logger.warn(`Login attempt for deactivated account: ${email}`);
      return sendError(
        res,
        ErrorCodes.ACCOUNT_DISABLED,
        "Your account has been deactivated. Please contact an administrator.",
        null,
        403,
      );
    }
    if (!user.verified) {
      logger.warn(`Login attempt for unverified account: ${email}`);
      return sendError(
        res,
        ErrorCodes.NOT_VERIFIED,
        "Your email address is not verified. Please complete OTP verification first.",
        null,
        403,
      );
    }

    const valid = await comparePassword(password, user.passwordHash);
    if (!valid) {
      logger.warn(`Failed login attempt for ${email} – wrong password`);
      return sendError(
        res,
        ErrorCodes.INVALID_CREDENTIALS,
        "Invalid email or password.",
        null,
        401,
      );
    }

    // Role-based JWT expiry
    let expiresIn;
    if (user.role === "admin") expiresIn = "6h";
    else if (user.role === "planner" || user.role === "comment_moderator") {
      expiresIn = "12h";
    }
    else expiresIn = "7d";

    const token = jwt.sign(
      {
        id: user._id,
        role: user.role,
        region: user.region,
        verified: user.verified,
      },
      process.env.JWT_SECRET,
      { expiresIn },
    );

    await createAuditLog({
      userId: user._id,
      userRole: user.role,
      action: "LOGIN",
      details: { email: user.email },
      req,
    });

    logger.info(`User logged in: ${email} (${user._id})`);
    return sendSuccess(
      res,
      { token, role: user.role, userId: user._id },
      "Login successful.",
    );
  } catch (err) {
    console.error("=== LOGIN ERROR ===");
    console.error("Error name:", err.name);
    console.error("Error message:", err.message);
    console.error("Error stack:", err.stack);
    console.error("Request body:", JSON.stringify(req.body, null, 2));
    logger.error({ error: err.message, stack: err.stack }, "Login error");
    return sendError(
      res,
      ErrorCodes.INTERNAL,
      "Login failed. Please try again later.",
      null,
      500,
    );
  }
};

// ==================== PASSWORD RESET ====================

exports.forgotPassword = async (req, res) => {
  try {
    const { email } = req.body;
    if (!email) {
      return sendError(
        res,
        ErrorCodes.VALIDATION,
        "Email is required",
        null,
        400,
      );
    }

    const rateKey = `reset:rate:${email}`;
    const attempts = await client.get(rateKey);
    if (attempts && parseInt(attempts) >= 3) {
      logger.warn(`Password reset rate limit exceeded for ${email}`);
      return sendError(
        res,
        ErrorCodes.RATE_LIMIT,
        "Too many password reset requests. Please try again later.",
        null,
        429,
      );
    }

    const user = await User.findOne({ email });
    if (!user) {
      logger.warn(`Password reset requested for non-existent email: ${email}`);
      return sendSuccess(
        res,
        null,
        "If an account with that email exists, a password reset link has been sent.",
        200,
      );
    }

    const token = crypto.randomBytes(32).toString("hex");
    const tokenKey = `reset:token:${token}`;
    await client.setEx(tokenKey, 3600, user._id.toString());

    await client.incr(rateKey);
    await client.expire(rateKey, 3600);

    await sendMobilePasswordResetEmail(email, token);
    logger.info(`Password reset email sent to ${email}`);

    // Audit log for password reset request - ADDED BACK
    await createAuditLog({
      userId: user._id,
      userRole: user.role,
      action: "REQUEST_PASSWORD_RESET",
      details: { email: user.email },
      req,
    });

    return sendSuccess(
      res,
      null,
      "If an account with that email exists, a password reset link has been sent.",
      200,
    );
  } catch (err) {
    logger.error(
      { error: err.message, stack: err.stack },
      "Forgot password error",
    );
    return sendError(
      res,
      ErrorCodes.INTERNAL,
      "Failed to process password reset request",
      null,
      500,
    );
  }
};

exports.resetPassword = async (req, res) => {
  try {
    const { token, newPassword } = req.body;
    if (!token || !newPassword) {
      return sendError(
        res,
        ErrorCodes.VALIDATION,
        "Token and new password are required",
        null,
        400,
      );
    }

    if (newPassword.length < 8) {
      return sendError(
        res,
        ErrorCodes.VALIDATION,
        "Password must be at least 8 characters long",
        null,
        400,
      );
    }

    const tokenKey = `reset:token:${token}`;
    const userId = await client.get(tokenKey);
    if (!userId) {
      logger.warn(`Invalid or expired password reset token used`);
      return sendError(
        res,
        ErrorCodes.VALIDATION,
        "Invalid or expired reset token. Please request a new one.",
        null,
        400,
      );
    }

    const user = await User.findById(userId);
    if (!user) {
      return sendError(res, ErrorCodes.NOT_FOUND, "User not found", null, 404);
    }

    const isSame = await comparePassword(newPassword, user.passwordHash);
    if (isSame) {
      return sendError(
        res,
        ErrorCodes.VALIDATION,
        "New password must be different from current password",
        null,
        400,
      );
    }

    user.passwordHash = await hashPassword(newPassword);
    await user.save();

    await client.del(tokenKey);

    await createAuditLog({
      userId: user._id,
      userRole: user.role,
      action: "PASSWORD_RESET",
      details: { method: "token" },
      req,
    });

    logger.info(`Password reset successful for ${user.email}`);
    return sendSuccess(
      res,
      null,
      "Password has been reset successfully. You can now log in with your new password.",
    );
  } catch (err) {
    logger.error(
      { error: err.message, stack: err.stack },
      "Reset password error",
    );
    return sendError(
      res,
      ErrorCodes.INTERNAL,
      "Failed to reset password",
      null,
      500,
    );
  }
};
