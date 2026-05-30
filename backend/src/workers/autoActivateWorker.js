const cron = require("node-cron");
const Policy = require("../models/Policy");
const PolicyAssociate = require("../models/PolicyAssociate");
const logger = require("../utils/logger");
const { createAuditLog } = require("../utils/audit");
const { createNotification } = require("../services/notificationService");

const autoActivatePolicies = async () => {
  try {
    const now = new Date();
    const policiesToActivate = await Policy.find({
      status: "published",
      startDate: { $lte: now },
      endDate: { $gte: now },
    });

    for (const policy of policiesToActivate) {
      policy.status = "active";
      await policy.save();

      // Audit log
      await createAuditLog({
        userId: policy.createdBy,
        userRole: "system",
        action: "AUTO_ACTIVATE_POLICY",
        targetType: "Policy",
        targetId: policy._id,
        details: {
          policyCode: policy.policyCode,
          title: policy.title,
          reason: "startDate reached",
        },
        req: null,
      });

      // Notify policy owner
      await createNotification({
        userId: policy.createdBy,
        type: "POLICY_ACTIVATED",
        title: "Policy Activated",
        message: `Your policy "${policy.title}" has been automatically activated and is now accepting votes.`,
        data: { policyId: policy._id, policyCode: policy.policyCode },
        severity: "info",
        source: "system",
      });

      // Find associates with view_analytics permission
      const associates = await PolicyAssociate.find({
        policyId: policy._id,
        revokedAt: null,
        permissions: { $in: ["view_analytics"] },
      }).select("plannerId");

      // Notify each associate
      for (const associate of associates) {
        await createNotification({
          userId: associate.plannerId,
          type: "POLICY_ACTIVATED",
          title: "Policy Activated",
          message: `Policy "${policy.title}" has been automatically activated and is now accepting votes.`,
          data: { policyId: policy._id, policyCode: policy.policyCode },
          severity: "info",
          source: "system",
        });
      }

      logger.info(
        `Auto-activated policy ${policy._id} (${policy.policyCode}) - startDate ${policy.startDate.toISOString()}`,
      );
    }
  } catch (err) {
    logger.error(
      { error: err.message, stack: err.stack },
      "Auto‑activation error",
    );
  }
};

const startAutoActivateWorker = () => {
  cron.schedule("* * * * *", autoActivatePolicies);
  logger.info("Auto‑activation worker started (cron every minute)");
};

module.exports = { startAutoActivateWorker };
