const mongoose = require("mongoose");
const path = require("path");
require("dotenv").config({ path: path.join(__dirname, "../.env") });

const User = require("../src/models/User");
const Policy = require("../src/models/Policy");
const Comment = require("../src/models/Comment");
const { hashPassword, hashPhone } = require("../src/utils/helpers");

const MONGO_URI =
  process.env.MONGO_URI || "mongodb://localhost:27017/communityinsight";
const DEFAULT_PASSWORD = "Pass123!";
const SEED_PREFIX = "[MOD-LANG-SEED]";
const escapeRegex = (value) =>
  String(value).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

const baseCitizenProfile = {
  role: "citizen",
  verified: true,
  active: true,
  tokenVersion: 0,
};

const languageProfiles = [
  {
    code: "am",
    region: "Amhara",
    email: "modlang.citizen.am@test.com",
    phone: "+251910100001",
    ageRange: "25-34",
    gender: "female",
    occupation: "merchant",
    education: "diploma",
    preferredLanguage: "am",
    languagesSpoken: ["am", "en"],
    aiText:
      "[MOD-LANG-SEED] ይህ አስተያየት በትርጉም እና በቋንቋ ማጣሪያ ውስጥ እንዲታይ ለሙከራ ተፈጥሯል።",
    reportedText:
      "[MOD-LANG-SEED] ይህ የሪፖርት አስተያየት ለቋንቋ ማጣሪያ ሙከራ ተጨምሯል።",
    appealText:
      "[MOD-LANG-SEED] ይህ የይግባኝ አስተያየት በአማርኛ ለሙከራ ተዘጋጅቷል።",
    appealReason:
      "እባክዎ ይህን አስተያየት እንደገና ይመልከቱ፤ ለቋንቋ ማጣሪያ ሙከራ ብቻ ነው።",
  },
  {
    code: "om",
    region: "Oromia",
    email: "modlang.citizen.om@test.com",
    phone: "+251910100002",
    ageRange: "35-44",
    gender: "male",
    occupation: "farmer",
    education: "secondary",
    preferredLanguage: "om",
    languagesSpoken: ["om", "en"],
    aiText:
      "[MOD-LANG-SEED] Yaadni kun qofaaf qorannoo calaqqee afaanii fi tarreeffama moderation ti.",
    reportedText:
      "[MOD-LANG-SEED] Yaadni gabaafame kun qorannoo filter afaanii keessatti akka mul'atuuf uumameera.",
    appealText:
      "[MOD-LANG-SEED] Yaadni ol-iyyannoo kun afaan Oromootiin qophaa'eera.",
    appealReason:
      "Mee yaada kana irra deebi'anii ilaalaa; qofaaf qorannoo filter afaanii keessatti fayyada.",
  },
  {
    code: "ti",
    region: "Tigray",
    email: "modlang.citizen.ti@test.com",
    phone: "+251910100003",
    ageRange: "18-24",
    gender: "prefer-not-to-say",
    occupation: "student",
    education: "bachelors",
    preferredLanguage: "ti",
    languagesSpoken: ["ti", "en"],
    aiText:
      "[MOD-LANG-SEED] እዚ ርእይቶ ንምፍታሕ መጣርያ ቋንቋ ተዳልዩ ዘሎ ናይ ፈተና ሓበሬታ እዩ።",
    reportedText:
      "[MOD-LANG-SEED] እዚ ዝተሓበረ ርእይቶ ኣብ መጣርያ ቋንቋ ንፈተና ተወሲኑ እዩ።",
    appealText:
      "[MOD-LANG-SEED] እዚ ናይ ይግባኝ ርእይቶ ብትግርኛ ተዳልዩ እዩ።",
    appealReason:
      "በጃኹም እዚ ርእይቶ እንደገና ርአዩ፤ ንፈተና መጣርያ ቋንቋ ጥራይ እዩ።",
  },
];

const reporterProfiles = [
  {
    email: "modlang.reporter.one@test.com",
    phone: "+251910100011",
    region: "Addis Ababa",
    ageRange: "25-34",
    gender: "female",
    occupation: "government-employee",
    education: "postgraduate",
    preferredLanguage: "en",
    languagesSpoken: ["en", "am"],
  },
  {
    email: "modlang.reporter.two@test.com",
    phone: "+251910100012",
    region: "Oromia",
    ageRange: "35-44",
    gender: "male",
    occupation: "private-sector",
    education: "bachelors",
    preferredLanguage: "en",
    languagesSpoken: ["en", "om"],
  },
  {
    email: "modlang.reporter.three@test.com",
    phone: "+251910100013",
    region: "Tigray",
    ageRange: "45-54",
    gender: "female",
    occupation: "merchant",
    education: "secondary",
    preferredLanguage: "en",
    languagesSpoken: ["en", "ti"],
  },
];

async function upsertCitizen(profile, passwordHash) {
  const phoneHash = hashPhone(profile.phone);
  const update = {
    email: profile.email,
    passwordHash,
    phoneHash,
    region: profile.region,
    ageRange: profile.ageRange,
    gender: profile.gender,
    occupation: profile.occupation,
    education: profile.education,
    preferredLanguage: profile.preferredLanguage,
    languagesSpoken: profile.languagesSpoken,
    ...baseCitizenProfile,
  };

  return User.findOneAndUpdate(
    { email: profile.email },
    { $set: update, $setOnInsert: { createdAt: new Date() } },
    { returnDocument: "after", upsert: true, runValidators: true },
  );
}

function buildAiReviewComment({ citizen, policy, profile, createdAt }) {
  return {
    policyId: policy._id,
    userId: citizen._id,
    parentCommentId: null,
    region: citizen.region,
    text: profile.aiText,
    language: profile.code,
    visibility: "visible",
    aiStatus: "processed",
    sentiment: {
      label: "neutral",
      confidence: 0.46,
      overriddenByModerator: false,
    },
    keywords: ["seed", "moderation", profile.code],
    aiAnalysis: {
      raw: { seeded: true, category: "ai_review", language: profile.code },
      version: "seed-script",
      analyzedAt: createdAt,
    },
    lastAnalyzedAt: createdAt,
    reportState: "clean",
    reportCount: 0,
    reviewFlags: {
      sentimentReviewNeeded: true,
      moderationReviewNeeded: false,
    },
    events: [
      {
        type: "created",
        actor: citizen._id,
        data: { seeded: true, queue: "ai_review", language: profile.code },
        createdAt,
      },
      {
        type: "ai_analyzed",
        actor: null,
        data: {
          seeded: true,
          confidence: 0.46,
          reviewNeeded: true,
          language: profile.code,
        },
        createdAt,
      },
    ],
    createdAt,
    updatedAt: createdAt,
  };
}

function buildReportedComment({
  citizen,
  policy,
  profile,
  reporters,
  createdAt,
}) {
  const reports = reporters.map((reporter, index) => ({
    reporterId: reporter._id,
    reason: ["spam", "harassment", "misinformation"][index % 3],
    details: `${SEED_PREFIX} Report seeded for ${profile.code} language moderation filter.`,
    status: index === reporters.length - 1 ? "pending" : "valid",
    createdAt: new Date(createdAt.getTime() + (index + 1) * 60 * 1000),
    snapshot: {
      text: profile.reportedText,
      sentiment: { label: "negative", confidence: 0.91 },
      keywords: ["seed", "reported", profile.code],
      visibility: "hidden",
      aiStatus: "processed",
      reportCount: index + 1,
    },
  }));

  return {
    policyId: policy._id,
    userId: citizen._id,
    parentCommentId: null,
    region: citizen.region,
    text: profile.reportedText,
    language: profile.code,
    visibility: "hidden",
    aiStatus: "processed",
    sentiment: {
      label: "negative",
      confidence: 0.91,
      overriddenByModerator: false,
    },
    keywords: ["seed", "reported", profile.code],
    aiAnalysis: {
      raw: { seeded: true, category: "reported", language: profile.code },
      version: "seed-script",
      analyzedAt: createdAt,
    },
    lastAnalyzedAt: createdAt,
    reportState: "under_review",
    reportCount: reports.length,
    reports,
    moderationReason: "auto_hide_reports",
    moderationActions: [
      {
        action: "hide",
        reason: "auto_hide_reports",
        actor: null,
        createdAt,
      },
    ],
    reviewFlags: {
      sentimentReviewNeeded: false,
      moderationReviewNeeded: true,
    },
    events: [
      {
        type: "created",
        actor: citizen._id,
        data: { seeded: true, queue: "reported", language: profile.code },
        createdAt,
      },
      {
        type: "reported",
        actor: reporters[0]?._id || null,
        data: { seeded: true, reportCount: reports.length, language: profile.code },
        createdAt: new Date(createdAt.getTime() + 5 * 60 * 1000),
      },
    ],
    createdAt,
    updatedAt: createdAt,
  };
}

function buildAppealComment({ citizen, policy, profile, createdAt }) {
  return {
    policyId: policy._id,
    userId: citizen._id,
    parentCommentId: null,
    region: citizen.region,
    text: profile.appealText,
    language: profile.code,
    visibility: "hidden",
    aiStatus: "processed",
    sentiment: {
      label: "neutral",
      confidence: 0.82,
      overriddenByModerator: false,
    },
    keywords: ["seed", "appeal", profile.code],
    aiAnalysis: {
      raw: { seeded: true, category: "appeal", language: profile.code },
      version: "seed-script",
      analyzedAt: createdAt,
    },
    lastAnalyzedAt: createdAt,
    reportState: "actioned",
    reportCount: 0,
    moderationReason: "manual_moderation_seed",
    moderationActions: [
      {
        action: "hide",
        reason: "manual_moderation_seed",
        actor: null,
        createdAt,
      },
    ],
    appeal: {
      appellantId: citizen._id,
      reason: profile.appealReason,
      details: `${SEED_PREFIX} Pending appeal seeded for language filter testing.`,
      status: "pending",
      createdAt: new Date(createdAt.getTime() + 10 * 60 * 1000),
      snapshot: {
        text: profile.appealText,
        visibility: "hidden",
        reportState: "actioned",
        reportCount: 0,
      },
    },
    reviewFlags: {
      sentimentReviewNeeded: false,
      moderationReviewNeeded: false,
    },
    events: [
      {
        type: "created",
        actor: citizen._id,
        data: { seeded: true, queue: "appeal", language: profile.code },
        createdAt,
      },
      {
        type: "appealed",
        actor: citizen._id,
        data: { seeded: true, language: profile.code },
        createdAt: new Date(createdAt.getTime() + 10 * 60 * 1000),
      },
    ],
    createdAt,
    updatedAt: createdAt,
  };
}

async function seedModerationLanguageComments() {
  try {
    console.log("Connecting to MongoDB...");
    await mongoose.connect(MONGO_URI);
    console.log("Connected.");

    const passwordHash = await hashPassword(DEFAULT_PASSWORD);
    const policies = await Policy.find({}).sort({ createdAt: 1 }).limit(3);

    if (policies.length === 0) {
      throw new Error(
        "No policies found. Seed policies first before adding moderation language comments.",
      );
    }

    console.log("Upserting seed citizens and reporters...");
    const citizens = [];
    for (const profile of languageProfiles) {
      citizens.push(await upsertCitizen(profile, passwordHash));
    }

    const reporters = [];
    for (const profile of reporterProfiles) {
      reporters.push(await upsertCitizen(profile, passwordHash));
    }

    console.log("Removing prior moderation language seed comments...");
    const deleteResult = await Comment.deleteMany({
      text: { $regex: `^${escapeRegex(SEED_PREFIX)}` },
    });
    console.log(`Removed ${deleteResult.deletedCount} previous seed comments.`);

    console.log("Creating multilingual moderation comments...");
    const docs = [];
    languageProfiles.forEach((profile, index) => {
      const citizen = citizens[index];
      const aiPolicy = policies[index % policies.length];
      const reportedPolicy = policies[(index + 1) % policies.length];
      const appealPolicy = policies[(index + 2) % policies.length];
      const baseTime = new Date(Date.now() - (index + 1) * 60 * 60 * 1000);

      docs.push(
        buildAiReviewComment({
          citizen,
          policy: aiPolicy,
          profile,
          createdAt: baseTime,
        }),
      );
      docs.push(
        buildReportedComment({
          citizen,
          policy: reportedPolicy,
          profile,
          reporters,
          createdAt: new Date(baseTime.getTime() + 15 * 60 * 1000),
        }),
      );
      docs.push(
        buildAppealComment({
          citizen,
          policy: appealPolicy,
          profile,
          createdAt: new Date(baseTime.getTime() + 30 * 60 * 1000),
        }),
      );
    });

    const inserted = await Comment.insertMany(docs);

    const counts = inserted.reduce(
      (acc, comment) => {
        if (comment.reviewFlags?.sentimentReviewNeeded) acc.ai += 1;
        else if (comment.appeal?.status === "pending") acc.appeal += 1;
        else if (["reported", "under_review"].includes(comment.reportState)) acc.reported += 1;
        return acc;
      },
      { ai: 0, reported: 0, appeal: 0 },
    );

    console.log("Seed complete.");
    console.log(
      `Inserted ${inserted.length} comments: ${counts.ai} AI review, ${counts.reported} reported, ${counts.appeal} appeal.`,
    );
    console.log(
      `Languages seeded across all queues: ${languageProfiles.map((item) => item.code).join(", ")}.`,
    );
  } catch (error) {
    console.error("Error seeding moderation language comments:", error);
    process.exitCode = 1;
  } finally {
    await mongoose.disconnect();
    console.log("MongoDB disconnected.");
  }
}

seedModerationLanguageComments();
