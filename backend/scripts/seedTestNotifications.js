const mongoose = require("mongoose");
const path = require("path");
const bcrypt = require("bcryptjs");
require("dotenv").config({ path: path.join(__dirname, "../.env") });

const User = require("../src/models/User");
const Notification = require("../src/models/Notification");

const MONGO_URI =
  process.env.MONGO_URI || "mongodb://localhost:27017/communityinsight";
const DEFAULT_PASSWORD = "Pass123!";
const PHONE_HASH_PREFIX = "seed-test-notif";

const TARGET_EMAILS = [
  "citizen.addi.0001@demo.abrowork.com",
  "citizen.addi.0002@demo.abrowork.com",
];

const NOTIFICATION_TYPES = [
  "COMMENT_REPLY",
  "COMMENT_FLAGGED",
  "COMMENT_HIDDEN",
  "COMMENT_APPEAL",
  "APPEAL_RESOLVED",
  "POLICY_ACTIVATED",
  "POLICY_CLOSED",
  "POLICY_EXTENDED",
  "VOTE_SURGE",
  "EMERGING_TOPIC",
];

function buildNotification({ userId, userRole, index }) {
  const type = NOTIFICATION_TYPES[index % NOTIFICATION_TYPES.length];
  return {
    userId,
    userRole,
    type,
    title: `Test notification ${index + 1}`,
    message: `Seeded test notification ${index + 1} for ${type.toLowerCase().replace(/_/g, " ")}.`,
    data: {
      seededBy: "seedTestNotifications",
      seededFor: userId.toString(),
      ordinal: index + 1,
    },
    read: index % 2 === 0,
    severity: index === 0 ? "warning" : "info",
    source: "system",
  };
}

async function seedTestNotifications() {
  await mongoose.connect(MONGO_URI, {
    serverSelectionTimeoutMS: 25000,
    connectTimeoutMS: 25000,
  });

  const passwordHash = await bcrypt.hash(DEFAULT_PASSWORD, 10);

  const users = await User.find({ email: { $in: TARGET_EMAILS } })
    .select("email role")
    .lean();

  const usersByEmail = new Map(users.map((user) => [user.email, user]));
  for (const [index, email] of TARGET_EMAILS.entries()) {
    if (!usersByEmail.has(email)) {
      const createdUser = await User.create({
        email,
        passwordHash,
        phoneHash: `${PHONE_HASH_PREFIX}:${index}:${Date.now()}`,
        region: "Addis Ababa",
        role: "citizen",
        verified: true,
        active: true,
        ageRange: "25-34",
        gender: "prefer-not-to-say",
        occupation: "other",
        education: "bachelors",
        preferredLanguage: "en",
        languagesSpoken: ["en"],
      });
      users.push(createdUser.toObject());
      usersByEmail.set(email, createdUser.toObject());
      console.log(`Created missing citizen user ${email}`);
    }
  }

  const foundEmails = new Set(users.map((user) => user.email));
  const missing = TARGET_EMAILS.filter((email) => !foundEmails.has(email));
  if (missing.length) {
    throw new Error(`Missing target users: ${missing.join(", ")}`);
  }

  for (const user of users) {
    await Notification.deleteMany({
      userId: user._id,
      "data.seededBy": "seedTestNotifications",
    });

    const notifications = Array.from({ length: 10 }, (_, index) =>
      buildNotification({
        userId: user._id,
        userRole: user.role,
        index,
      }),
    );

    await Notification.insertMany(notifications, { ordered: true });
    console.log(`Seeded 10 notifications for ${user.email}`);
  }

  await mongoose.disconnect();
}

seedTestNotifications().catch(async (error) => {
  console.error(error.message || error);
  try {
    await mongoose.disconnect();
  } catch {
    // ignore disconnect failures
  }
  process.exit(1);
});