const jwt = require("jsonwebtoken");
const User = require("../models/User");
const { sendError, ErrorCodes } = require("../utils/responseHelper");

const authMiddleware = (roles = []) => {
  return async (req, res, next) => {
    try {
      // Internal service call
      const internalKey = req.header("X-Internal-API-Key");
      if (internalKey && internalKey === process.env.INTERNAL_API_KEY) {
        req.user = { role: "admin", id: "internal" };
        return next();
      }

      const token = req.header("Authorization")?.replace("Bearer ", "");
      if (!token) {
        return sendError(
          res,
          ErrorCodes.UNAUTHORIZED,
          "Access denied. No token provided.",
          null,
          401,
        );
      }

      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      const user = await User.findById(decoded.id);

      if (!user) {
        return sendError(
          res,
          ErrorCodes.UNAUTHORIZED,
          "User not found. Invalid token.",
          null,
          401,
        );
      }

      if (!user.active) {
        return sendError(
          res,
          ErrorCodes.ACCOUNT_DISABLED,
          "Account is disabled. Please contact an administrator.",
          null,
          403,
        );
      }

      if (roles.length && !roles.includes(user.role)) {
        return sendError(
          res,
          ErrorCodes.FORBIDDEN,
          "Access denied. Insufficient permissions.",
          null,
          403,
        );
      }

      // Attach full user data for personalized feed and other features
      req.user = {
        id: user._id,
        role: user.role,
        region: user.region,
        ageRange: user.ageRange,
        gender: user.gender,
        occupation: user.occupation,
        education: user.education,
        phoneHash: user.phoneHash,
        verified: user.verified,
        active: user.active,
        languagesSpoken: user.languagesSpoken,
        trainingCompletedAt: user.trainingCompletedAt,
      };

      next();
    } catch (err) {
      console.error("Auth middleware error:", err);
      if (err.name === "JsonWebTokenError") {
        return sendError(
          res,
          ErrorCodes.UNAUTHORIZED,
          "Invalid token format or signature.",
          null,
          401,
        );
      }
      if (err.name === "TokenExpiredError") {
        return sendError(
          res,
          ErrorCodes.UNAUTHORIZED,
          "Token has expired. Please log in again.",
          null,
          401,
        );
      }
      return sendError(
        res,
        ErrorCodes.UNAUTHORIZED,
        "Authentication failed.",
        null,
        401,
      );
    }
  };
};

module.exports = authMiddleware;
