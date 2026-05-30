const AuditLog = require("../models/AuditLog");

const createAuditLog = async ({
  userId,
  userRole,
  action,
  targetType,
  targetId,
  details,
  req,
}) => {
  try {
    const log = new AuditLog({
      userId,
      userRole,
      action,
      targetType,
      targetId,
      details,
      ipAddress: req?.ip || req?.connection?.remoteAddress,
      userAgent: req?.get("user-agent") || "auto-closer",
    });
    await log.save();
  } catch (err) {
    console.error("Audit log failed:", err); // keep console for audit failure? better to use logger.error
  }
};

module.exports = { createAuditLog };
