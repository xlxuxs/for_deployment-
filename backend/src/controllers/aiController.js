const axios = require("axios");
const logger = require("../utils/logger");
const {
  sendSuccess,
  sendError,
  ErrorCodes,
} = require("../utils/responseHelper");

const AI_SERVICE_URL =
  process.env.AI_SERVICE_URL || "https://ai-sevice.onrender.com";

exports.suggestPolicyTopics = async (req, res) => {
  try {
    const { text } = req.body;
    if (!text || text.length < 10) {
      return sendError(
        res,
        ErrorCodes.VALIDATION,
        "Text must be at least 10 characters",
        null,
        400,
      );
    }

    const response = await axios.post(
      `${AI_SERVICE_URL}/suggest-topics`,
      { text },
      {
        headers: { "X-Internal-API-Key": process.env.INTERNAL_API_KEY },
        timeout: 30000,
      },
    );

    return sendSuccess(res, response.data, "Topics suggested");
  } catch (err) {
    // logger.error({ error: err.message }, "Topic suggestion failed");
    // if (err.code === "ECONNREFUSED") {
    //   return sendError(
    //     res,
    //     ErrorCodes.AI_FAILED,
    //     "AI service is not running",
    //     null,
    //     503,
    //   );
    // }
    // return sendError(
    //   res,
    //   ErrorCodes.AI_FAILED,
    //   "Failed to get topic suggestions",
    //   null,
    //   500,
    // );
    logger.warn(
      { error: err.message },
      "AI service unavailable – returning fallback topics",
    );
    // Graceful fallback: return a generic topic
    return sendSuccess(
      res,
      {
        topics: [{ topic: "General", confidence: 1.0 }],
      },
      "AI service unavailable – using fallback",
    );
  }
};
