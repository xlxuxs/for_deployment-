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

// Utilities
const { hashPhone, hashPassword } = require("../src/utils/helpers");

const MONGO_URI =
  process.env.MONGO_URI || "mongodb://localhost:27017/communityinsight";
const DEFAULT_PASSWORD = "Pass123!";
const JWT_SECRET = process.env.JWT_SECRET;
if (!JWT_SECRET) {
  console.error("JWT_SECRET not defined in .env");
  process.exit(1);
}

// Generate policyCode (same as in policyController)
const nanoid = customAlphabet("ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789", 6);
const generatePolicyCode = (title) => {
  const prefix = title
    .replace(/[^a-zA-Z0-9]/g, "")
    .substring(0, 4)
    .toUpperCase();
  const id = nanoid();
  return `${prefix}${id}`;
};

// ---------- Helper: random item from array ----------
const randomItem = (arr) => arr[Math.floor(Math.random() * arr.length)];
const randomInt = (min, max) =>
  Math.floor(Math.random() * (max - min + 1)) + min;

// ---------- Configuration ----------
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
const genders = ["male", "female", "prefer-not-to-say"];
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

// Planner fixed data
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
    gender: "prefer-not-to-say",
    occupation: "private-sector",
    education: "postgraduate",
    languagesSpoken: ["en", "am"],
  },
];

const CITIZEN_COUNT = 20;

// ---------- Poll type specific vote value generators ----------
const generateVoteValue = (pollType, policy) => {
  const options = policy.pollOptions || [];
  switch (pollType) {
    case "binary":
      return randomItem(["yes", "no"]);
    case "multipleChoice": {
      const maxSel = policy.maxSelections || 1;
      const ids = options.map((o) => o.id);
      if (!ids.length) return [];
      const num = Math.min(maxSel, ids.length);
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

// ---------- Policy data ----------
const policyDefinitions = [
  {
    title: "Binary Test Policy",
    description: "Vote yes or no on this issue.",
    targetRegions: ["Addis Ababa", "Oromia"],
    pollType: "binary",
    startDate: new Date(Date.now() - 7 * 86400000),
    endDate: new Date(Date.now() + 30 * 86400000),
    status: "active",
    topics: ["Agriculture", "Economy"],
    relevanceFactors: { youth: true, farmers: true },
  },
  {
    title: "Multiple Choice – Funding Priorities",
    description: "Select top 2 sectors for additional funding.",
    targetRegions: ["Addis Ababa"],
    pollType: "multipleChoice",
    pollOptions: [
      { id: "edu", text: "Education" },
      { id: "health", text: "Healthcare" },
      { id: "infra", text: "Infrastructure" },
    ],
    maxSelections: 2,
    startDate: new Date(Date.now() - 10 * 86400000),
    endDate: new Date(Date.now() + 20 * 86400000),
    status: "active",
    topics: ["Education", "Health", "Infrastructure"],
  },
  {
    title: "Likert – Government Performance",
    description: "Rate your satisfaction.",
    targetRegions: ["Oromia"],
    pollType: "likert",
    likertLabels: ["Very Poor", "Poor", "Average", "Good", "Excellent"],
    startDate: new Date(Date.now() - 5 * 86400000),
    endDate: new Date(Date.now() + 45 * 86400000),
    status: "active",
    topics: ["Government", "Economy"],
  },
  {
    title: "Approval – New Tax Reform",
    description: "Do you approve, reject, or abstain?",
    targetRegions: ["Tigray"],
    pollType: "approval",
    startDate: new Date(Date.now() - 3 * 86400000),
    endDate: new Date(Date.now() + 15 * 86400000),
    status: "active",
    topics: ["Taxation", "Economy"],
  },
  {
    title: "Rating – Public Transport",
    description: "Rate the public transportation system in your city.",
    targetRegions: ["Addis Ababa"],
    pollType: "rating",
    startDate: new Date(Date.now() - 20 * 86400000),
    endDate: new Date(Date.now() + 10 * 86400000),
    status: "active",
    topics: ["Transport", "Infrastructure"],
  },
];

const fullPublicVisibility = {
  showResults: true,
  showBreakdown: true,
  showComments: true,
  showSentiment: true,
  allowTimeFilter: true,
};

const publicPolicyDefinitions = [
  {
    title: "Public Transit Reliability Review",
    description: "Help evaluate how reliable public transportation feels across the city.",
    targetRegions: ["Addis Ababa", "Oromia"],
    pollType: "rating",
    startDate: new Date(Date.now() - 50 * 86400000),
    endDate: new Date(Date.now() - 20 * 86400000),
    status: "closed",
    topics: ["Transport", "Infrastructure"],
  },
  {
    title: "Water Access and Service Quality",
    description: "Rate how well water services are meeting daily needs.",
    targetRegions: ["Amhara", "Sidama"],
    pollType: "likert",
    likertLabels: ["Very Poor", "Poor", "Average", "Good", "Excellent"],
    startDate: new Date(Date.now() - 52 * 86400000),
    endDate: new Date(Date.now() - 18 * 86400000),
    status: "closed",
    topics: ["Water Supply", "Public Services"],
  },
  {
    title: "Community Safety Priorities",
    description: "Choose the top safety measures your region should prioritize.",
    targetRegions: ["Tigray", "Afar"],
    pollType: "multipleChoice",
    pollOptions: [
      { id: "streetlights", text: "Street lighting" },
      { id: "patrols", text: "More community patrols" },
      { id: "response", text: "Faster emergency response" },
      { id: "reporting", text: "Better reporting tools" },
    ],
    maxSelections: 2,
    startDate: new Date(Date.now() - 48 * 86400000),
    endDate: new Date(Date.now() - 16 * 86400000),
    status: "closed",
    topics: ["Public Safety", "Governance"],
  },
  {
    title: "Local Tax Reform Feedback",
    description: "Tell us whether the proposed tax approach should move forward.",
    targetRegions: ["Oromia", "Addis Ababa"],
    pollType: "approval",
    startDate: new Date(Date.now() - 55 * 86400000),
    endDate: new Date(Date.now() - 21 * 86400000),
    status: "closed",
    topics: ["Taxation", "Economy"],
  },
  {
    title: "Road Repair Satisfaction Check",
    description: "Rate how satisfied you are with recent road repair work.",
    targetRegions: ["Gambela", "Benishangul-Gumuz"],
    pollType: "rating",
    startDate: new Date(Date.now() - 47 * 86400000),
    endDate: new Date(Date.now() - 15 * 86400000),
    status: "closed",
    topics: ["Roads", "Infrastructure"],
  },
  {
    title: "Education Investment Direction",
    description: "Pick the education investments that should receive the strongest support.",
    targetRegions: ["Addis Ababa", "Harari"],
    pollType: "multipleChoice",
    pollOptions: [
      { id: "teachers", text: "Teacher training" },
      { id: "materials", text: "Learning materials" },
      { id: "digital", text: "Digital classrooms" },
      { id: "transport", text: "School transport" },
    ],
    maxSelections: 2,
    startDate: new Date(Date.now() - 44 * 86400000),
    endDate: new Date(Date.now() - 14 * 86400000),
    status: "closed",
    topics: ["Education", "Youth"],
  },
  {
    title: "Healthcare Service Confidence",
    description: "Vote yes or no on whether local healthcare is improving.",
    targetRegions: ["Somali", "Sidama"],
    pollType: "binary",
    startDate: new Date(Date.now() - 43 * 86400000),
    endDate: new Date(Date.now() - 13 * 86400000),
    status: "closed",
    topics: ["Health", "Public Services"],
  },
  {
    title: "Youth Employment Support",
    description: "Rate the current support available for young job seekers.",
    targetRegions: ["Addis Ababa", "Oromia"],
    pollType: "likert",
    likertLabels: ["Very Poor", "Poor", "Average", "Good", "Excellent"],
    startDate: new Date(Date.now() - 40 * 86400000),
    endDate: new Date(Date.now() - 12 * 86400000),
    status: "closed",
    topics: ["Employment", "Youth"],
  },
  {
    title: "Urban Waste Collection Improvement",
    description: "Choose the change that would improve waste collection the most.",
    targetRegions: ["Addis Ababa", "Dire Dawa"],
    pollType: "multipleChoice",
    pollOptions: [
      { id: "more-trucks", text: "More collection trucks" },
      { id: "more-bins", text: "More public bins" },
      { id: "route-optim", text: "Better route planning" },
      { id: "awareness", text: "Awareness campaigns" },
    ],
    maxSelections: 2,
    startDate: new Date(Date.now() - 39 * 86400000),
    endDate: new Date(Date.now() - 11 * 86400000),
    status: "closed",
    topics: ["Environment", "Urban Planning"],
  },
  {
    title: "Local Budget Transparency Pulse",
    description: "Approve or reject the current approach to budget transparency.",
    targetRegions: ["Central Ethiopia", "Southwest Ethiopia"],
    pollType: "approval",
    startDate: new Date(Date.now() - 42 * 86400000),
    endDate: new Date(Date.now() - 10 * 86400000),
    status: "closed",
    topics: ["Governance", "Justice"],
  },
];

const fullyPublicPolicies = publicPolicyDefinitions.map((definition) => ({
  ...definition,
  citizenAnalyticsVisibility: { ...fullPublicVisibility },
}));

const allPolicyDefinitions = [...policyDefinitions, ...fullyPublicPolicies];

// ---------- Comment generation ----------
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

const reportReasons = [
  "inappropriate",
  "spam",
  "harassment",
  "hate speech",
  "misinformation",
];

const buildReportedComment = ({ citizen, policy, reporters, reportCount, reportState }) => {
  const now = Date.now();
  const originalText = `This comment was reported on ${policy.title}.`;
  const reports = Array.from({ length: reportCount }, (_, index) => {
    const reporter = randomItem(reporters);
    return {
      reporterId: reporter._id,
      reason: reportReasons[index % reportReasons.length],
      details: `Seeded report ${index + 1} for moderation review.`,
      status: index === reportCount - 1 ? "pending" : "valid",
      createdAt: new Date(now - randomInt(1, 5) * 86400000),
      snapshot: {
        text: originalText,
        sentiment: { label: "negative", confidence: 0.92 },
        keywords: ["reported", "moderation"],
        visibility: reportCount >= 5 ? "hidden" : "visible",
        aiStatus: "processed",
        reportCount: Math.max(0, index),
      },
    };
  });

  return new Comment({
    policyId: policy._id,
    userId: citizen._id,
    parentCommentId: null,
    text: originalText,
    visibility: reportCount >= 5 ? "hidden" : "visible",
    hiddenReason: reportCount >= 5 ? "reports" : null,
    aiStatus: "processed",
    sentiment: { label: "negative", confidence: 0.92 },
    keywords: ["offensive", "reported"],
    reportState,
    reportCount,
    reports,
    reviewFlags: {
      sentimentReviewNeeded: false,
      moderationReviewNeeded: true,
    },
    moderationActions:
      reportCount >= 5
        ? [
            {
              action: "hide",
              reason: "auto_hide_reports",
              actor: null,
              createdAt: new Date(),
            },
          ]
        : [],
    events: [
      {
        type: "created",
        actor: citizen._id,
        data: { text: originalText },
        createdAt: new Date(now - randomInt(1, 5) * 86400000),
      },
      {
        type: "reported",
        actor: null,
        data: { reportCount },
        createdAt: new Date(now - randomInt(1, 5) * 86400000),
      },
    ],
    createdAt: new Date(now - randomInt(1, 15) * 86400000),
  });
};

// ---------- Main seed function ----------
async function seed() {
  try {
    console.log("Connecting to MongoDB...");
    await mongoose.connect(MONGO_URI);
    console.log("Connected.");

    // ===== 1. Clean up (enabled) =====
    console.log("Cleaning up existing data...");
    await User.deleteMany({ role: { $in: ["citizen", "planner"] } });
    await Policy.deleteMany({});
    await Vote.deleteMany({});
    await Comment.deleteMany({});
    await Notification.deleteMany({});
    await AuditLog.deleteMany({});
    await SmsSubscription.deleteMany({});
    await PlannerRequest.deleteMany({});
    console.log("Cleanup done.");

    // ===== 2. Admin (check existence first) =====
    let admin = await User.findOne({ email: "admin@test.com" });
    if (!admin) {
      const adminHash = await hashPassword("Admin@123");
      const adminPhone = `+251900${String(Date.now()).slice(-9)}`;
      admin = new User({
        email: "admin@test.com",
        passwordHash: adminHash,
        phoneHash: hashPhone(adminPhone),
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

    // ===== 3. Planners =====
    const passwordHash = await hashPassword(DEFAULT_PASSWORD);
    for (let index = 0; index < plannerData.length; index++) {
      const data = plannerData[index];
      const phone = data.phone || `+25191300${String(index + 1001).padStart(4, "0")}`;
      const phoneHash = hashPhone(phone);
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

    // ===== 4. Citizens =====
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

    // ===== 4.5. Planner Requests (pending) =====
    console.log("Creating pending planner requests...");
    const pendingCitizens = createdCitizens.slice(0, 5);
    for (const citizen of pendingCitizens) {
      await PlannerRequest.create({
        userId: citizen._id,
        organization: `Org ${citizen.email.split("@")[0]}`,
        reason:
          "This is a test reason that is at least 50 characters long. I want to become a planner to contribute to policy making in my region and help moderate comments effectively.",
        status: "pending",
        createdAt: new Date(Date.now() - randomInt(1, 10) * 86400000),
      });
      console.log(`   Request created for ${citizen.email}`);
    }
    console.log(
      `Pending planner requests created for ${pendingCitizens.length} citizens.`,
    );

    // ===== 5. Policies =====
    const planners = await User.find({ role: "planner" });
    const policyOwner = planners[0] || admin;
    const createdPolicies = [];
    for (const def of allPolicyDefinitions) {
      const policyCode = generatePolicyCode(def.title);
      const policy = new Policy({
        ...def,
        policyCode,
        createdBy: policyOwner._id,
        archivedAt: null,
      });
      await policy.save();
      createdPolicies.push(policy);
    }
    console.log(`Policies created (${createdPolicies.length}).`);

    // ===== 6. Votes and comments (regular) =====
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

        if (Math.random() < 0.3) {
          let sentimentLabel = "neutral";
          if (typeof value === "number") {
            if (value <= 2) sentimentLabel = "negative";
            else if (value >= 4) sentimentLabel = "positive";
          } else if (value === "yes" || value === "approve")
            sentimentLabel = "positive";
          else if (value === "no" || value === "reject")
            sentimentLabel = "negative";
          const commentText = randomComment(sentimentLabel);
          const comment = new Comment({
            policyId: policy._id,
            userId: citizen._id,
            parentCommentId: null,
            text: commentText,
            visibility: "visible",
            hiddenReason: null,
            moderationStatus: "none",
            moderationReason: null,
            sentiment: { label: sentimentLabel, confidence: 0.85 },
            keywords: [sentimentLabel, "policy"],
            reportCount: 0,
            editedHistory: [],
            flaggedSnapshot: null,
            retryCount: 0,
            nextRetry: null,
            lastRetryTriggeredBy: null,
            createdAt: new Date(Date.now() - randomInt(1, 60) * 86400000),
          });
          await comment.save();
          commentCount++;
        }
      }
    }
    console.log(`Votes created: ${voteCount}`);
    console.log(`Comments created: ${commentCount}`);

    // ===== 6.5. Comments that need review (low-confidence / reported) =====
    console.log("Creating comments in needs_review state...");
    const lowConfidenceCount = 5;
    const reportedCount = 8;
    const allCitizens = createdCitizens;
    const somePolicies = createdPolicies.slice(0, 4);
    // Low-confidence comments (visible but needs review)
    for (let i = 0; i < lowConfidenceCount; i++) {
      const citizen = randomItem(allCitizens);
      const policy = randomItem(somePolicies);
      const comment = new Comment({
        policyId: policy._id,
        userId: citizen._id,
        parentCommentId: null,
        text: "This comment has low AI confidence.",
        visibility: "visible",
        hiddenReason: null,
        moderationStatus: "needs_review",
        moderationReason: "low_confidence",
        sentiment: { label: "neutral", confidence: 0.45 },
        keywords: ["uncertain"],
        reportCount: 0,
        editedHistory: [],
        flaggedSnapshot: null,
        retryCount: 0,
        nextRetry: null,
        lastRetryTriggeredBy: null,
        createdAt: new Date(Date.now() - randomInt(1, 10) * 86400000),
      });
      await comment.save();
      console.log(
        `   Low-confidence comment created for policy ${policy.title}`,
      );
    }
    // Reported comments (hidden, needs review)
    for (let i = 0; i < reportedCount; i++) {
      const citizen = randomItem(allCitizens);
      const policy = randomItem(somePolicies);
      const reportCountForComment = i < 4 ? 5 : randomInt(2, 4);
      const reportState = reportCountForComment >= 5 ? "under_review" : "reported";
      const comment = buildReportedComment({
        citizen,
        policy,
        reporters: allCitizens,
        reportCount: reportCountForComment,
        reportState,
      });
      await comment.save();
      console.log(`   Reported comment created for policy ${policy.title}`);
    }

    // ===== 7. SMS subscriptions and SMS votes =====
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

    // ===== 8. Generate JWT tokens directly (bypass rate limits) =====
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

    // ===== 9. Summary =====
    const totalVotes = await Vote.countDocuments();
    const totalComments = await Comment.countDocuments();
    const needsReviewCount = await Comment.countDocuments({
      moderationStatus: "needs_review",
    });
    console.log("\n========== SEED COMPLETE ==========");
    console.log(`Planners: ${plannerData.length}`);
    console.log(`Citizens: ${createdCitizens.length}`);
    console.log(`Policies: ${createdPolicies.length}`);
    console.log(`Total votes: ${totalVotes}`);
    console.log(`Comments: ${totalComments}`);
    console.log(
      `Needs review comments: ${needsReviewCount} (low-confidence + reported)`,
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
