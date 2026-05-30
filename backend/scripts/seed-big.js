const mongoose = require("mongoose");
const jwt = require("jsonwebtoken");
const { customAlphabet } = require("nanoid");
const path = require("path");
const fs = require("fs");
require("dotenv").config({ path: path.join(__dirname, "../.env") });

// Models
const User = require("../src/models/User");
const Policy = require("../src/models/Policy");
const Vote = require("../src/models/Vote");
const Comment = require("../src/models/Comment");
const Notification = require("../src/models/Notification");
const AuditLog = require("../src/models/AuditLog");
const SmsSubscription = require("../src/models/SmsSubscription");
const PlannerRequest = require("../src/models/PlannerRequest");
const PolicyAssociate = require("../src/models/PolicyAssociate");

const { hashPhone, hashPassword } = require("../src/utils/helpers");

const MONGO_URI =
  process.env.MONGO_URI || "mongodb://localhost:27017/communityinsight";
const DEFAULT_PASSWORD = "Pass123!";
const JWT_SECRET = process.env.JWT_SECRET;
if (!JWT_SECRET) {
  console.error("JWT_SECRET not defined in .env");
  process.exit(1);
}

const nanoid = customAlphabet("ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789", 6);
const generatePolicyCode = (title) => {
  const prefix = title
    .replace(/[^a-zA-Z0-9]/g, "")
    .substring(0, 4)
    .toUpperCase();
  const id = nanoid();
  return `${prefix}${id}`;
};

const randomItem = (arr) => arr[Math.floor(Math.random() * arr.length)];
const randomInt = (min, max) =>
  Math.floor(Math.random() * (max - min + 1)) + min;

const regions = [
  "Addis Ababa",
  "Oromia",
  "Amhara",
  "Tigray",
  "SNNPR",
  "Sidama",
  "Harari",
  "Gambela",
  "Benishangul-Gumuz",
  "Afar",
  "Somali",
];
const ageRanges = ["18-24", "25-34", "35-44", "45-54", "55+"];
const genders = ["male", "female", "non-binary", "prefer-not-to-say"];
const occupations = [
  "student",
  "farmer",
  "merchant",
  "government-employee",
  "private-sector",
  "unemployed",
  "other",
];
const educations = [
  "no-formal",
  "primary",
  "secondary",
  "diploma",
  "bachelors",
  "postgraduate",
];

const plannerData = [
  {
    email: "planner1@test.com",
    region: "Addis Ababa",
    ageRange: "35-44",
    gender: "male",
    occupation: "government-employee",
    education: "postgraduate",
    languagesSpoken: ["am", "en"],
  },
  {
    email: "planner2@test.com",
    region: "Oromia",
    ageRange: "25-34",
    gender: "female",
    occupation: "government-employee",
    education: "bachelors",
    languagesSpoken: ["om", "en"],
  },
  {
    email: "planner3@test.com",
    region: "Tigray",
    ageRange: "45-54",
    gender: "male",
    occupation: "private-sector",
    education: "bachelors",
    languagesSpoken: ["ti", "en"],
  },
  {
    email: "planner4@test.com",
    region: "Amhara",
    ageRange: "25-34",
    gender: "female",
    occupation: "student",
    education: "bachelors",
    languagesSpoken: ["am", "en"],
  },
  {
    email: "planner5@test.com",
    region: "Addis Ababa",
    ageRange: "35-44",
    gender: "non-binary",
    occupation: "private-sector",
    education: "postgraduate",
    languagesSpoken: ["en", "am"],
  },
];

const CITIZEN_COUNT = 120;

const generateVoteValue = (pollType, policy) => {
  const options = policy.pollOptions || [];
  switch (pollType) {
    case "binary":
      return randomItem(["yes", "no"]);
    case "multipleChoice": {
      const maxSel = policy.maxSelections || 1;
      const ids = options.map((o) => o.id);
      if (!ids.length) return [];
      const num = randomInt(1, Math.min(maxSel, ids.length));
      const shuffled = [...ids].sort(() => 0.5 - Math.random());
      return shuffled.slice(0, num);
    }
    case "likert":
      return randomInt(1, 5);
    case "approval":
      return randomItem(["approve", "reject", "abstain"]);
    case "rating":
      return randomInt(1, 5);
    case "rankedChoice": {
      const ids = options.map((o) => o.id);
      if (!ids.length) return [];
      const shuffled = [...ids].sort(() => 0.5 - Math.random());
      const maxRank = policy.rankedChoiceMaxRank || 3;
      return shuffled.slice(0, maxRank);
    }
    default:
      return 3;
  }
};

const policyDefinitions = [
  {
    title: "Binary: Agricultural Subsidies",
    description:
      "Should the government increase subsidies for smallholder farmers?",
    targetRegions: ["Addis Ababa", "Oromia", "Amhara"],
    pollType: "binary",
    startDate: new Date(Date.now() - 60 * 86400000),
    endDate: new Date(Date.now() + 30 * 86400000),
    status: "active",
    topics: ["Agriculture", "Economy"],
    relevanceFactors: { farmers: true },
  },
  {
    title: "Multiple Choice: Infrastructure Priorities",
    description:
      "Which infrastructure projects should receive the most funding? (Select up to 2)",
    targetRegions: ["Addis Ababa", "Oromia", "Tigray"],
    pollType: "multipleChoice",
    pollOptions: [
      { id: "road", text: "Roads" },
      { id: "rail", text: "Railways" },
      { id: "digital", text: "Digital infrastructure" },
      { id: "water", text: "Water supply" },
    ],
    maxSelections: 2,
    startDate: new Date(Date.now() - 90 * 86400000),
    endDate: new Date(Date.now() + 45 * 86400000),
    status: "active",
    topics: ["Infrastructure", "Transport"],
    relevanceFactors: { urban: true, rural: true },
  },
  {
    title: "Likert: Government Performance",
    description: "Rate the government's performance in the last year.",
    targetRegions: ["All"],
    pollType: "likert",
    likertLabels: ["Very Poor", "Poor", "Average", "Good", "Excellent"],
    startDate: new Date(Date.now() - 120 * 86400000),
    endDate: new Date(Date.now() + 20 * 86400000),
    status: "active",
    topics: ["Government", "Economy"],
    relevanceFactors: {},
  },
  {
    title: "Approval: New Tax Reform",
    description:
      "Do you approve, reject, or abstain from the proposed tax reform?",
    targetRegions: ["Addis Ababa", "Oromia"],
    pollType: "approval",
    startDate: new Date(Date.now() - 80 * 86400000),
    endDate: new Date(Date.now() + 60 * 86400000),
    status: "active",
    topics: ["Taxation", "Economy"],
    relevanceFactors: { privateSector: true, government: true },
  },
  {
    title: "Rating: Public Transport",
    description: "Rate the public transportation system in your city.",
    targetRegions: ["Addis Ababa"],
    pollType: "rating",
    startDate: new Date(Date.now() - 30 * 86400000),
    endDate: new Date(Date.now() + 90 * 86400000),
    status: "active",
    topics: ["Transport", "Infrastructure"],
    relevanceFactors: { urban: true },
  },
];

const commentTextsPositive = [
  "Great policy!",
  "I fully support this.",
  "Excellent initiative.",
  "Well thought out.",
  "Finally something good.",
];
const commentTextsNegative = [
  "This is terrible.",
  "I oppose this.",
  "Waste of resources.",
  "Poorly designed.",
  "Will not work.",
];
const commentTextsNeutral = [
  "Not sure yet.",
  "Need more information.",
  "We'll see.",
  "Some pros and cons.",
  "Neutral on this.",
];

const randomComment = (sentimentLabel) => {
  const list =
    sentimentLabel === "positive"
      ? commentTextsPositive
      : sentimentLabel === "negative"
        ? commentTextsNegative
        : commentTextsNeutral;
  return randomItem(list);
};

const keywordMap = {
  Agriculture: ["subsidies", "farming", "crops", "irrigation", "harvest"],
  Economy: ["jobs", "growth", "inflation", "taxes", "investment"],
  Infrastructure: [
    "roads",
    "bridges",
    "internet",
    "electricity",
    "construction",
  ],
  Transport: ["buses", "trains", "traffic", "railways", "commute"],
  Government: ["leadership", "policy", "corruption", "services", "bureaucracy"],
  Taxation: ["tax", "revenue", "burden", "fairness", "collection"],
  Water: ["supply", "sanitation", "drought", "irrigation", "pipes"],
  Health: ["hospitals", "medicine", "doctors", "insurance", "clinics"],
  Education: ["schools", "teachers", "students", "curriculum", "books"],
  default: ["policy", "change", "improvement", "need", "community"],
};

const getRandomKeywords = (topics) => {
  const pool =
    topics && topics.length
      ? keywordMap[topics[0]] || keywordMap.default
      : keywordMap.default;
  const num = randomInt(1, 3);
  const shuffled = [...pool].sort(() => 0.5 - Math.random());
  return shuffled.slice(0, num);
};

async function seed() {
  try {
    console.log("Connecting to MongoDB...");
    await mongoose.connect(MONGO_URI);
    console.log("Connected.");

    console.log("Cleaning up existing citizens and planners...");
    await User.deleteMany({ role: { $in: ["citizen", "planner"] } });
    await Policy.deleteMany({});
    await Vote.deleteMany({});
    await Comment.deleteMany({});
    await Notification.deleteMany({});
    await AuditLog.deleteMany({});
    await SmsSubscription.deleteMany({});
    await PlannerRequest.deleteMany({});
    await PolicyAssociate.deleteMany({});
    console.log("Cleanup done.");

    // Admin
    let admin = await User.findOne({ email: "admin@test.com" });
    if (!admin) {
      const adminHash = await hashPassword("Admin@123");
      admin = new User({
        email: "admin@test.com",
        passwordHash: adminHash,
        phoneHash: hashPhone("+251911111111"),
        region: "Addis Ababa",
        ageRange: "35-44",
        gender: "male",
        occupation: "government-employee",
        education: "postgraduate",
        role: "admin",
        verified: true,
        active: true,
        tokenVersion: 0,
      });
      await admin.save();
      console.log("Admin created (admin@test.com).");
    } else {
      console.log("Admin already exists, skipping creation.");
    }

    const passwordHash = await hashPassword(DEFAULT_PASSWORD);
    for (const data of plannerData) {
      const phoneHash = `planner_dummy_${data.email.split("@")[0]}`;
      const user = new User({
        ...data,
        passwordHash,
        phoneHash,
        role: "planner",
        verified: true,
        active: true,
        trainingCompletedAt: new Date(),
        tokenVersion: 0,
      });
      await user.save();
    }
    console.log(`Planners created (${plannerData.length}).`);

    const createdCitizens = [];
    for (let i = 1; i <= CITIZEN_COUNT; i++) {
      const email = `citizen${i}@test.com`;
      const region = randomItem(regions);
      const phone = `+25191234${String(1000 + i).slice(-4)}`;
      const phoneHash = hashPhone(phone);
      const user = new User({
        email,
        passwordHash,
        phoneHash,
        region,
        ageRange: randomItem(ageRanges),
        gender: randomItem(genders),
        occupation: randomItem(occupations),
        education: randomItem(educations),
        role: "citizen",
        verified: true,
        active: true,
        tokenVersion: 0,
      });
      await user.save();
      createdCitizens.push(user);
    }
    console.log(`Citizens created (${createdCitizens.length}).`);

    const planners = await User.find({ role: "planner" });
    const policyOwner = planners[0] || admin;
    const createdPolicies = [];
    for (const def of policyDefinitions) {
      const policyCode = generatePolicyCode(def.title);
      let targets = def.targetRegions;
      if (targets.includes("All")) targets = regions;
      const policy = new Policy({
        ...def,
        targetRegions: targets,
        policyCode,
        createdBy: policyOwner._id,
      });
      await policy.save();
      createdPolicies.push(policy);
    }
    console.log(`Policies created (${createdPolicies.length}).`);

    // ===== Votes and normal comments (approved, good confidence) =====
    let voteCount = 0;
    let commentCount = 0;
    for (const citizen of createdCitizens) {
      for (const policy of createdPolicies) {
        if (!policy.targetRegions.includes(citizen.region)) continue;

        const value = generateVoteValue(policy.pollType, policy);
        const vote = new Vote({
          policyId: policy._id,
          userId: citizen._id,
          phoneHash: citizen.phoneHash,
          channel: "app",
          value,
          region: citizen.region,
          demographics: {
            ageRange: citizen.ageRange,
            gender: citizen.gender,
            occupation: citizen.occupation,
            education: citizen.education,
          },
          createdAt: new Date(Date.now() - randomInt(1, 60) * 86400000),
        });
        await vote.save();
        voteCount++;

        if (Math.random() < 0.5) {
          let sentimentLabel = "neutral";
          if (typeof value === "number") {
            if (value <= 2) sentimentLabel = "negative";
            else if (value >= 4) sentimentLabel = "positive";
          } else if (value === "yes" || value === "approve")
            sentimentLabel = "positive";
          else if (value === "no" || value === "reject")
            sentimentLabel = "negative";
          const commentText = randomComment(sentimentLabel);
          const keywords = getRandomKeywords(policy.topics);
          const comment = new Comment({
            policyId: policy._id,
            userId: citizen._id,
            parentCommentId: null,
            text: commentText,
            visibility: "visible",
            aiStatus: "processed",
            sentiment: {
              label: sentimentLabel,
              confidence: 0.85,
              overriddenByModerator: false,
            },
            keywords: keywords,
            reportState: "clean",
            reportCount: 0,
            reports: [],
            reviewFlags: {
              sentimentReviewNeeded: false,
              moderationReviewNeeded: false,
            },
            lastAnalyzedAt: new Date(),
            events: [
              {
                type: "created",
                actor: citizen._id,
                data: { text: commentText },
                createdAt: new Date(),
              },
              {
                type: "ai_analyzed",
                actor: null,
                data: { sentiment: sentimentLabel, confidence: 0.85, keywords },
                createdAt: new Date(),
              },
            ],
            createdAt: new Date(Date.now() - randomInt(1, 60) * 86400000),
          });
          await comment.save();
          commentCount++;
        }
      }
    }
    console.log(`Votes created: ${voteCount}`);
    console.log(`Comments created: ${commentCount}`);

    // === Moderatable comments (low confidence, reported, appeal) ===
    console.log("Creating moderatable test comments...");
    const allCitizens = createdCitizens;
    const somePolicies = createdPolicies.slice(0, 2);
    const now = new Date();

    // Low‑confidence comments (processed AI but low confidence)
    for (let i = 0; i < 3; i++) {
      const citizen = randomItem(allCitizens);
      const policy = randomItem(somePolicies);
      const comment = new Comment({
        policyId: policy._id,
        userId: citizen._id,
        parentCommentId: null,
        text: `This is a low‑confidence test comment #${i + 1}. The AI is uncertain about the sentiment.`,
        visibility: "visible",
        aiStatus: "processed",
        sentiment: {
          label: "neutral",
          confidence: 0.45,
          overriddenByModerator: false,
        },
        keywords: ["test", "uncertain"],
        reportState: "clean",
        reportCount: 0,
        reports: [],
        reviewFlags: {
          sentimentReviewNeeded: true,
          moderationReviewNeeded: false,
        },
        lastAnalyzedAt: new Date(),
        events: [
          {
            type: "created",
            actor: citizen._id,
            data: {
              text: `This is a low‑confidence test comment #${i + 1}. The AI is uncertain about the sentiment.`,
            },
            createdAt: new Date(),
          },
          {
            type: "ai_analyzed",
            actor: null,
            data: {
              sentiment: { label: "neutral", confidence: 0.45 },
              keywords: ["test", "uncertain"],
            },
            createdAt: new Date(),
          },
        ],
        createdAt: new Date(now - randomInt(1, 10) * 86400000),
      });
      await comment.save();
      console.log(
        `   Low‑confidence comment created for policy ${policy.title}`,
      );
    }

    // Reported comments (hidden due to reports)
    for (let i = 0; i < 3; i++) {
      const citizen = randomItem(allCitizens);
      const policy = randomItem(somePolicies);
      const originalText = `This comment was reported by users. Original offensive content.`;
      const comment = new Comment({
        policyId: policy._id,
        userId: citizen._id,
        parentCommentId: null,
        text: originalText,
        visibility: "hidden",
        aiStatus: "processed",
        sentiment: {
          label: "negative",
          confidence: 0.92,
          overriddenByModerator: false,
        },
        keywords: ["offensive"],
        reportState: "reported",
        reportCount: 3,
        reports: [
          {
            reporterId: allCitizens[randomInt(0, allCitizens.length - 1)]._id,
            reason: "inappropriate",
            status: "pending",
            createdAt: new Date(now - randomInt(1, 3) * 86400000),
            snapshot: {
              text: originalText,
              sentiment: { label: "negative", confidence: 0.92 },
              keywords: ["offensive"],
              visibility: "visible",
              aiStatus: "processed",
              reportCount: 0,
            },
          },
          {
            reporterId: allCitizens[randomInt(0, allCitizens.length - 1)]._id,
            reason: "hate speech",
            status: "pending",
            createdAt: new Date(now - randomInt(1, 3) * 86400000),
            snapshot: {
              text: originalText,
              sentiment: { label: "negative", confidence: 0.92 },
              keywords: ["offensive"],
              visibility: "visible",
              aiStatus: "processed",
              reportCount: 1,
            },
          },
          {
            reporterId: allCitizens[randomInt(0, allCitizens.length - 1)]._id,
            reason: "spam",
            status: "pending",
            createdAt: new Date(now - randomInt(1, 3) * 86400000),
            snapshot: {
              text: originalText,
              sentiment: { label: "negative", confidence: 0.92 },
              keywords: ["offensive"],
              visibility: "visible",
              aiStatus: "processed",
              reportCount: 2,
            },
          },
        ],
        reviewFlags: {
          sentimentReviewNeeded: false,
          moderationReviewNeeded: true,
        },
        moderationActions: [
          {
            action: "hide",
            reason: "auto_hide_reports",
            actor: null,
            createdAt: new Date(),
          },
        ],
        events: [
          {
            type: "created",
            actor: citizen._id,
            data: { text: originalText },
            createdAt: new Date(),
          },
          {
            type: "reported",
            actor: null,
            data: { reason: "auto_hide_reports", reportCount: 3 },
            createdAt: new Date(),
          },
        ],
        createdAt: new Date(now - randomInt(1, 5) * 86400000),
      });
      await comment.save();
      console.log(`   Reported comment created for policy ${policy.title}`);
    }

    // Comment with pending appeal
    const appealCitizen = randomItem(allCitizens);
    const appealPolicy = randomItem(somePolicies);
    const appealComment = new Comment({
      policyId: appealPolicy._id,
      userId: appealCitizen._id,
      parentCommentId: null,
      text: "This comment was moderated and I disagree.",
      visibility: "hidden",
      aiStatus: "processed",
      sentiment: {
        label: "neutral",
        confidence: 0.5,
        overriddenByModerator: false,
      },
      keywords: ["appeal"],
      reportState: "clean",
      reportCount: 0,
      reports: [],
      reviewFlags: {
        sentimentReviewNeeded: false,
        moderationReviewNeeded: true,
      },
      appeal: {
        appellantId: appealCitizen._id,
        reason: "I believe my comment was incorrectly moderated.",
        status: "pending",
        createdAt: new Date(),
        snapshot: {
          text: "This comment was moderated and I disagree.",
          visibility: "hidden",
          reportState: "clean",
          reportCount: 0,
        },
      },
      events: [
        {
          type: "created",
          actor: appealCitizen._id,
          data: { text: "This comment was moderated and I disagree." },
          createdAt: new Date(),
        },
        {
          type: "appealed",
          actor: appealCitizen._id,
          data: { reason: "I believe my comment was incorrectly moderated." },
          createdAt: new Date(),
        },
      ],
      createdAt: new Date(now - 2 * 86400000),
    });
    await appealComment.save();
    console.log(
      `   Appeal pending comment created for policy ${appealPolicy.title}`,
    );

    // ===== SMS subscriptions and SMS votes =====
    const smsPhones = ["+251911234567", "+251922345678", "+251933456789"];
    for (const phone of smsPhones) {
      const phoneHash = hashPhone(phone);
      await SmsSubscription.create({
        phoneHash,
        subscribed: true,
        subscribedAt: new Date(),
      });
    }
    console.log(`SMS subscriptions created.`);

    let smsVoteCount = 0;
    for (const policy of createdPolicies) {
      if (policy.status !== "active") continue;
      for (const phone of smsPhones) {
        const phoneHash = hashPhone(phone);
        const value = generateVoteValue(policy.pollType, policy);
        const vote = new Vote({
          policyId: policy._id,
          userId: null,
          phoneHash,
          channel: "sms",
          value,
          region: null,
          demographics: null,
          createdAt: new Date(Date.now() - randomInt(1, 30) * 86400000),
        });
        await vote.save();
        smsVoteCount++;
      }
    }
    console.log(`SMS votes created: ${smsVoteCount}`);

    // ===== Generate JWT tokens =====
    console.log("\nGenerating JWT tokens for seeded users...");
    const tokens = [];
    const generateToken = (user) => {
      return jwt.sign(
        {
          id: user._id.toString(),
          role: user.role,
          region: user.region,
          verified: user.verified,
        },
        JWT_SECRET,
        { expiresIn: "7d" },
      );
    };
    const allUsers = await User.find({});
    for (const user of allUsers) {
      const token = generateToken(user);
      tokens.push({
        email: user.email,
        token,
        role: user.role,
      });
      console.log(`   Generated token for ${user.email}`);
    }
    const tokensDir = path.join(__dirname, "../tokens");
    if (!fs.existsSync(tokensDir)) fs.mkdirSync(tokensDir);
    const tokenFilePath = path.join(tokensDir, "seed_tokens.json");
    fs.writeFileSync(tokenFilePath, JSON.stringify(tokens, null, 2));
    console.log(`\nTokens saved to ${tokenFilePath}`);

    const totalVotes = await Vote.countDocuments();
    const totalComments = await Comment.countDocuments();
    console.log("\n========== SEED COMPLETE ==========");
    console.log(`Planners: ${plannerData.length}`);
    console.log(`Citizens: ${createdCitizens.length}`);
    console.log(`Policies: ${createdPolicies.length}`);
    console.log(`Total votes: ${totalVotes}`);
    console.log(`Comments: ${totalComments}`);
    console.log(
      `Average votes per policy: ${(totalVotes / createdPolicies.length).toFixed(1)}`,
    );
    console.log("===================================\n");

    await mongoose.disconnect();
    console.log("Disconnected.");
  } catch (err) {
    console.error("Error during seeding:", err);
    await mongoose.disconnect();
    process.exit(1);
  }
}

seed();
