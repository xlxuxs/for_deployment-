const mongoose = require("mongoose");

// Event schema (immutable audit trail)
const CommentEventSchema = new mongoose.Schema(
  {
    type: {
      type: String,
      enum: [
        "created",
        "edited",
        "deleted",
        "restored",
        "reported",
        "moderated",
        "appealed",
        "appeal_resolved",
        "ai_analyzed",
        "ai_failed",
        "version_created",
      ],
      required: true,
    },
    actor: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
    data: { type: mongoose.Schema.Types.Mixed, default: {} },
    createdAt: { type: Date, default: Date.now },
  },
  { _id: false },
);

// Report subdocument
const ReportSchema = new mongoose.Schema(
  {
    reporterId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    reason: { type: String, required: true, trim: true },
    details: { type: String, default: null, trim: true },
    status: {
      type: String,
      enum: ["pending", "valid", "invalid", "resolved"],
      default: "pending",
    },
    createdAt: { type: Date, default: Date.now },
    resolvedAt: { type: Date, default: null },
    resolvedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },
    moderatorNotes: { type: String, default: null },
    snapshot: {
      text: String,
      sentiment: { label: String, confidence: Number },
      keywords: [String],
      visibility: String,
      aiStatus: String,
      reportCount: Number,
    },
  },
  { _id: true },
);

// Appeal subdocument (single)
const AppealSchema = new mongoose.Schema(
  {
    appellantId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    reason: { type: String, required: true, trim: true },
    details: { type: String, default: null, trim: true },
    status: {
      type: String,
      enum: ["pending", "approved", "rejected"],
      default: "pending",
    },
    createdAt: { type: Date, default: Date.now },
    resolvedAt: { type: Date, default: null },
    resolvedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },
    moderatorNotes: { type: String, default: null },
    snapshot: {
      text: String,
      visibility: String,
      reportState: String,
      reportCount: Number,
    },
  },
  { _id: true },
);

// Main comment schema
const CommentSchema = new mongoose.Schema(
  {
    // Versioning fields
    originalCommentId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Comment",
      default: null,
      index: true,
    },
    versionNumber: { type: Number, default: 1, index: true },

    // Core fields
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    policyId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Policy",
      required: true,
      index: true,
    },
    parentCommentId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Comment",
      default: null,
      index: true,
    },
    demographics: {
      ageRange: {
        type: String,
        enum: ["18-24", "25-34", "35-44", "45-54", "55+"],
      },
      gender: { type: String, enum: ["male", "female", "prefer-not-to-say"] },
      occupation: {
        type: String,
        enum: [
          "student",
          "farmer",
          "merchant",
          "government-employee",
          "private-sector",
          "unemployed",
          "other",
        ],
      },
      education: {
        type: String,
        enum: [
          "no-formal",
          "primary",
          "secondary",
          "diploma",
          "bachelors",
          "postgraduate",
        ],
      },
    },

    text: { type: String, required: true, trim: true, maxlength: 5000 },
    language: { type: String, default: null },
    editedAt: { type: Date, default: null },
    editCount: { type: Number, default: 0 },

    // AI layer
    aiStatus: {
      type: String,
      enum: ["pending", "processed", "failed", "stale", "skipped"],
      default: "pending",
      index: true,
    },
    sentiment: {
      label: {
        type: String,
        enum: ["positive", "negative", "neutral"],
        default: null,
      },
      confidence: { type: Number, default: null },
      overriddenByModerator: { type: Boolean, default: false },
    },
    keywords: { type: [String], default: [] },
    aiAnalysis: {
      raw: { type: mongoose.Schema.Types.Mixed, default: null },
      version: { type: String, default: null },
      analyzedAt: { type: Date, default: null },
    },
    lastAnalyzedAt: { type: Date, default: null, index: true }, // when AI last successfully analysed this version

    // Reporting layer
    reportState: {
      type: String,
      enum: ["clean", "reported", "under_review", "actioned"],
      default: "clean",
      index: true,
    },
    reportCount: { type: Number, default: 0 },
    reports: { type: [ReportSchema], default: [] },

    // Appeal layer (single)
    appeal: { type: AppealSchema, default: null },

    // Moderation layer
    visibility: {
      type: String,
      enum: ["visible", "hidden", "deleted"],
      default: "visible",
      index: true,
    },
    moderationActions: [
      {
        action: {
          type: String,
          enum: [
            "hide",
            "restore",
            "delete",
            "override_sentiment",
            "override_keywords",
            "reject_appeal",
          ],
        },
        reason: String,
        actor: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
        createdAt: { type: Date, default: Date.now },
      },
    ],
    moderatedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },
    moderatedAt: { type: Date, default: null },
    moderationReason: { type: String, default: null },

    // REVIEW FLAGS
    reviewFlags: {
      sentimentReviewNeeded: { type: Boolean, default: false },
      moderationReviewNeeded: { type: Boolean, default: false },
    },

    replyCount: { type: Number, default: 0 },

    events: { type: [CommentEventSchema], default: [] },

    retryCount: { type: Number, default: 0 },
    nextRetry: { type: Date, default: null, index: true },
    isOfficialReply: { type: Boolean, default: false },
  },
  { timestamps: true },
);

// Indexes
CommentSchema.index({ policyId: 1, createdAt: -1 });
CommentSchema.index({ policyId: 1, aiStatus: 1 });
CommentSchema.index({ policyId: 1, reportState: 1 });
CommentSchema.index({ parentCommentId: 1 });
CommentSchema.index({ visibility: 1 });
CommentSchema.index({ "reports.status": 1 });
CommentSchema.index({ "appeal.status": 1 });
CommentSchema.index({ "reviewFlags.sentimentReviewNeeded": 1 });
CommentSchema.index({ originalCommentId: 1, versionNumber: -1 });
CommentSchema.index({ originalCommentId: 1, createdAt: -1 });

module.exports = mongoose.model("Comment", CommentSchema);
