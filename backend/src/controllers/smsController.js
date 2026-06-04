const logger = require("../utils/logger");
const Policy = require("../models/Policy");
const { simulateInboundSms, getPolicyVoteSummary } = require("../services/mockSmsService");

function escapeXml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&apos;");
}

function getField(body, keys) {
  for (const key of keys) {
    const value = body?.[key];
    if (typeof value === "string" && value.trim()) {
      return value.trim();
    }
  }
  return "";
}

function extractInboundSms(body = {}) {
  return {
    phone: getField(body, ["phone", "from", "From", "msisdn", "sender", "Sender"]),
    message: getField(body, ["message", "body", "Body", "text", "Text", "content"]),
    preferredLanguage: getField(body, [
      "preferredLanguage",
      "preferred_language",
      "language",
      "Language",
      "locale",
    ]),
    region: getField(body, ["region", "Region"]),
  };
}

function shouldReplyWithXml(req) {
  const contentType = String(req.get("content-type") || "").toLowerCase();
  const accept = String(req.get("accept") || "").toLowerCase();
  const userAgent = String(req.get("user-agent") || "").toLowerCase();

  return (
    "Body" in (req.body || {}) ||
    "From" in (req.body || {}) ||
    contentType.includes("application/x-www-form-urlencoded") ||
    accept.includes("xml") ||
    userAgent.includes("twilio")
  );
}

const sendText = (req, res, message, statusCode = 200) => {
  if (shouldReplyWithXml(req)) {
    res
      .status(statusCode)
      .type("text/xml")
      .send(`<?xml version="1.0" encoding="UTF-8"?><Response><Message>${escapeXml(message)}</Message></Response>`);
    return;
  }

  res.status(statusCode).type("text/plain").send(message);
};

exports.receiveSms = async (req, res) => {
  try {
    const inbound = extractInboundSms(req.body);
    const result = await simulateInboundSms(inbound);
    return sendText(req, res, result.reply, result.statusCode);
  } catch (err) {
    logger.error({ error: err.message, stack: err.stack }, "SMS receive error");
    return sendText(req, res, "Server error", 500);
  }
};

exports.getResults = async (req, res) => {
  try {
    const { code } = req.query;
    if (!code) {
      return sendText(req, res, "Policy code is required", 400);
    }
    const policy = await Policy.findOne({ policyCode: code, status: "closed" });
    if (!policy) {
      return sendText(req, res, "Policy not found or not yet closed.", 404);
    }
    const summary = await getPolicyVoteSummary(policy);
    return sendText(
      req,
      res,
      `Policy: ${policy.title}\nFinal results:\n${summary}`,
      200,
    );
  } catch (err) {
    logger.error({ error: err.message, stack: err.stack }, "SMS results error");
    return sendText(req, res, "Server error", 500);
  }
};
