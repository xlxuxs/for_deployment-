const mongoose = require("mongoose");

const smsActivitySchema = new mongoose.Schema({
  phoneHash: { type: String, required: true, index: true },
  phoneLast4: { type: String, default: "" },
  direction: {
    type: String,
    enum: ["inbound", "outbound"],
    required: true,
    index: true,
  },
  command: { type: String, required: true, index: true },
  inboundMessage: { type: String, default: "" },
  replyMessage: { type: String, default: "" },
  success: { type: Boolean, default: true, index: true },
  statusCode: { type: Number, default: 200 },
  policyId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Policy",
    default: null,
    index: true,
  },
  metadata: { type: Object, default: {} },
  createdAt: { type: Date, default: Date.now, index: true },
});

smsActivitySchema.index({ createdAt: -1 });

module.exports = mongoose.model("SmsActivity", smsActivitySchema);
