const mongoose = require("mongoose");

const policySchema = new mongoose.Schema({
  title: { type: String, required: true },
  description: { type: String, required: true },
  targetRegions: [{ type: String }],
  policyCode: { type: String, required: true, unique: true },
  startDate: { type: Date, required: true },
  endDate: { type: Date, required: true },
  status: {
    type: String,
    enum: ["draft", "published", "active", "paused", "closed", "archived"],
    default: "draft",
  },
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    required: true,
  },
  createdAt: { type: Date, default: Date.now },

  // Poll type and options
  pollType: {
    type: String,
    enum: [
      "binary",
      "multipleChoice",
      "likert",
      "approval",
      "rating",
      "rankedChoice",
    ],
    required: true,
    default: "rating",
  },
  pollOptions: [
    {
      id: { type: String, required: true }, // e.g., "opt1"
      text: { type: String, required: true }, // display text
      shortCode: { type: String }, // for SMS (optional)
    },
  ],
  maxSelections: { type: Number, default: 1 }, // for multipleChoice
  likertLabels: {
    type: [String],
    validate: (v) => v.length === 5,
    default: [
      "Very Dissatisfied",
      "Dissatisfied",
      "Neutral",
      "Satisfied",
      "Very Satisfied",
    ],
  },
  rankedChoiceMaxRank: { type: Number, default: 3 }, // for rankedChoice

  // Relevance factors (soft targeting)
  relevanceFactors: {
    women: { type: Boolean, default: false },
    youth: { type: Boolean, default: false },
    farmers: { type: Boolean, default: false },
    urban: { type: Boolean, default: false },
    rural: { type: Boolean, default: false },
    privateSector: { type: Boolean, default: false },
    government: { type: Boolean, default: false },
    // custom can be added as map
  },

  // Citizen visibility controls
  citizenAnalyticsVisibility: {
    showResults: { type: Boolean, default: true },
    showBreakdown: { type: Boolean, default: false },
    showComments: { type: Boolean, default: false },
    showSentiment: { type: Boolean, default: false },
    allowTimeFilter: { type: Boolean, default: false },
  },

  // Topics (AI‑assisted or manual)
  topics: [{ type: String }],

  // Soft delete / archive
  archivedAt: { type: Date, default: null },
  archivedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    default: null,
  },
  archivedByRole: { type: String, enum: ["planner", "admin"], default: null },
});

module.exports = mongoose.model("Policy", policySchema);
