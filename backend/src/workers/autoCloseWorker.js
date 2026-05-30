const cron = require("node-cron");
const Policy = require("../models/Policy");
const PolicyAssociate = require("../models/PolicyAssociate");
const Vote = require("../models/Vote");
const SmsSubscription = require("../models/SmsSubscription");
const logger = require("../utils/logger");
const { createAuditLog } = require("../utils/audit");
const { createNotification } = require("../services/notificationService");
const {
  getPolicyVoteSummary,
  recordOutboundSmsNotification,
} = require("../services/mockSmsService");

const autoClosePolicies = async () => {
  try {
    const now = new Date();
    const policiesToClose = await Policy.find({
      status: { $in: ["active", "paused"] },
      endDate: { $lt: now },
    });

    for (const policy of policiesToClose) {
      const oldStatus = policy.status;
      policy.status = "closed";
      await policy.save();

      // Audit log
      await createAuditLog({
        userId: policy.createdBy,
        userRole: "system",
        action: "AUTO_CLOSE_POLICY",
        targetType: "Policy",
        targetId: policy._id,
        details: {
          policyCode: policy.policyCode,
          title: policy.title,
          reason: "endDate passed",
          previousStatus: oldStatus,
        },
        req: null,
      });

      // Compute final statistics
      const allVotes = await Vote.find({ policyId: policy._id });
      const totalVotes = allVotes.length;
      const totalRating = allVotes.reduce((sum, v) => {
        return sum + (typeof v.value === "number" ? v.value : 0);
      }, 0);
      const avgRating =
        totalVotes > 0 ? (totalRating / totalVotes).toFixed(2) : 0;

      // --- In‑app notifications for app users (voters) ---
      const distinctUserIds = [
        ...new Set(allVotes.map((v) => v.userId).filter((id) => id)),
      ];
      for (const userId of distinctUserIds) {
        await createNotification({
          userId,
          type: "POLICY_CLOSED",
          title: "Policy Closed",
          message: `Policy "${policy.title}" has closed. Final average rating: ${avgRating} stars (${totalVotes} votes).`,
          data: {
            policyId: policy._id,
            policyCode: policy.policyCode,
            averageRating: avgRating,
            totalVotes,
          },
          severity: "info",
          source: "system",
        });
      }

      // Notify policy owner
      await createNotification({
        userId: policy.createdBy,
        type: "POLICY_CLOSED",
        title: "Policy Closed",
        message: `Your policy "${policy.title}" has been automatically closed. Final average rating: ${avgRating} stars (${totalVotes} votes).`,
        data: {
          policyId: policy._id,
          policyCode: policy.policyCode,
          averageRating: avgRating,
          totalVotes,
        },
        severity: "info",
        source: "system",
      });

      // Notify associates with view_analytics permission
      const associates = await PolicyAssociate.find({
        policyId: policy._id,
        revokedAt: null,
        permissions: { $in: ["view_analytics"] },
      }).select("plannerId");
      for (const associate of associates) {
        await createNotification({
          userId: associate.plannerId,
          type: "POLICY_CLOSED",
          title: "Policy Closed",
          message: `Policy "${policy.title}" has closed. Final average rating: ${avgRating} stars (${totalVotes} votes).`,
          data: {
            policyId: policy._id,
            policyCode: policy.policyCode,
            averageRating: avgRating,
            totalVotes,
          },
          severity: "info",
          source: "system",
        });
      }

      const smsSummary = await getPolicyVoteSummary(policy);

      // --- SMS notifications for subscribed SMS voters ---
      const smsVoterPhoneHashes = [
        ...new Set(
          allVotes
            .filter((v) => v.channel === "sms" && v.phoneHash)
            .map((v) => v.phoneHash),
        ),
      ];
      const subscribedHashes = await SmsSubscription.find(
        { phoneHash: { $in: smsVoterPhoneHashes }, subscribed: true },
        { phoneHash: 1 },
      ).lean();
      const subscribedSet = new Set(subscribedHashes.map((s) => s.phoneHash));

      for (const phoneHash of smsVoterPhoneHashes) {
        if (!subscribedSet.has(phoneHash)) continue;
        const reply =
          `Policy "${policy.title}" has closed.\n` +
          `Final results:\n${smsSummary}`;
        await recordOutboundSmsNotification({
          phoneHash,
          message: reply,
          policyId: policy._id,
          metadata: {
            policyCode: policy.policyCode,
            pollType: policy.pollType,
            totalVotes,
          },
        });
        logger.info(
          `[SIMULATED SMS] To subscribed phone hash ${phoneHash}: ${reply}`,
        );
      }

      logger.info(
        `Auto-closed policy ${policy._id} (${policy.policyCode}) - endDate ${policy.endDate.toISOString()} (notified ${distinctUserIds.length} app users, ${subscribedSet.size} SMS voters)`,
      );
    }
  } catch (err) {
    logger.error({ error: err.message, stack: err.stack }, "Auto‑close error");
  }
};

const startAutoCloseWorker = () => {
  cron.schedule("* * * * *", autoClosePolicies);
  logger.info("Auto‑close worker started (cron every minute)");
};

module.exports = { startAutoCloseWorker };
