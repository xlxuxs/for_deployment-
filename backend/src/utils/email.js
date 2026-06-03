const { Resend } = require("resend");
const logger = require("./logger");

let resendClient = null;
let resendClientPromise = null;
let mockMode = false;
let mockReason = null;

const getUnavailableError = () =>
  new Error(mockReason || "Email delivery is currently unavailable.");

const setMockMode = (reason) => {
  mockMode = true;
  mockReason = reason;
  resendClient = null;
  resendClientPromise = null;
  logger.warn(`Email: ${reason}. Switching to mock mode.`);
};

const getResendClient = async ({ requireDelivery = false } = {}) => {
  if (mockMode) {
    if (requireDelivery) {
      throw getUnavailableError();
    }
    return null;
  }

  if (resendClient) return resendClient;

  if (!resendClientPromise) {
    resendClientPromise = (async () => {
      const apiKey = process.env.RESEND_API_KEY;

      if (!apiKey) {
        const reason = "Missing Resend credentials (RESEND_API_KEY)";
        if (requireDelivery) {
          throw new Error(reason);
        }
        setMockMode(reason);
        return null;
      }

      try {
        const candidate = new Resend(apiKey);
        resendClient = candidate;
        logger.info("Resend configured and ready.");
        return resendClient;
      } catch (error) {
        const reason = `Resend client initialization failed: ${error.message}`;
        if (requireDelivery) {
          throw new Error(reason);
        }
        setMockMode(reason);
        return null;
      } finally {
        resendClientPromise = null;
      }
    })();
  }

  return resendClientPromise;
};

/**
 * Send an email.
 * Usage: sendEmail(to, subject, text, html)
 *    or: sendEmail({ to, subject, text, html, requireDelivery })
 */
const sendEmail = async (to, subject, text, html) => {
  let requireDelivery = false;

  if (typeof to === "object") {
    const obj = to;
    to = obj.to;
    subject = obj.subject;
    text = obj.text;
    html = obj.html;
    requireDelivery = Boolean(obj.requireDelivery);
  }

  if (!to) {
    logger.error("sendEmail called without recipient (to field missing)");
    if (requireDelivery) {
      throw new Error("Recipient email address is required");
    }
    return { delivered: false, mode: "invalid", reason: "missing-recipient" };
  }

  if (mockMode) {
    if (requireDelivery) {
      throw getUnavailableError();
    }
    logger.info(
      `[MOCK EMAIL] To: ${to}, Subject: ${subject}, Body: ${text || (html ? html.replace(/<[^>]*>/g, "").slice(0, 200) : "(empty)")}`,
    );
    return { delivered: false, mode: "mock", reason: mockReason };
  }

  const resend = await getResendClient({ requireDelivery });
  if (!resend) {
    if (requireDelivery) {
      throw getUnavailableError();
    }
    logger.info(`[MOCK EMAIL (fallback)] To: ${to}, Subject: ${subject}`);
    return { delivered: false, mode: "mock", reason: mockReason };
  }

  try {
    const { error } = await resend.emails.send({
      from: "no-reply@abrowork.com",
      to,
      subject,
      text,
      html,
    });

    if (error) {
      throw new Error(error.message || "Unknown Resend error");
    }

    logger.info(`Email sent to ${to} (${subject})`);
    return { delivered: true, mode: "resend" };
  } catch (err) {
    logger.error({
      message: `Failed to send email to ${to}`,
      error: err.message,
      code: err.code,
      response: err.response,
      responseCode: err.responseCode,
      command: err.command,
      stack: err.stack,
    });
    if (requireDelivery) {
      throw err;
    }
    logger.info(`[MOCK EMAIL (error fallback)] To: ${to}, Subject: ${subject}`);
    return { delivered: false, mode: "mock", reason: err.message };
  }
};

// Convenience wrappers
const sendOtpEmail = async (to, otp) => {
  await sendEmail({
    to,
    subject: "Your verification code",
    text: `Your OTP is: ${otp}\nIt expires in 5 minutes.`,
    html: `<p>Your OTP is: <strong>${otp}</strong></p><p>It expires in 5 minutes.</p>`,
    requireDelivery: true,
  });
};

const sendPasswordResetEmail = async (to, token) => {
  const frontendUrl = (process.env.FRONTEND_URL || "http://localhost:3000").replace(/\/$/, "");
  const resetLink = `${frontendUrl}/reset-password?token=${token}`;
  await sendEmail({
    to,
    subject: "Password Reset Request - Civic Engagement Platform",
    text: `You requested a password reset. Click the link below to set a new password (valid for 1 hour):\n\n${resetLink}\n\nIf you didn't request this, please ignore this email.`,
    html: `<p>You requested a password reset. Click the link below to set a new password (valid for 1 hour):</p>
     <p><a href="${resetLink}">${resetLink}</a></p>
     <p>If you didn't request this, please ignore this email.</p>`,
    requireDelivery: true,
  });
};

const sendAdminInitiatedResetEmail = async (to, token) => {
  const frontendUrl = (process.env.FRONTEND_URL || "http://localhost:3000").replace(/\/$/, "");
  const resetLink = `${frontendUrl}/reset-password?token=${token}`;
  await sendEmail({
    to,
    subject: "Password Reset Initiated by Administrator",
    text: `An administrator has initiated a password reset for your account. Click the link below to set a new password (valid for 1 hour):\n\n${resetLink}\n\nIf you did not request this, please contact support.`,
    html: `<p>An administrator has initiated a password reset for your account. Click the link below to set a new password (valid for 1 hour):</p>
     <p><a href="${resetLink}">${resetLink}</a></p>
     <p>If you did not request this, please contact support.</p>`,
    requireDelivery: true,
  });
};

const sendPlannerPasswordSetupEmail = async (to, token) => {
  const frontendUrl = (process.env.FRONTEND_URL || "http://localhost:3000").replace(/\/$/, "");
  const setupLink = `${frontendUrl}/reset-password?token=${token}`;
  await sendEmail({
    to,
    subject: "Planner Account Created - Set Your Password",
    text: `A planner account has been created for you. Click the link below to create your password (valid for 24 hours):\n\n${setupLink}\n\nIf you were not expecting this invitation, please contact support.`,
    html: `<p>A planner account has been created for you.</p>
     <p>Click the link below to create your password (valid for 24 hours):</p>
     <p><a href="${setupLink}">${setupLink}</a></p>
     <p>If you were not expecting this invitation, please contact support.</p>`,
    requireDelivery: true,
  });
};

const sendRolePasswordSetupEmail = async (to, token, roleLabel) => {
  const frontendUrl = (process.env.FRONTEND_URL || "http://localhost:3000").replace(/\/$/, "");
  const setupLink = `${frontendUrl}/reset-password?token=${token}`;
  const label = roleLabel || "Account";
  await sendEmail({
    to,
    subject: `${label} Created - Set Your Password`,
    text: `An account has been created for you as a ${label.toLowerCase()}. Click the link below to create your password (valid for 24 hours):\n\n${setupLink}\n\nIf you were not expecting this invitation, please contact support.`,
    html: `<p>An account has been created for you as a ${label.toLowerCase()}.</p>
     <p>Click the link below to create your password (valid for 24 hours):</p>
     <p><a href="${setupLink}">${setupLink}</a></p>
     <p>If you were not expecting this invitation, please contact support.</p>`,
    requireDelivery: true,
  });
};

module.exports = {
  sendEmail,
  sendOtpEmail,
  sendPasswordResetEmail,
  sendAdminInitiatedResetEmail,
  sendPlannerPasswordSetupEmail,
  sendRolePasswordSetupEmail,
};
