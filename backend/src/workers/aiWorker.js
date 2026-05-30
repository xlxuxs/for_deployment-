require("dotenv").config();

const axios = require("axios");
const Comment = require("../models/Comment");

const AI_BASE = process.env.AI_SERVICE_URL || "https://ai-sevice.onrender.com";
const AI_ANALYZE_URL = `${AI_BASE}/analyze`;

const POLL_INTERVAL = 10000; // 10 seconds
const MAX_AGE_HOURS = 24;
const MAX_BACKOFF_MS = 60 * 60 * 1000; // 1 hour
const CONFIDENCE_THRESHOLD = 0.7;

const computeNextRetry = (retryCount) => {
  const delay = Math.min(Math.pow(2, retryCount) * 1000, MAX_BACKOFF_MS);
  return new Date(Date.now() + delay);
};

const isTooOld = (comment) => {
  const age = Date.now() - new Date(comment.createdAt).getTime();
  return age > MAX_AGE_HOURS * 60 * 60 * 1000;
};

const processComment = async (comment) => {
  try {
    const response = await axios.post(
      AI_ANALYZE_URL,
      { text: comment.text, language: null },
      {
        timeout: 5000,
        headers: { "X-Internal-API-Key": process.env.INTERNAL_API_KEY },
      },
    );

    const aiData = response.data;

    const sentiment = {
      label: aiData.sentiment,
      confidence: aiData.confidence,
    };
    const keywords = aiData.keywords || [];

    // Update comment fields
    comment.aiStatus = "processed";
    comment.sentiment = sentiment;
    comment.keywords = keywords;
    comment.aiAnalysis = {
      raw: aiData,
      version: aiData.version || "unknown",
      analyzedAt: new Date(),
    };
    comment.language = aiData.language || null;
    comment.lastAnalyzedAt = new Date();

    // Set review flag based on confidence
    if (sentiment.confidence < CONFIDENCE_THRESHOLD) {
      comment.reviewFlags.sentimentReviewNeeded = true;
    } else {
      comment.reviewFlags.sentimentReviewNeeded = false;
    }

    // Reset retry
    comment.retryCount = 0;
    comment.nextRetry = null;

    // Push event
    comment.events.push({
      type: "ai_analyzed",
      actor: null,
      data: { sentiment, keywords, confidence: sentiment.confidence },
      createdAt: new Date(),
    });

    await comment.save();
    console.log(
      `AI processed comment ${comment._id} (confidence: ${sentiment.confidence})`,
    );
  } catch (err) {
    console.error(`AI request failed for comment ${comment._id}:`, err.message);

    if (isTooOld(comment)) {
      comment.aiStatus = "failed";
      comment.events.push({
        type: "ai_failed",
        actor: null,
        data: { reason: "max_age_exceeded" },
        createdAt: new Date(),
      });
      await comment.save();
      console.log(`Comment ${comment._id} AI permanently failed`);
      return;
    }

    comment.retryCount += 1;
    comment.nextRetry = computeNextRetry(comment.retryCount);
    await comment.save();
    console.log(
      `Comment ${comment._id} retry #${comment.retryCount}, next retry at ${comment.nextRetry}`,
    );
  }
};

const processPendingComments = async () => {
  try {
    const now = new Date();
    const pendingComments = await Comment.find({
      aiStatus: "pending",
      $or: [{ nextRetry: null }, { nextRetry: { $lte: now } }],
    })
      .sort({ createdAt: 1 })
      .limit(10);

    if (!pendingComments.length) return;
    await Promise.all(pendingComments.map(processComment));
  } catch (err) {
    console.error("AI worker error:", err);
  }
};

let interval;
function startWorker() {
  if (interval) clearInterval(interval);
  interval = setInterval(processPendingComments, POLL_INTERVAL);
  console.log(`AI worker started (${POLL_INTERVAL / 1000}s interval)`);
}

function stopWorker() {
  if (interval) clearInterval(interval);
  console.log("AI worker stopped");
}

module.exports = { startWorker, stopWorker };
