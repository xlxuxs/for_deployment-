const dotenv = require("dotenv");
dotenv.config();

const express = require("express");
const cors = require("cors");
const helmet = require("helmet");
const http = require("http");
const socketIo = require("socket.io");
const mongoose = require("mongoose");
const jwt = require("jsonwebtoken");
const connectDB = require("./src/config/db");
const redisClient = require("./src/config/redis");
const requestLogger = require("./src/middleware/requestLogger");
const limiters = require("./src/config/rateLimits");
const { setSocketIO } = require("./src/services/notificationService");
const {
  startEmergingTopicsWorker,
} = require("./src/workers/emergingTopicsWorker");
const {
  sanitizeInput,
  preventNoSqlInjection,
} = require("./src/middleware/security");

connectDB();

const app = express();

// Security headers
app.use(helmet());

function parseOrigins(value) {
  return (value || "")
    .split(",")
    .map((origin) => origin.trim())
    .filter(Boolean);
}

const allowedOrigins = Array.from(
  new Set([
    ...parseOrigins(process.env.CORS_ORIGINS),
    ...(process.env.FRONTEND_URL ? [process.env.FRONTEND_URL.trim()] : []),
    "http://localhost:3000",
    "http://localhost:5173",
    "http://localhost:5174",
  ]),
);

app.use(
  cors({
    origin: (origin, callback) => {
      if (!origin || allowedOrigins.includes(origin)) {
        callback(null, true);
      } else {
        callback(null, false);
      }
    },
    credentials: true,
  }),
);

// Body parsing with size limit
app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true, limit: "10mb" }));

// NoSQL injection protection (removes $ and . from keys)
app.use(preventNoSqlInjection);

// Global input sanitisation (body, query, params)
app.use(sanitizeInput);

// Request logger
app.use(requestLogger);

// Global rate limiter for API
app.use("/api", limiters.global);

// Health check
app.get("/health", (req, res) => {
  res.json({ status: "ok", timestamp: new Date().toISOString() });
});

// ========== API ROUTES ==========
app.use("/api/auth", require("./src/routes/authRoutes"));
app.use("/api/policies", require("./src/routes/policyRoutes"));
app.use("/api/votes", require("./src/routes/voteRoutes"));
app.use("/api/comments", require("./src/routes/commentRoutes"));
app.use("/api/analytics", require("./src/routes/analyticsRoutes"));
app.use("/api/sms", require("./src/routes/smsRoutes"));
app.use("/api/sms/mock", require("./src/routes/smsMockRoutes"));
app.use("/api/admin", require("./src/routes/adminRoutes"));
app.use("/api/users", require("./src/routes/userRoutes"));
app.use("/api/planners", require("./src/routes/plannerRoutes"));
app.use("/api/messages", require("./src/routes/messageRoutes"));
app.use("/api/feed", require("./src/routes/feedRoutes"));
app.use("/api/translate", require("./src/routes/translationRoutes"));
app.use("/api/public", require("./src/routes/publicRoutes"));

// ========== SOCKET.IO ==========
const server = http.createServer(app);
const io = socketIo(server, {
  cors: { origin: allowedOrigins, credentials: true },
});
setSocketIO(io);

io.on("connection", (socket) => {
  const handshakeUserId = socket.handshake.auth?.userId;
  const token = socket.handshake.auth?.token;
  let socketUserId = handshakeUserId;

  if (token) {
    try {
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      socketUserId = decoded.id;
      if (handshakeUserId && handshakeUserId !== socketUserId) {
        console.warn(
          `Socket userId mismatch: handshake=${handshakeUserId}, token=${socketUserId}`,
        );
      }
    } catch (err) {
      console.warn(
        `Socket token verification failed for handshake user ${handshakeUserId}: ${err.message}`,
      );
    }
  }

  if (socketUserId) {
    socket.join(`user:${socketUserId}`);
    console.log(`Socket connected for user ${socketUserId}`);
  } else {
    console.warn("Socket connected without a user identity");
  }
  socket.on("disconnect", () => console.log("Socket disconnected"));
});

// ========== WORKERS ==========
const { startWorker, stopWorker } = require("./src/workers/aiWorker");
const { startAutoCloseWorker } = require("./src/workers/autoCloseWorker");
const { startAutoActivateWorker } = require("./src/workers/autoActivateWorker");
const { startAutoRetryWorker } = require("./src/workers/autoRetryWorker");
const { startCleanupWorker } = require("./src/workers/cleanupUnverifiedUsers");
const {
  startExpireInvitationsWorker,
} = require("./src/workers/expireInvitationsWorker");
const {
  startRemindExpiringInvitationsWorker,
} = require("./src/workers/remindExpiringInvitationsWorker");

startWorker();
startAutoCloseWorker();
startAutoActivateWorker();
startEmergingTopicsWorker();
startAutoRetryWorker();
startCleanupWorker();
startExpireInvitationsWorker();
startRemindExpiringInvitationsWorker();

const PORT = process.env.PORT || 5000;
server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});

// Graceful shutdown
process.on("SIGINT", () => {
  console.log("Shutting down gracefully...");
  stopWorker();
  redisClient.quit();
  mongoose.connection.close();
  server.close(() => process.exit(0));
});
