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
    aiTexts: [
      `${SEED_PREFIX} [AI-1] ይህ አስተያየት በትርጉም እና በቋንቋ ማጣሪያ ውስጥ እንዲታይ ለሙከራ ተፈጥሯል።`,
      `${SEED_PREFIX} [AI-2] ይህ ሌላ ዝቅተኛ እምነት ያለው የAI አስተያየት በአማርኛ ነው።`,
    ],
    reportedTexts: [
      `${SEED_PREFIX} [REP-1] ይህ የሪፖርት አስተያየት ለቋንቋ ማጣሪያ ሙከራ ተጨምሯል።`,
      `${SEED_PREFIX} [REP-2] ይህ ተጨማሪ የተዘገበ አስተያየት በአማርኛ ለማጣሪያ ነው።`,
    ],
    appeals: [
      {
        text: `${SEED_PREFIX} [APL-1] ይህ የይግባኝ አስተያየት በአማርኛ ለሙከራ ተዘጋጅቷል።`,
        reason:
          "እባክዎ ይህን አስተያየት እንደገና ይመልከቱ፤ ለቋንቋ ማጣሪያ ሙከራ ብቻ ነው።",
      },
      {
        text: `${SEED_PREFIX} [APL-2] ይህ ሁለተኛ የይግባኝ አስተያየት በአማርኛ ነው።`,
        reason:
          "ይህን የተደበቀ አስተያየት እንደገና ይፈትሹ፤ የቋንቋ ማጣሪያ ሙከራ ነው።",
      },
    ],
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
    aiTexts: [
      `${SEED_PREFIX} [AI-1] Yaadni kun qofaaf qorannoo calaqqee afaanii fi tarreeffama moderation ti.`,
      `${SEED_PREFIX} [AI-2] Yaadni AI kun amantii gadi aanaa qaba; filter afaanii Oromoon akka hojjetuuf dha.`,
    ],
    reportedTexts: [
      `${SEED_PREFIX} [REP-1] Yaadni gabaafame kun qorannoo filter afaanii keessatti akka mul'atuuf uumameera.`,
      `${SEED_PREFIX} [REP-2] Yaadni gabaafame dabalataa kun afaan Oromootiin qophaa'eera.`,
    ],
    appeals: [
      {
        text: `${SEED_PREFIX} [APL-1] Yaadni ol-iyyannoo kun afaan Oromootiin qophaa'eera.`,
        reason:
          "Mee yaada kana irra deebi'anii ilaalaa; qofaaf qorannoo filter afaanii keessatti fayyada.",
      },
      {
        text: `${SEED_PREFIX} [APL-2] Kun yaada ol-iyyannoo dabalataa afaan Oromootiin barreeffame dha.`,
        reason:
          "Mee yaada dhokfame kana irra deebi'aa qoradhaa; qorannoo afaanii qofaaf itti fayyadamaa jirra.",
      },
    ],
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
    aiTexts: [
      `${SEED_PREFIX} [AI-1] እዚ ርእይቶ ንምፍታሕ መጣርያ ቋንቋ ተዳልዩ ዘሎ ናይ ፈተና ሓበሬታ እዩ።`,
      `${SEED_PREFIX} [AI-2] እዚ ካልእ ናይ AI ዝተሓተ እምነት ዘለዎ ርእይቶ ብትግርኛ እዩ።`,
    ],
    reportedTexts: [
      `${SEED_PREFIX} [REP-1] እዚ ዝተሓበረ ርእይቶ ኣብ መጣርያ ቋንቋ ንፈተና ተወሲኑ እዩ።`,
      `${SEED_PREFIX} [REP-2] እዚ ተወሳኺ ዝተሓበረ ርእይቶ ብትግርኛ ተዳልዩ እዩ።`,
    ],
    appeals: [
      {
        text: `${SEED_PREFIX} [APL-1] እዚ ናይ ይግባኝ ርእይቶ ብትግርኛ ተዳልዩ እዩ።`,
        reason:
          "በጃኹም እዚ ርእይቶ እንደገና ርአዩ፤ ንፈተና መጣርያ ቋንቋ ጥራይ እዩ።",
      },
      {
        text: `${SEED_PREFIX} [APL-2] እዚ ተወሳኺ ናይ ይግባኝ ርእይቶ ብትግርኛ እዩ።`,
        reason:
          "በጃኹም እዚ ዝተደበቐ ርእይቶ እንደገና መርምሩ፤ ናይ ቋንቋ ፈተና እዩ።",
      },
    ],
  },
  {
    code: "en",
    region: "Addis Ababa",
    email: "modlang.citizen.en@test.com",
    phone: "+251910100004",
    ageRange: "45-54",
    gender: "female",
    occupation: "government-employee",
    education: "postgraduate",
    preferredLanguage: "en",
    languagesSpoken: ["en", "am"],
    aiTexts: [
      `${SEED_PREFIX} [AI-1] This English comment is seeded for the AI review language filter.`,
      `${SEED_PREFIX} [AI-2] Another English low-confidence moderation comment for queue testing.`,
    ],
    reportedTexts: [
      `${SEED_PREFIX} [REP-1] This reported English comment is seeded for moderator filtering.`,
      `${SEED_PREFIX} [REP-2] Another reported English comment for the hidden moderation queue.`,
    ],
    appeals: [
      {
        text: `${SEED_PREFIX} [APL-1] This English appeal comment is waiting for moderation review.`,
        reason:
          "Please review this hidden comment again; it exists to test appeal filtering by language.",
      },
      {
        text: `${SEED_PREFIX} [APL-2] This is a second English appeal comment for queue coverage.`,
        reason:
          "Please reconsider this comment; it was seeded to strengthen English appeal filter testing.",
      },
    ],
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

async function upsertCommentByText(text, document) {
  await Comment.findOneAndUpdate(
    { text },
    { $set: document, $setOnInsert: { createdAt: document.createdAt } },
    { upsert: true, runValidators: true },
  );
}

function buildAiReviewComment({ citizen, policy, profile, text, createdAt, batch }) {
  return {
    policyId: policy._id,
    userId: citizen._id,
    parentCommentId: null,
    region: citizen.region,
    text,
    language: profile.code,
    visibility: "visible",
    aiStatus: "processed",
    sentiment: {
      label: "neutral",
      confidence: 0.46,
      overriddenByModerator: false,
    },
    keywords: ["seed", "moderation", "ai-review", profile.code, `batch-${batch}`],
    aiAnalysis: {
      raw: {
        seeded: true,
        category: "ai_review",
        language: profile.code,
        batch,
      },
      version: "seed-script-v2",
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
        data: { seeded: true, queue: "ai_review", language: profile.code, batch },
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
          batch,
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
  text,
  createdAt,
  batch,
}) {
  const reports = reporters.map((reporter, index) => ({
    reporterId: reporter._id,
    reason: ["spam", "harassment", "misinformation"][index % 3],
    details: `${SEED_PREFIX} Report seeded for ${profile.code} language moderation filter batch ${batch}.`,
    status: index === reporters.length - 1 ? "pending" : "valid",
    createdAt: new Date(createdAt.getTime() + (index + 1) * 60 * 1000),
    snapshot: {
      text,
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
    text,
    language: profile.code,
    visibility: "hidden",
    aiStatus: "processed",
    sentiment: {
      label: "negative",
      confidence: 0.91,
      overriddenByModerator: false,
    },
    keywords: ["seed", "reported", profile.code, `batch-${batch}`],
    aiAnalysis: {
      raw: { seeded: true, category: "reported", language: profile.code, batch },
      version: "seed-script-v2",
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
        data: { seeded: true, queue: "reported", language: profile.code, batch },
        createdAt,
      },
      {
        type: "reported",
        actor: reporters[0]?._id || null,
        data: {
          seeded: true,
          reportCount: reports.length,
          language: profile.code,
          batch,
        },
        createdAt: new Date(createdAt.getTime() + 5 * 60 * 1000),
      },
    ],
    createdAt,
    updatedAt: createdAt,
  };
}

function buildAppealComment({
  citizen,
  policy,
  profile,
  text,
  reason,
  createdAt,
  batch,
}) {
  return {
    policyId: policy._id,
    userId: citizen._id,
    parentCommentId: null,
    region: citizen.region,
    text,
    language: profile.code,
    visibility: "hidden",
    aiStatus: "processed",
    sentiment: {
      label: "neutral",
      confidence: 0.82,
      overriddenByModerator: false,
    },
    keywords: ["seed", "appeal", profile.code, `batch-${batch}`],
    aiAnalysis: {
      raw: { seeded: true, category: "appeal", language: profile.code, batch },
      version: "seed-script-v2",
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
      reason,
      details: `${SEED_PREFIX} Pending appeal seeded for language filter testing batch ${batch}.`,
      status: "pending",
      createdAt: new Date(createdAt.getTime() + 10 * 60 * 1000),
      snapshot: {
        text,
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
        data: { seeded: true, queue: "appeal", language: profile.code, batch },
        createdAt,
      },
      {
        type: "appealed",
        actor: citizen._id,
        data: { seeded: true, language: profile.code, batch },
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
    const policies = await Policy.find({}).sort({ createdAt: 1 }).limit(4);

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

    console.log("Upserting multilingual moderation comments on top of existing data...");
    let aiCount = 0;
    let reportedCount = 0;
    let appealCount = 0;

    for (let index = 0; index < languageProfiles.length; index += 1) {
      const profile = languageProfiles[index];
      const citizen = citizens[index];

      for (let batch = 0; batch < profile.aiTexts.length; batch += 1) {
        const createdAt = new Date(Date.now() - ((index * 6 + batch + 1) * 10 * 60 * 1000));
        const aiPolicy = policies[(index + batch) % policies.length];
        const reportedPolicy = policies[(index + batch + 1) % policies.length];
        const appealPolicy = policies[(index + batch + 2) % policies.length];

        await upsertCommentByText(
          profile.aiTexts[batch],
          buildAiReviewComment({
            citizen,
            policy: aiPolicy,
            profile,
            text: profile.aiTexts[batch],
            createdAt,
            batch: batch + 1,
          }),
        );
        aiCount += 1;

        await upsertCommentByText(
          profile.reportedTexts[batch],
          buildReportedComment({
            citizen,
            policy: reportedPolicy,
            profile,
            reporters,
            text: profile.reportedTexts[batch],
            createdAt: new Date(createdAt.getTime() + 2 * 60 * 1000),
            batch: batch + 1,
          }),
        );
        reportedCount += 1;

        await upsertCommentByText(
          profile.appeals[batch].text,
          buildAppealComment({
            citizen,
            policy: appealPolicy,
            profile,
            text: profile.appeals[batch].text,
            reason: profile.appeals[batch].reason,
            createdAt: new Date(createdAt.getTime() + 4 * 60 * 1000),
            batch: batch + 1,
          }),
        );
        appealCount += 1;
      }
    }

    const queueCounts = {
      ai: await Comment.countDocuments({
        visibility: "visible",
        $or: [
          { "reviewFlags.sentimentReviewNeeded": true },
          { aiStatus: "pending", lastAnalyzedAt: { $ne: null } },
        ],
      }),
      reported: await Comment.countDocuments({
        reportState: { $in: ["reported", "under_review"] },
        visibility: "hidden",
      }),
      appeals: await Comment.countDocuments({ "appeal.status": "pending" }),
    };

    console.log("Seed complete.");
    console.log(
      `Upserted ${aiCount} AI-review, ${reportedCount} reported, and ${appealCount} pending-appeal multilingual comments.`,
    );
    console.log(
      `Current moderation queue totals: AI=${queueCounts.ai}, Reported=${queueCounts.reported}, Appeals=${queueCounts.appeals}.`,
    );
    console.log(
      `Languages covered: ${languageProfiles.map((item) => item.code).join(", ")}.`,
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
