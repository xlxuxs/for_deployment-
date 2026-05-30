const cron = require("node-cron");
const PolicyAssociate = require("../models/PolicyAssociate");
const { createNotification } = require("../services/notificationService");
const logger = require("../utils/logger");

const remindExpiringInvitations = async () => {
  try {
    const now = new Date();
    const threeDaysFromNow = new Date();
    threeDaysFromNow.setDate(now.getDate() + 3);

    const expiringSoon = await PolicyAssociate.find({
      invitationStatus: "pending",
      expiresAt: { $lte: threeDaysFromNow, $gt: now },
      reminderSentAt: null,
    }).populate("policyId", "title");

    for (const invitation of expiringSoon) {
      await createNotification({
        userId: invitation.plannerId,
        type: "INVITATION_EXPIRING_SOON",
        title: "Invitation Expiring Soon",
        message: `Your invitation to become an associate for policy "${invitation.policyId.title}" will expire on ${invitation.expiresAt.toLocaleDateString()}. Please accept or reject it soon.`,
        data: {
          associateId: invitation._id,
          policyId: invitation.policyId._id,
          expiresAt: invitation.expiresAt,
        },
        severity: "warning",
        source: "system",
      });
      invitation.reminderSentAt = new Date();
      await invitation.save();
      logger.info(`Reminder sent for invitation ${invitation._id}`);
    }
  } catch (err) {
    logger.error("Error in remindExpiringInvitations worker:", err);
  }
};

const startRemindExpiringInvitationsWorker = () => {
  // Run every day at 08:00 AM
  cron.schedule("0 8 * * *", remindExpiringInvitations);
  logger.info("Remind expiring invitations worker started (daily at 08:00)");
};

module.exports = { startRemindExpiringInvitationsWorker };
