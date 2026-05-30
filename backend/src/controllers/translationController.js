const axios = require("axios");
const redisClient = require("../config/redis");
const logger = require("../utils/logger");
const {
  sendSuccess,
  sendError,
  ErrorCodes,
} = require("../utils/responseHelper");

const TRANSLATE_SPACE_URL = process.env.TRANSLATE_SPACE_URL;
const INTERNAL_API_KEY = process.env.INTERNAL_API_KEY;
const AI_SERVICE_URL =
  process.env.AI_SERVICE_URL || "https://ai-sevice.onrender.com";

const getTranslateEndpoint = (baseUrl) => {
  if (!baseUrl) return null;
  const normalized = baseUrl.replace(/\/$/, "");
  return normalized.endsWith("/translate")
    ? normalized
    : `${normalized}/translate`;
};

const getCacheKey = (text, sourceLang, targetLang) => {
  const key = `translate:${sourceLang}:${targetLang}:${text}`;
  const crypto = require("crypto");
  return `trans:${crypto.createHash("md5").update(key).digest("hex")}`;
};

// Helper to detect language using AI service
const detectLanguage = async (text) => {
  try {
    const response = await axios.post(
      `${AI_SERVICE_URL}/analyze`,
      { text },
      {
        headers: { "X-Internal-API-Key": INTERNAL_API_KEY },
        timeout: 5000,
      },
    );
    return response.data.language;
  } catch (err) {
    logger.error(
      "Language detection failed, defaulting to English",
      err.message,
    );
    return "en";
  }
};

exports.translate = async (req, res) => {
  try {
    let { text, sourceLang, targetLang = "en" } = req.body;
    if (!text) {
      return sendError(
        res,
        ErrorCodes.VALIDATION,
        "text is required",
        null,
        400,
      );
    }

    // Auto‑detect source language if not provided
    if (!sourceLang) {
      sourceLang = await detectLanguage(text);
    }

    const cacheKey = getCacheKey(text, sourceLang, targetLang);
    const cached = await redisClient.get(cacheKey);
    if (cached) {
      return sendSuccess(
        res,
        { translatedText: cached },
        "Translation retrieved from cache",
      );
    }

    if (!TRANSLATE_SPACE_URL) {
      logger.error("TRANSLATE_SPACE_URL environment variable not set");
      return sendError(
        res,
        ErrorCodes.INTERNAL,
        "Translation service not configured",
        null,
        503,
      );
    }

    const translateEndpoint = getTranslateEndpoint(TRANSLATE_SPACE_URL);

    const response = await axios.post(
      translateEndpoint,
      { text, source_lang: sourceLang, target_lang: targetLang },
      {
        headers: { "X-Internal-API-Key": INTERNAL_API_KEY },
        timeout: 60000,
      },
    );
    const translated = response.data.translated_text;
    await redisClient.setEx(cacheKey, 86400, translated);

    return sendSuccess(
      res,
      { translatedText: translated },
      "Translation successful",
    );
  } catch (err) {
    console.error("=== TRANSLATION ERROR ===");
    console.error("Message:", err.message);
    if (err.response) {
      console.error("Status:", err.response.status);
      console.error("Data:", err.response.data);
    }
    logger.error({ error: err.message }, "Translation error");
    return sendError(
      res,
      ErrorCodes.INTERNAL,
      "Translation service unavailable. Please try again later.",
      null,
      503,
    );
  }
};
