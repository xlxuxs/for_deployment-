const axios = require("axios");

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
      },
    );
    return response.data.success === true;
  } catch (err) {
    console.error("CAPTCHA verification error:", err);
    return false;
  }
};

const captchaMiddleware = async (req, res, next) => {
  // If CAPTCHA is disabled (development), skip verification
  if (process.env.DISABLE_CAPTCHA === "true") {
    console.warn("CAPTCHA disabled – skipping verification");
    return next();
  }
  // Skip if CAPTCHA not configured (no secret key)
  if (!process.env.RECAPTCHA_SECRET_KEY) {
    console.warn("CAPTCHA secret key missing – skipping verification");
    return next();
  }
  const token = req.body.captchaToken;
  if (!token) {
    return res.status(400).json({
      status: "error",
      error: { code: "CAPTCHA_REQUIRED", message: "CAPTCHA token required" },
      timestamp: new Date().toISOString(),
    });
  }
  const isValid = await verifyCaptcha(token);
  if (!isValid) {
    return res.status(400).json({
      status: "error",
      error: { code: "CAPTCHA_FAILED", message: "Invalid CAPTCHA" },
      timestamp: new Date().toISOString(),
    });
  }
  next();
};

module.exports = captchaMiddleware;
