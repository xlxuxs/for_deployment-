const express = require("express");
const router = express.Router();
const authController = require("../controllers/authController");
const limiters = require("../config/rateLimits");
const captchaMiddleware = require("../middleware/captcha");

router.post(
  "/register",
  captchaMiddleware,
  limiters.auth,
  authController.register,
);
router.post("/send-otp", limiters.otpRequest, authController.sendOtp);
router.post("/verify-otp", limiters.otpVerify, authController.verifyOtp);
router.post("/login", captchaMiddleware, limiters.auth, authController.login);
router.post(
  "/forgot-password",
  limiters.passwordResetRequest,
  authController.forgotPassword,
);
router.post(
  "/reset-password",
  limiters.passwordResetConfirm,
  authController.resetPassword,
);

module.exports = router;
