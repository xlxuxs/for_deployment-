const mongoose = require("mongoose");

const messageSchema = new mongoose.Schema({
  senderId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    required: true,
  },
  recipientId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    required: true,
  },
  subject: { type: String, required: true, maxlength: 200 },
  body: { type: String, required: true, maxlength: 5000 },
  read: { type: Boolean, default: false },
  replyToId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Message",
    default: null,
  },
  createdAt: { type: Date, default: Date.now },
});

module.exports = mongoose.model("Message", messageSchema);
