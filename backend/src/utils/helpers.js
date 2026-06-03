const bcrypt = require("bcryptjs");
const crypto = require("crypto");

const WEAK_PASSWORDS = new Set([
  "12345678",
  "123456789",
  "1234567890",
  "password",
  "password123",
  "qwerty123",
  "admin123",
  "letmein123",
]);

const PASSWORD_REQUIREMENTS_MESSAGE =
  "Password must be at least 8 characters long and include at least one uppercase letter, one lowercase letter, one number, and one special character.";

const hashPassword = async (password) => {
  return await bcrypt.hash(password, 10);
};

const comparePassword = async (password, hash) => {
  return await bcrypt.compare(password, hash);
};

const validatePasswordStrength = (password) => {
  if (typeof password !== "string" || !password.trim()) {
    return "Password is required.";
  }

  if (password.length < 8) {
    return PASSWORD_REQUIREMENTS_MESSAGE;
  }

  const hasUppercase = /[A-Z]/.test(password);
  const hasLowercase = /[a-z]/.test(password);
  const hasNumber = /\d/.test(password);
  const hasSpecialCharacter = /[^A-Za-z0-9]/.test(password);

  if (!hasUppercase || !hasLowercase || !hasNumber || !hasSpecialCharacter) {
    return PASSWORD_REQUIREMENTS_MESSAGE;
  }

  if (WEAK_PASSWORDS.has(password.toLowerCase())) {
    return "Password is too common. Choose a more unique password.";
  }

  return null;
};

const normalizePhone = (phone) => {
  const digits = phone.replace(/\D/g, "");
  if (digits.startsWith("251")) {
    return digits.slice(3);
  }
  if (digits.startsWith("0")) {
    return digits.slice(1);
  }
  return digits;
};

const hashPhone = (phone) => {
  const normalized = normalizePhone(phone);
  return crypto.createHash("sha256").update(normalized).digest("hex");
};

const generateOTP = () => {
  return Math.floor(100000 + Math.random() * 900000).toString();
};

module.exports = {
  hashPassword,
  comparePassword,
  validatePasswordStrength,
  PASSWORD_REQUIREMENTS_MESSAGE,
  normalizePhone,
  hashPhone,
  generateOTP,
};
