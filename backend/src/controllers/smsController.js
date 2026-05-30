const logger = require("../utils/logger");
const Policy = require("../models/Policy");
const { simulateInboundSms, getPolicyVoteSummary } = require("../services/mockSmsService");

const sendText = (res, message, statusCode = 200) => {
  res.status(statusCode).send(message);
};

exports.receiveSms = async (req, res) => {
  try {
    const { phone, message } = req.body || {};
    const result = await simulateInboundSms({ phone, message });
    return sendText(res, result.reply, result.statusCode);
  } catch (err) {
    logger.error({ error: err.message, stack: err.stack }, "SMS receive error");
    return sendText(res, "Server error", 500);
  }
};

exports.getResults = async (req, res) => {
  try {
    const { code } = req.query;
    if (!code) {
      return sendText(res, "Policy code is required", 400);
    }
    const policy = await Policy.findOne({ policyCode: code, status: "closed" });
    if (!policy) {
      return sendText(res, "Policy not found or not yet closed.", 404);
    }
    const summary = await getPolicyVoteSummary(policy);
    return sendText(
      res,
      `Policy: ${policy.title}\nFinal results:\n${summary}`,
      200,
    );
  } catch (err) {
    logger.error({ error: err.message, stack: err.stack }, "SMS results error");
    return sendText(res, "Server error", 500);
  }
};
