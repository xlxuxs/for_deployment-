const mongoose = require("mongoose");

const userSchema = new mongoose.Schema({
  email: { type: String, required: true, unique: true },
  passwordHash: { type: String, required: true },
  phoneHash: { type: String, unique: true, sparse: true, default: null },
  region: { type: String, required: true },
  role: {
    type: String,
    enum: ["citizen", "planner", "comment_moderator", "admin"],
    default: "citizen",
  },
  verified: { type: Boolean, default: false },
  active: { type: Boolean, default: true },
  createdAt: { type: Date, default: Date.now },

  // Demographics
  ageRange: {
    type: String,
    enum: ["18-24", "25-34", "35-44", "45-54", "55+"],
    required: true,
  },
  gender: {
    type: String,
    enum: ["male", "female", "prefer-not-to-say"],
    required: true,
  },
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
    required: true,
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
    required: true,
  },

  preferredLanguage: {
    type: String,
    enum: ["am", "om", "ti", "en"],
    default: "en",
  },

  languagesSpoken: {
    type: [String],
    enum: ["am", "om", "ti", "en"],
    default: [],
  },
  trainingCompletedAt: { type: Date, default: null },
  twoFactorEnabled: { type: Boolean, default: false },
  totpSecret: { type: String, default: null },
  tokenVersion: { type: Number, default: 0 },

  deletedAt: { type: Date, default: null },

  // NEW: displayName for public view (auto‑generated)
  displayName: { type: String, unique: true, sparse: true },
});

// Auto‑generate displayName if missing
userSchema.pre("save", async function () {
  if (!this.displayName) {
    let base = `User_${Math.random().toString(36).substring(2, 10)}`;
    let unique = base;
    let counter = 1;
    while (await mongoose.model("User").findOne({ displayName: unique })) {
      unique = `${base}_${counter++}`;
    }
    this.displayName = unique;
  }
});

module.exports = mongoose.model("User", userSchema);
