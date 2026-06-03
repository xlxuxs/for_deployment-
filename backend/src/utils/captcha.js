const axios = require("axios");

/**
 * Verifies a Google reCAPTCHA v2 token.
 * @param {string} token - The captcha token from frontend.
 * @returns {Promise<boolean>} - True if verified successfully, false otherwise.
 */
const verifyCaptcha = async (token) => {
  if (!token) return false;
  try {
    const response = await axios.post(
      "https://www.google.com/recaptcha/api/siteverify",
      null,
      {
        params: {
          secret: process.env.RECAPTCHA_SECRET_KEY,
          response: token,
        },
        timeout: 5000,
      }
    );
    const data = response.data || {};
    return !!data.success;
  } catch (err) {
    console.error("CAPTCHA verification error:", err);
    return false;
  }
};

module.exports = { verifyCaptcha };
