const mongoose = require("mongoose");

const userInteractionSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  policyId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Policy",
    required: true,
  },
  type: {
    type: String,
    enum: ["view", "vote", "comment"],
    required: true,
  },
  createdAt: { type: Date, default: Date.now },
});

module.exports = mongoose.model("UserInteraction", userInteractionSchema);
