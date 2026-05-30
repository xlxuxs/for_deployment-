const cron = require("node-cron");
const PolicyAssociate = require("../models/PolicyAssociate");
const Policy = require("../models/Policy");
const { createNotification } = require("../services/notificationService");
const { createAuditLog } = require("../utils/audit");
const logger = require("../utils/logger");

const expirePendingInvitations = async () => {
  try {
    const expiredInvitations = await PolicyAssociate.findExpiredInvitations();

    if (expiredInvitations.length === 0) {
      return;
    }

    logger.info(
      `Found ${expiredInvitations.length} expired invitations to process`,
    );

    for (const invitation of expiredInvitations) {
      await invitation.markExpired();

      const policy = await Policy.findById(invitation.policyId).select(
        "title createdBy",
      );
      if (!policy) {
        logger.warn(
          `Policy ${invitation.policyId} not found for expired invitation ${invitation._id}`,
        );
        continue;
      }

      // Notify the policy owner
      await createNotification({
        userId: policy.createdBy,
        type: "INVITATION_EXPIRED",
        title: "Associate Invitation Expired",
        message: `Your invitation to planner ID ${invitation.plannerId} for policy "${policy.title}" has expired. You may re‑invite them if still needed.`,
        data: {
          policyId: invitation.policyId,
          associateId: invitation._id,
          plannerId: invitation.plannerId,
          expiredAt: new Date(),
        },
        severity: "info",
        source: "system",
      });

      // Notify the associate (receiver)
      await createNotification({
        userId: invitation.plannerId,
        type: "INVITATION_EXPIRED_RECEIVER",
        title: "Invitation Expired",
        message: `Your invitation to become an associate for policy "${policy.title}" has expired. No further action is needed.`,
        data: {
          policyId: invitation.policyId,
          associateId: invitation._id,
          expiredAt: new Date(),
        },
        severity: "info",
        source: "system",
      });

      // Audit log
      await createAuditLog({
        userId: policy.createdBy,
        userRole: "system",
        action: "INVITATION_EXPIRED",
        targetType: "PolicyAssociate",
        targetId: invitation._id,
        details: {
          policyId: invitation.policyId,
          plannerId: invitation.plannerId,
          invitedAt: invitation.invitedAt,
          expiresAt: invitation.expiresAt,
        },
        req: null,
      });

      logger.info(
        `Expired invitation ${invitation._id} for policy ${invitation.policyId} processed`,
      );
    }
  } catch (err) {
    logger.error(
      { error: err.message, stack: err.stack },
      "Error in expirePendingInvitations worker",
    );
  }
};

const startExpireInvitationsWorker = () => {
  cron.schedule("0 * * * *", expirePendingInvitations);
  logger.info("Expire invitations worker started (runs every hour)");
};

module.exports = { startExpireInvitationsWorker };
