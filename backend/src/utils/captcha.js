const axios = require("axios");

/**
 * Verifies a Google reCAPTCHA v2 token.
 * @param {string} token - The captcha token from frontend.
 * @param {object} [req] - The Express request object to check for mobile clients.
 * @returns {Promise<boolean>} - True if verified successfully, false otherwise.
 */
const verifyCaptcha = async (token, req) => {
  if (req) {
    const userAgent = req.headers["user-agent"] || "";
    const clientType = req.headers["x-client-type"] || "";
    if (
      clientType === "mobile" ||
      userAgent.includes("Expo") ||
      userAgent.includes("okhttp") ||
      userAgent.includes("Dart") ||
      userAgent.includes("CitizenVoiceMobile")
    ) {
      return true; // Skip captcha verification for mobile clients
    }
  }

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
