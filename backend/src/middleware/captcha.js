const axios = require("axios");

// Verify a reCAPTCHA v3 token and return structured result
const verifyCaptcha = async (token) => {
  if (!token) return { ok: false, reason: "no-token" };
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
    const d = response.data || {};
    return { ok: !!d.success, score: d.score, action: d.action, raw: d };
  } catch (err) {
    console.error("CAPTCHA verification error:", err);
    return { ok: false, reason: "error" };
  }
};

const captchaMiddleware = async (req, res, next) => {
  const token = req.body?.captchaToken || req.query?.captchaToken || req.headers["x-captcha-token"];
  const expectedAction = req.body?.captchaAction || req.query?.captchaAction || null;

  if (!token) {
    return res.status(400).json({
      status: "error",
      error: { code: "CAPTCHA_REQUIRED", message: "CAPTCHA token required" },
      timestamp: new Date().toISOString(),
    });
  }

  const result = await verifyCaptcha(token);
  if (!result.ok) {
    return res.status(400).json({
      status: "error",
      error: { code: "CAPTCHA_FAILED", message: "CAPTCHA verification failed" },
      details: result.raw || result.reason,
      timestamp: new Date().toISOString(),
    });
  }

  // Optional: verify action matches (recommended for v3)
  if (expectedAction && result.action && result.action !== expectedAction) {
    return res.status(400).json({
      status: "error",
      error: { code: "CAPTCHA_ACTION_MISMATCH", message: "CAPTCHA action mismatch" },
      details: { expected: expectedAction, got: result.action },
      timestamp: new Date().toISOString(),
    });
  }

  const minScore = parseFloat(process.env.RECAPTCHA_MIN_SCORE || "0.5");
  const score = typeof result.score === "number" ? result.score : 0;
  if (score < minScore) {
    return res.status(400).json({
      status: "error",
      error: { code: "CAPTCHA_LOW_SCORE", message: "CAPTCHA score too low" },
      details: { score },
      timestamp: new Date().toISOString(),
    });
  }

  // Attach captcha verification result for downstream handlers/logging
  req.captcha = { score, action: result.action, raw: result.raw };
  next();
};

module.exports = captchaMiddleware;
