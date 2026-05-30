const SmsActivity = require("../models/SmsActivity");
const Vote = require("../models/Vote");
const SmsSubscription = require("../models/SmsSubscription");
const { simulateInboundSms } = require("../services/mockSmsService");
const { hashPhone, normalizePhone } = require("../utils/helpers");
const { sendError, sendSuccess, ErrorCodes } = require("../utils/responseHelper");
const logger = require("../utils/logger");

exports.simulateSms = async (req, res) => {
  try {
    const { phone, message, preferredLanguage, region } = req.body || {};
    const result = await simulateInboundSms({
      phone,
      message,
      preferredLanguage,
      region,
    });

    return sendSuccess(
      res,
      {
        phoneHash: result.phoneHash,
        phoneLast4: result.phoneLast4,
        normalizedPhone: result.normalizedPhone,
        command: result.command,
        reply: result.reply,
        statusCode: result.statusCode,
        success: result.success,
        subscription: result.subscription,
        metadata: result.metadata,
      },
      "SMS simulated successfully",
    );
  } catch (err) {
    logger.error({ error: err.message, stack: err.stack }, "Simulate mock SMS error");
    return sendError(
      res,
      ErrorCodes.INTERNAL,
      "Failed to simulate SMS",
      null,
      500,
    );
  }
};

exports.getSmsHistory = async (req, res) => {
  try {
    const { page = 1, limit = 120, q = "" } = req.query;
    const numericPage = Math.max(1, Number.parseInt(page, 10) || 1);
    const numericLimit = Math.min(300, Math.max(1, Number.parseInt(limit, 10) || 120));
    const skip = (numericPage - 1) * numericLimit;

    const filter = {};
    if (q && q.trim()) {
      const term = q.trim();
      filter.$or = [
        { command: { $regex: term, $options: "i" } },
        { inboundMessage: { $regex: term, $options: "i" } },
        { replyMessage: { $regex: term, $options: "i" } },
        { phoneLast4: { $regex: term.slice(-4), $options: "i" } },
      ];
    }

    const [activities, total] = await Promise.all([
      SmsActivity.find(filter)
        .populate("policyId", "title policyCode pollType")
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(numericLimit)
        .lean(),
      SmsActivity.countDocuments(filter),
    ]);

    return sendSuccess(
      res,
      {
        total,
        page: numericPage,
        pages: Math.ceil(total / numericLimit),
        activities,
      },
      "SMS history retrieved",
    );
  } catch (err) {
    logger.error({ error: err.message, stack: err.stack }, "Get mock SMS history error");
    return sendError(
      res,
      ErrorCodes.INTERNAL,
      "Failed to retrieve SMS history",
      null,
      500,
    );
  }
};

exports.resetPhoneState = async (req, res) => {
  try {
    const { phone } = req.body || {};
    if (!phone) {
      return sendError(res, ErrorCodes.BAD_REQUEST, "Phone is required", null, 400);
    }

    const normalized = normalizePhone(phone);
    const phoneHash = hashPhone(normalized);

    const [votesResult, activitiesResult, subResult] = await Promise.all([
      Vote.deleteMany({ phoneHash }),
      SmsActivity.deleteMany({ phoneHash }),
      SmsSubscription.deleteOne({ phoneHash }),
    ]);

    return sendSuccess(
      res,
      { votesDeleted: votesResult.deletedCount || 0, activitiesDeleted: activitiesResult.deletedCount || 0 },
      "Phone state reset",
    );
  } catch (err) {
    logger.error({ error: err.message, stack: err.stack }, "Reset mock phone state error");
    return sendError(res, ErrorCodes.INTERNAL, "Failed to reset phone state", null, 500);
  }
};
