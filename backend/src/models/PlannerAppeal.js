const mongoose = require("mongoose");

const plannerAppealSchema = new mongoose.Schema(
  {
    plannerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    reason: { type: String, required: true, trim: true, minlength: 20 },
    status: {
      type: String,
      enum: ["pending", "approved", "rejected"],
      default: "pending",
      index: true,
    },
    resolvedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },
    resolvedAt: { type: Date, default: null },
    adminNote: { type: String, default: "", trim: true },
  },
  { timestamps: true },
);

plannerAppealSchema.index(
  { plannerId: 1, status: 1 },
  {
    unique: true,
    partialFilterExpression: { status: "pending" },
  },
);

module.exports = mongoose.model("PlannerAppeal", plannerAppealSchema);
