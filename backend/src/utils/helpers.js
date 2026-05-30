const bcrypt = require("bcryptjs");
const crypto = require("crypto");

const hashPassword = async (password) => {
  return await bcrypt.hash(password, 10);
};

const comparePassword = async (password, hash) => {
  return await bcrypt.compare(password, hash);
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
  normalizePhone,
  hashPhone,
  generateOTP,
};
