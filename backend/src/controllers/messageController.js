const Message = require("../models/Message");
const User = require("../models/User");
const { createAuditLog } = require("../utils/audit");
const {
  sendSuccess,
  sendError,
  ErrorCodes,
} = require("../utils/responseHelper");
const { sendEmail } = require("../utils/email");
const { createNotification } = require("../services/notificationService");

function getIdString(value) {
  return value ? value.toString() : "";
}

async function populateMessage(message) {
  await message.populate("senderId", "email");
  await message.populate("recipientId", "email");
  await message.populate({
    path: "replyToId",
    populate: [
      { path: "senderId", select: "email" },
      { path: "recipientId", select: "email" },
    ],
  });
  return message;
}

// Send a message (only planners/admins)
exports.sendMessage = async (req, res) => {
  try {
    const { recipientId, subject, body, replyToId } = req.body;
    if (!recipientId || !subject || !body) {
      return sendError(
        res,
        ErrorCodes.VALIDATION,
        "recipientId, subject, body required",
        null,
        400,
      );
    }

    const recipient = await User.findById(recipientId);
    if (
      !recipient ||
      (recipient.role !== "planner" && recipient.role !== "admin")
    ) {
      return sendError(
        res,
        ErrorCodes.NOT_FOUND,
        "Recipient not found or not a planner/admin",
        null,
        404,
      );
    }

    const message = new Message({
      senderId: req.user.id,
      recipientId,
      subject: subject.slice(0, 200),
      body: body.slice(0, 5000),
      replyToId: replyToId || null,
    });
    await message.save();

    // In‑app notification only (no email)
    await createNotification({
      userId: recipientId,
      type: "MESSAGE_RECEIVED",
      title: "New Message from " + req.user.id,
      message: subject,
      data: { messageId: message._id },
    });

    await createAuditLog({
      userId: req.user.id,
      userRole: req.user.role,
      action: "SEND_MESSAGE",
      targetType: "Message",
      targetId: message._id,
      details: { recipientId, subject },
      req,
    });

    return sendSuccess(res, { messageId: message._id }, "Message sent");
  } catch (err) {
    console.error(err);
    return sendError(
      res,
      ErrorCodes.INTERNAL,
      "Failed to send message",
      null,
      500,
    );
  }
};

// Get inbox (messages where user is recipient)
exports.getInbox = async (req, res) => {
  try {
    const { page = 1, limit = 20, unreadOnly } = req.query;
    const filter = { recipientId: req.user.id };

    if (String(unreadOnly).toLowerCase() === "true") {
      filter.read = false;
    }

    const messages = await Message.find(filter)
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(Number(limit))
      .populate("senderId", "email")
      .populate({
        path: "replyToId",
        populate: [
          { path: "senderId", select: "email" },
          { path: "recipientId", select: "email" },
        ],
      });
    const total = await Message.countDocuments(filter);
    return sendSuccess(
      res,
      { messages, total, page: Number(page) },
      "Inbox retrieved",
    );
  } catch (err) {
    console.error(err);
    return sendError(
      res,
      ErrorCodes.INTERNAL,
      "Failed to retrieve inbox",
      null,
      500,
    );
  }
};

// Get grouped conversations for the inbox UI
exports.getConversations = async (req, res) => {
  try {
    const userIdStr = req.user.id.toString();
    const messages = await Message.find({
      $or: [{ senderId: req.user.id }, { recipientId: req.user.id }],
    })
      .sort({ createdAt: -1 })
      .populate("senderId", "email")
      .populate("recipientId", "email")
      .populate({
        path: "replyToId",
        populate: [
          { path: "senderId", select: "email" },
          { path: "recipientId", select: "email" },
        ],
      });

    const conversationsByUser = new Map();

    for (const message of messages) {
      const senderIdStr = getIdString(message.senderId?._id || message.senderId);
      const recipientIdStr = getIdString(
        message.recipientId?._id || message.recipientId,
      );
      const counterpart =
        senderIdStr === userIdStr ? message.recipientId : message.senderId;
      const counterpartIdStr = getIdString(counterpart?._id || counterpart);
      if (!counterpartIdStr) continue;

      if (!conversationsByUser.has(counterpartIdStr)) {
        conversationsByUser.set(counterpartIdStr, {
          conversationId: counterpartIdStr,
          counterpartId: counterpartIdStr,
          counterpartEmail: counterpart?.email || "Unknown",
          latestMessage: message,
          unreadCount: 0,
          lastMessageAt: message.createdAt,
        });
      }

      const conversation = conversationsByUser.get(counterpartIdStr);
      if (senderIdStr !== userIdStr && recipientIdStr === userIdStr && !message.read) {
        conversation.unreadCount += 1;
      }
    }

    const conversations = Array.from(conversationsByUser.values()).sort(
      (left, right) => new Date(right.lastMessageAt) - new Date(left.lastMessageAt),
    );

    return sendSuccess(
      res,
      { conversations, total: conversations.length },
      "Conversations retrieved",
    );
  } catch (err) {
    console.error(err);
    return sendError(
      res,
      ErrorCodes.INTERNAL,
      "Failed to retrieve conversations",
      null,
      500,
    );
  }
};

// Get a single message and mark as read
exports.getMessage = async (req, res) => {
  try {
    const { id } = req.params;
    const message = await Message.findById(id);
    if (!message) {
      return sendError(
        res,
        ErrorCodes.NOT_FOUND,
        "Message not found",
        null,
        404,
      );
    }

    const recipientIdStr = message.recipientId
      ? message.recipientId.toString()
      : "";
    const senderIdStr = message.senderId ? message.senderId.toString() : "";
    const userIdStr = req.user.id.toString();

    if (recipientIdStr !== userIdStr && senderIdStr !== userIdStr) {
      // Do not reveal that the message exists – treat as not found
      return sendError(
        res,
        ErrorCodes.NOT_FOUND,
        "Message not found",
        null,
        404,
      );
    }

    if (!message.read && recipientIdStr === userIdStr) {
      message.read = true;
      await message.save();
    }

    await populateMessage(message);

    const thread = await Message.find({
      $or: [
        { senderId: message.senderId, recipientId: message.recipientId },
        { senderId: message.recipientId, recipientId: message.senderId },
      ],
    })
      .sort({ createdAt: 1 })
      .populate("senderId", "email")
      .populate("recipientId", "email")
      .populate({
        path: "replyToId",
        populate: [
          { path: "senderId", select: "email" },
          { path: "recipientId", select: "email" },
        ],
      });

    return sendSuccess(res, { message, thread }, "Message retrieved");
  } catch (err) {
    console.error(err);
    return sendError(
      res,
      ErrorCodes.INTERNAL,
      "Failed to retrieve message",
      null,
      500,
    );
  }
};

// Reply to a message
exports.replyToMessage = async (req, res) => {
  try {
    const { id } = req.params;
    const { body } = req.body;
    if (!body) {
      return sendError(res, ErrorCodes.VALIDATION, "body required", null, 400);
    }

    const original = await Message.findById(id);
    if (!original) {
      return sendError(
        res,
        ErrorCodes.NOT_FOUND,
        "Original message not found",
        null,
        404,
      );
    }

    const recipientIdStr = original.recipientId
      ? original.recipientId.toString()
      : "";
    const senderIdStr = original.senderId ? original.senderId.toString() : "";
    const userIdStr = req.user.id.toString();

    if (recipientIdStr !== userIdStr && senderIdStr !== userIdStr) {
      // Do not reveal that the original message exists
      return sendError(
        res,
        ErrorCodes.NOT_FOUND,
        "Original message not found",
        null,
        404,
      );
    }

    const newRecipientId =
      senderIdStr === userIdStr ? original.recipientId : original.senderId;
    const reply = new Message({
      senderId: req.user.id,
      recipientId: newRecipientId,
      subject: original.subject.startsWith("Re:")
        ? original.subject
        : `Re: ${original.subject}`,
      body,
      replyToId: original._id,
    });
    await reply.save();

    await createNotification({
      userId: newRecipientId,
      type: "MESSAGE_RECEIVED",
      title: "Reply to your message",
      message: original.subject,
      data: { messageId: reply._id },
    });

    return sendSuccess(res, { messageId: reply._id }, "Reply sent");
  } catch (err) {
    console.error(err);
    return sendError(
      res,
      ErrorCodes.INTERNAL,
      "Failed to send reply",
      null,
      500,
    );
  }
};
