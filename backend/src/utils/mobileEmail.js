const nodemailer = require("nodemailer");

let transporter = null;

const getTransporter = () => {
  if (!transporter) {
    transporter = nodemailer.createTransport({
      host: process.env.EMAIL_HOST,
      port: parseInt(process.env.EMAIL_PORT),
      secure: process.env.EMAIL_PORT === "465",
      auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS,
      },
    });
  }
  return transporter;
};

const sendEmail = async (to, subject, text, html) => {
  const transporter = getTransporter();
  await transporter.sendMail({
    from: process.env.EMAIL_USER,
    to,
    subject,
    text,
    html,
  });
};

// Mobile-friendly password reset email with visible token
const sendMobilePasswordResetEmail = async (to, token) => {
  const frontendUrl = (process.env.FRONTEND_URL || "http://localhost:3000").replace(/\/$/, "");
  const resetLink = `${frontendUrl}/reset-password?token=${token}`;
  await sendEmail(
    to,
    "Password Reset Request - Civic Engagement Platform",
    `You requested a password reset.\n\nYour reset token is: ${token}\n\nCopy this token and paste it in the mobile app to reset your password (valid for 1 hour).\n\nAlternatively, if using the web app, click this link:\n${resetLink}\n\nIf you didn't request this, please ignore this email.`,
    `<div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
      <h2 style="color: #333;">Password Reset Request</h2>
      <p>You requested a password reset.</p>
      
      <div style="background-color: #f5f5f5; padding: 20px; border-radius: 8px; margin: 20px 0;">
        <p style="margin: 0 0 10px 0; font-weight: bold;">Your Reset Token:</p>
        <p style="font-size: 24px; font-family: monospace; background-color: #fff; padding: 15px; border-radius: 4px; border: 2px solid #ddd; word-break: break-all; margin: 0;">
          ${token}
        </p>
      </div>
      
      <p><strong>For Mobile App Users:</strong> Copy the token above and paste it in the app's reset password screen.</p>
      <p><strong>For Web Users:</strong> <a href="${resetLink}" style="color: #007bff;">Click here to reset your password</a></p>
      
      <p style="color: #666; font-size: 14px; margin-top: 30px;">This token is valid for 1 hour.</p>
      <p style="color: #666; font-size: 14px;">If you didn't request this, please ignore this email.</p>
    </div>`,
  );
};

// Mobile-friendly admin-initiated reset email with visible token
const sendMobileAdminInitiatedResetEmail = async (to, token) => {
  const frontendUrl = (process.env.FRONTEND_URL || "http://localhost:3000").replace(/\/$/, "");
  const resetLink = `${frontendUrl}/reset-password?token=${token}`;
  await sendEmail(
    to,
    "Password Reset Initiated by Administrator",
    `An administrator has initiated a password reset for your account.\n\nYour reset token is: ${token}\n\nCopy this token and paste it in the mobile app to reset your password (valid for 1 hour).\n\nAlternatively, if using the web app, click this link:\n${resetLink}\n\nIf you did not request this, please contact support.`,
    `<div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
      <h2 style="color: #333;">Password Reset by Administrator</h2>
      <p>An administrator has initiated a password reset for your account.</p>
      
      <div style="background-color: #f5f5f5; padding: 20px; border-radius: 8px; margin: 20px 0;">
        <p style="margin: 0 0 10px 0; font-weight: bold;">Your Reset Token:</p>
        <p style="font-size: 24px; font-family: monospace; background-color: #fff; padding: 15px; border-radius: 4px; border: 2px solid #ddd; word-break: break-all; margin: 0;">
          ${token}
        </p>
      </div>
      
      <p><strong>For Mobile App Users:</strong> Copy the token above and paste it in the app's reset password screen.</p>
      <p><strong>For Web Users:</strong> <a href="${resetLink}" style="color: #007bff;">Click here to reset your password</a></p>
      
      <p style="color: #666; font-size: 14px; margin-top: 30px;">This token is valid for 1 hour.</p>
      <p style="color: #666; font-size: 14px;">If you did not request this, please contact support.</p>
    </div>`,
  );
};

module.exports = {
  sendMobilePasswordResetEmail,
  sendMobileAdminInitiatedResetEmail,
};
