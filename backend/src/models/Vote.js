const mongoose = require("mongoose");

const voteSchema = new mongoose.Schema({
  policyId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Policy",
    required: true,
  },
  userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
  phoneHash: { type: String, default: null },
  channel: { type: String, enum: ["app", "sms"], required: true },
  value: { type: mongoose.Schema.Types.Mixed, required: true }, // depends on pollType
  region: { type: String, default: null }, // snapshot
  demographics: {
    ageRange: String,
    gender: String,
    occupation: String,
    education: String,
  },
  createdAt: { type: Date, default: Date.now },
});

// Partial unique indexes
voteSchema.index(
  { policyId: 1, userId: 1 },
  { unique: true, partialFilterExpression: { userId: { $type: "objectId" } } },
);
voteSchema.index(
  { policyId: 1, phoneHash: 1 },
  { unique: true, partialFilterExpression: { phoneHash: { $type: "string" } } },
);
voteSchema.index({ createdAt: -1 });
voteSchema.index({ policyId: 1, createdAt: -1 }); // for timeseries

module.exports = mongoose.model("Vote", voteSchema);
