const nodemailer = require("nodemailer");
const logger = require("./logger");

let transporter = null;
let mockMode = false;
let mockReason = null;

const getTransporter = () => {
  if (mockMode) return null;
  if (!transporter) {
    const host = process.env.EMAIL_HOST;
    const user = process.env.EMAIL_USER;
    const pass = process.env.EMAIL_PASS;
    const port = parseInt(process.env.EMAIL_PORT || "587");

    if (!host || !user || !pass) {
      mockMode = true;
      mockReason =
        "Missing SMTP credentials (EMAIL_HOST/EMAIL_USER/EMAIL_PASS)";
      logger.warn(`Email: ${mockReason}. Switching to mock mode.`);
      return null;
    }

    transporter = nodemailer.createTransport({
      host,
      port,
      secure: port === 465,
      auth: { user, pass },
    });

    // Verify connection (optional, but catches errors early)
    transporter.verify((error) => {
      if (error) {
        mockMode = true;
        mockReason = `SMTP connection failed: ${error.message}`;
        logger.warn(`Email: ${mockReason}. Switching to mock mode.`);
        transporter = null;
      } else {
        logger.info("SMTP configured and ready.");
      }
    });
  }
  return transporter;
};

/**
 * Send an email.
 * Usage: sendEmail(to, subject, text, html)
 *    or: sendEmail({ to, subject, text, html })
 */
const sendEmail = async (to, subject, text, html) => {
  // Normalize params
  if (typeof to === "object") {
    const obj = to;
    to = obj.to;
    subject = obj.subject;
    text = obj.text;
    html = obj.html;
  }

  if (!to) {
    logger.error("sendEmail called without recipient (to field missing)");
    return;
  }

  // If in mock mode, just log
  if (mockMode) {
    logger.info(
      `[MOCK EMAIL] To: ${to}, Subject: ${subject}, Body: ${text || (html ? html.replace(/<[^>]*>/g, "").slice(0, 200) : "(empty)")}`,
    );
    return;
  }

  const transporter = getTransporter();
  if (!transporter) {
    // Fallback to mock if transporter not available
    logger.info(`[MOCK EMAIL (fallback)] To: ${to}, Subject: ${subject}`);
    return;
  }

  try {
    await transporter.sendMail({
      from: process.env.EMAIL_USER,
      to,
      subject,
      text,
      html,
    });
    logger.info(`Email sent to ${to} (${subject})`);
  } catch (err) {
    logger.error(`Failed to send email to ${to}: ${err.message}`);
    // Fallback to mock on error
    logger.info(`[MOCK EMAIL (error fallback)] To: ${to}, Subject: ${subject}`);
  }
};

// Convenience wrappers
const sendOtpEmail = async (to, otp) => {
  await sendEmail(
    to,
    "Your OTP Code - Civic Engagement Platform",
    `Your verification code is: ${otp}\nIt expires in 5 minutes.`,
    `<p>Your verification code is: <strong>${otp}</strong></p><p>It expires in 5 minutes.</p>`,
  );
};

const sendPasswordResetEmail = async (to, token) => {
  const frontendUrl = (process.env.FRONTEND_URL || "http://localhost:3000").replace(/\/$/, "");
  const resetLink = `${frontendUrl}/reset-password?token=${token}`;
  await sendEmail(
    to,
    "Password Reset Request - Civic Engagement Platform",
    `You requested a password reset. Click the link below to set a new password (valid for 1 hour):\n\n${resetLink}\n\nIf you didn't request this, please ignore this email.`,
    `<p>You requested a password reset. Click the link below to set a new password (valid for 1 hour):</p>
     <p><a href="${resetLink}">${resetLink}</a></p>
     <p>If you didn't request this, please ignore this email.</p>`,
  );
};

const sendAdminInitiatedResetEmail = async (to, token) => {
  const frontendUrl = (process.env.FRONTEND_URL || "http://localhost:3000").replace(/\/$/, "");
  const resetLink = `${frontendUrl}/reset-password?token=${token}`;
  await sendEmail(
    to,
    "Password Reset Initiated by Administrator",
    `An administrator has initiated a password reset for your account. Click the link below to set a new password (valid for 1 hour):\n\n${resetLink}\n\nIf you did not request this, please contact support.`,
    `<p>An administrator has initiated a password reset for your account. Click the link below to set a new password (valid for 1 hour):</p>
     <p><a href="${resetLink}">${resetLink}</a></p>
     <p>If you did not request this, please contact support.</p>`,
  );
};

const sendPlannerPasswordSetupEmail = async (to, token) => {
  const frontendUrl = (process.env.FRONTEND_URL || "http://localhost:3000").replace(/\/$/, "");
  const setupLink = `${frontendUrl}/reset-password?token=${token}`;
  await sendEmail(
    to,
    "Planner Account Created - Set Your Password",
    `A planner account has been created for you. Click the link below to create your password (valid for 24 hours):\n\n${setupLink}\n\nIf you were not expecting this invitation, please contact support.`,
    `<p>A planner account has been created for you.</p>
     <p>Click the link below to create your password (valid for 24 hours):</p>
     <p><a href="${setupLink}">${setupLink}</a></p>
     <p>If you were not expecting this invitation, please contact support.</p>`,
  );
};

const sendRolePasswordSetupEmail = async (to, token, roleLabel) => {
  const frontendUrl = (process.env.FRONTEND_URL || "http://localhost:3000").replace(/\/$/, "");
  const setupLink = `${frontendUrl}/reset-password?token=${token}`;
  const label = roleLabel || "Account";
  await sendEmail(
    to,
    `${label} Created - Set Your Password`,
    `An account has been created for you as a ${label.toLowerCase()}. Click the link below to create your password (valid for 24 hours):\n\n${setupLink}\n\nIf you were not expecting this invitation, please contact support.`,
    `<p>An account has been created for you as a ${label.toLowerCase()}.</p>
     <p>Click the link below to create your password (valid for 24 hours):</p>
     <p><a href="${setupLink}">${setupLink}</a></p>
     <p>If you were not expecting this invitation, please contact support.</p>`,
  );
};

module.exports = {
  sendEmail,
  sendOtpEmail,
  sendPasswordResetEmail,
  sendAdminInitiatedResetEmail,
  sendPlannerPasswordSetupEmail,
  sendRolePasswordSetupEmail,
};
