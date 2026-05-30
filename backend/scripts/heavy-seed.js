const mongoose = require("mongoose");
const jwt = require("jsonwebtoken");
const { customAlphabet } = require("nanoid");
const path = require("path");
const fs = require("fs");
require("dotenv").config({ path: path.join(__dirname, "../.env") });

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

// Regions matching frontend constants
const regions = [
  "Addis Ababa",
  "Afar",
  "Amhara",
  "Benishangul-Gumuz",
  "Central Ethiopia",
  "Dire Dawa",
  "Gambela",
  "Harari",
  "Oromia",
  "Sidama",
  "Somali",
  "South Ethiopia",
  "Southwest Ethiopia",
  "Tigray",
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

const pollTypes = [
  "binary",
  "multipleChoice",
  "likert",
  "approval",
  "rating",
  "rankedChoice",
];

const statusDistribution = [
  { status: "draft", weight: 0.1 },
  { status: "published", weight: 0.15 },
  { status: "active", weight: 0.4 },
  { status: "paused", weight: 0.05 },
  { status: "closed", weight: 0.25 },
  { status: "archived", weight: 0.05 },
];

const topicPool = [
  "Health",
  "Education",
  "Water Supply",
  "Electricity",
  "Housing",
  "Transport",
  "Roads",
  "Digital Infrastructure",
  "Agriculture",
  "Environment",
  "Climate Change",
  "Economy",
  "Employment",
  "Small Business",
  "Industry",
  "Trade",
  "Tourism",
  "Social Protection",
  "Food Security",
  "Poverty Reduction",
  "Governance",
  "Justice",
  "Public Safety",
  "Urban Planning",
  "Rural Development",
  "Youth",
  "Women Affairs",
];

const keywordsByTopic = {};
for (const topic of topicPool) {
  const words = topic.toLowerCase().split(" ");
  keywordsByTopic[topic] = [
    ...words,
    "improvement",
    "policy",
    "funding",
    "impact",
    "community",
    "future",
    "reform",
    "support",
  ];
}
keywordsByTopic.default = [
  "policy",
  "change",
  "improvement",
  "need",
  "community",
  "support",
  "development",
];

const getRandomKeywords = (topics, count = 3) => {
  const primaryTopic = topics?.length ? topics[0] : "default";
  const pool = keywordsByTopic[primaryTopic] || keywordsByTopic.default;
  const shuffled = [...pool].sort(() => 0.5 - Math.random());
  return shuffled.slice(0, Math.min(count, shuffled.length));
};

const commentTexts = {
  positive: [
    "Excellent initiative! This will truly benefit our community.",
    "Fully support this. It's about time we addressed this issue.",
    "Well researched and well thought out. Hope it passes quickly.",
    "This is exactly what we need. Great job by the planners.",
    "Very progressive. I'm optimistic about the outcomes.",
    "Absolutely necessary for sustainable development.",
    "I agree completely. Let's move forward.",
    "This will create jobs and improve lives.",
    "Long overdue. Finally a sensible policy.",
  ],
  negative: [
    "This is misguided and will cause more harm than good.",
    "I strongly oppose. The implementation will be flawed.",
    "Waste of resources that could be better spent elsewhere.",
    "This policy ignores local realities. Needs complete rewrite.",
    "Will not work in practice. Too many loopholes.",
    "Short‑sighted. We'll regret this.",
    "No benefit to ordinary citizens. Disappointed.",
    "This will increase inequality.",
    "I've seen similar policies fail elsewhere.",
  ],
  neutral: [
    "I see both pros and cons. Need more details.",
    "Not sure yet. Let's wait for the impact assessment.",
    "Some good points, but also concerns. Will observe.",
    "Could go either way. I'll stay neutral for now.",
    "Indifferent. Neither strongly for nor against.",
    "Let's see how it plays out in pilot phase.",
    "Need more data before forming an opinion.",
    "This might work in some regions, not all.",
  ],
};

const randomItem = (arr) => arr[Math.floor(Math.random() * arr.length)];
const randomInt = (min, max) =>
  Math.floor(Math.random() * (max - min + 1)) + min;
const randomDate = (start, end) =>
  new Date(start.getTime() + Math.random() * (end.getTime() - start.getTime()));

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

const generatePollOptions = (pollType) => {
  if (pollType === "multipleChoice") {
    return [
      { id: "opt1", text: "Increase funding significantly" },
      { id: "opt2", text: "Moderate increase" },
      { id: "opt3", text: "Maintain current levels" },
      { id: "opt4", text: "Decrease funding" },
    ].slice(0, randomInt(3, 4));
  }
  if (pollType === "rankedChoice") {
    return [
      { id: "rank1", text: "First Priority: Education" },
      { id: "rank2", text: "Second Priority: Health" },
      { id: "rank3", text: "Third Priority: Infrastructure" },
      { id: "rank4", text: "Fourth Priority: Agriculture" },
    ];
  }
  return [];
};

const generateLikertLabels = () => [
  "Very Dissatisfied",
  "Dissatisfied",
  "Neutral",
  "Satisfied",
  "Very Satisfied",
];

async function seed() {
  try {
    console.log("Connecting to MongoDB...");
    await mongoose.connect(MONGO_URI);
    console.log("Connected.");

    console.log("Cleaning up existing data...");
    await User.deleteMany({});
    await Policy.deleteMany({});
    await Vote.deleteMany({});
    await Comment.deleteMany({});
    await Notification.deleteMany({});
    await AuditLog.deleteMany({});
    await SmsSubscription.deleteMany({});
    await PlannerRequest.deleteMany({});
    await PolicyAssociate.deleteMany({});
    console.log("Cleanup done.");

    // ---------- 1. Create Admin ----------
    const adminHash = await hashPassword("Admin@123");
    const admin = new User({
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
      createdAt: randomDate(new Date(2023, 0, 1), new Date(2024, 0, 1)),
    });
    await admin.save();
    console.log("Admin created.");

    // ---------- 2. Create Planners (20) ----------
    const passwordHash = await hashPassword(DEFAULT_PASSWORD);
    const planners = [];
    const plannerCount = 20;
    for (let i = 1; i <= plannerCount; i++) {
      const planner = new User({
        email: `planner${i}@test.com`,
        passwordHash,
        phoneHash: `planner_dummy_${i}`,
        region: randomItem(regions),
        ageRange: randomItem(ageRanges),
        gender: randomItem(genders),
        occupation: randomItem(occupations),
        education: randomItem(educations),
        languagesSpoken: ["en", randomItem(["am", "om", "ti"])],
        role: "planner",
        verified: true,
        active: true,
        trainingCompletedAt: randomDate(
          new Date(2024, 0, 1),
          new Date(2025, 0, 1),
        ),
        tokenVersion: 0,
        createdAt: randomDate(new Date(2023, 0, 1), new Date(2025, 0, 1)),
      });
      await planner.save();
      planners.push(planner);
      if (i % 5 === 0) console.log(`   ${i} planners created...`);
    }
    console.log(`Planners created: ${planners.length}`);

    // ---------- 3. Create Citizens (500) ----------
    const citizens = [];
    const citizenCount = 500;
    for (let i = 1; i <= citizenCount; i++) {
      const region = randomItem(regions);
      const phone = `+25191234${String(10000 + i).slice(-4)}`;
      const citizen = new User({
        email: `citizen${i}@test.com`,
        passwordHash,
        phoneHash: hashPhone(phone),
        region,
        ageRange: randomItem(ageRanges),
        gender: randomItem(genders),
        occupation: randomItem(occupations),
        education: randomItem(educations),
        role: "citizen",
        verified: true,
        active: true,
        tokenVersion: 0,
        createdAt: randomDate(new Date(2023, 0, 1), new Date(2026, 4, 1)),
      });
      await citizen.save();
      citizens.push(citizen);
      if (i % 100 === 0) console.log(`   ${i} citizens created...`);
    }
    console.log(`Citizens created: ${citizens.length}`);

    // ---------- 4. Create Policies (100) ----------
    const allOwners = [...planners, admin];
    const policies = [];
    const policyCount = 100;
    const now = new Date(2026, 4, 18); // May 18, 2026

    for (let i = 1; i <= policyCount; i++) {
      const pollType = randomItem(pollTypes);
      const owner = randomItem(allOwners);
      const topics = [randomItem(topicPool), randomItem(topicPool)].filter(
        (v, i, a) => a.indexOf(v) === i,
      );
      const title = `${pollType.charAt(0).toUpperCase() + pollType.slice(1)} Policy ${i}: ${topics[0]} ${randomInt(1, 100)}`;
      let status = "active";
      const rand = Math.random();
      let cum = 0;
      for (const s of statusDistribution) {
        cum += s.weight;
        if (rand < cum) {
          status = s.status;
          break;
        }
      }
      let startDate, endDate;
      if (status === "draft") {
        startDate = new Date(now.getTime() + randomInt(1, 30) * 86400000);
        endDate = new Date(startDate.getTime() + randomInt(30, 180) * 86400000);
      } else if (status === "published") {
        startDate = new Date(now.getTime() + randomInt(1, 60) * 86400000);
        endDate = new Date(startDate.getTime() + randomInt(30, 180) * 86400000);
      } else if (status === "active") {
        startDate = new Date(now.getTime() - randomInt(1, 180) * 86400000);
        endDate = new Date(now.getTime() + randomInt(1, 180) * 86400000);
      } else if (status === "paused") {
        startDate = new Date(now.getTime() - randomInt(30, 180) * 86400000);
        endDate = new Date(startDate.getTime() + randomInt(60, 200) * 86400000);
      } else if (status === "closed") {
        startDate = new Date(now.getTime() - randomInt(180, 365) * 86400000);
        endDate = new Date(startDate.getTime() + randomInt(30, 150) * 86400000);
      } else if (status === "archived") {
        startDate = new Date(now.getTime() - randomInt(365, 730) * 86400000);
        endDate = new Date(startDate.getTime() + randomInt(30, 150) * 86400000);
      }
      if (startDate >= endDate)
        endDate = new Date(startDate.getTime() + 30 * 86400000);

      const targetRegions = [randomItem(regions), randomItem(regions)].slice(
        0,
        randomInt(1, 3),
      );
      const policyData = {
        title,
        description: `This is a ${pollType} policy about ${topics.join(", ")}. Generated for comprehensive testing. Includes detailed impact analysis and stakeholder feedback.`,
        targetRegions,
        pollType,
        pollOptions: generatePollOptions(pollType),
        maxSelections: pollType === "multipleChoice" ? randomInt(1, 2) : 1,
        likertLabels:
          pollType === "likert" ? generateLikertLabels() : undefined,
        rankedChoiceMaxRank: pollType === "rankedChoice" ? 3 : undefined,
        startDate,
        endDate,
        status,
        topics,
        relevanceFactors: {
          women: Math.random() > 0.7,
          youth: Math.random() > 0.7,
          farmers: Math.random() > 0.8,
          urban: Math.random() > 0.6,
          rural: Math.random() > 0.6,
          privateSector: Math.random() > 0.8,
          government: Math.random() > 0.8,
        },
        createdBy: owner._id,
        createdAt: startDate,
      };
      const policyCode = generatePolicyCode(title);
      const policy = new Policy({ ...policyData, policyCode });
      await policy.save();
      policies.push(policy);
      if (i % 10 === 0) console.log(`   ${i} policies created...`);
    }
    console.log(`Policies created: ${policies.length}`);

    // ---------- 5. Votes and Comments ----------
    let voteTotal = 0;
    let commentTotal = 0;
    const batchSize = 5000;
    let voteBatch = [];
    let commentBatch = [];

    for (const citizen of citizens) {
      for (const policy of policies) {
        // Only vote if policy is active and citizen in region
        if (policy.status !== "active") continue;
        if (!policy.targetRegions.includes(citizen.region)) continue;
        const nowDate = new Date();
        if (nowDate < policy.startDate || nowDate > policy.endDate) continue;

        // 80% chance to vote
        if (Math.random() > 0.8) continue;

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
          createdAt: randomDate(
            policy.startDate,
            new Date(Math.min(nowDate, policy.endDate)),
          ),
        });
        voteBatch.push(vote);
        voteTotal++;

        // 50% chance to comment
        if (Math.random() < 0.5) {
          let sentimentLabel = "neutral";
          if (typeof value === "number") {
            if (value <= 2) sentimentLabel = "negative";
            else if (value >= 4) sentimentLabel = "positive";
          } else if (value === "yes" || value === "approve")
            sentimentLabel = "positive";
          else if (value === "no" || value === "reject")
            sentimentLabel = "negative";

          const commentText = randomItem(commentTexts[sentimentLabel]);
          const keywords = getRandomKeywords(policy.topics, randomInt(1, 4));
          const confidence = Math.random() * 0.4 + 0.6; // 0.6 to 1.0
          const comment = new Comment({
            policyId: policy._id,
            userId: citizen._id,
            parentCommentId: null,
            text: commentText,
            visibility: "visible",
            aiStatus: "processed",
            sentiment: {
              label: sentimentLabel,
              confidence: confidence,
              overriddenByModerator: false,
            },
            keywords,
            reportState: "clean",
            reportCount: 0,
            reports: [],
            reviewFlags: {
              sentimentReviewNeeded: confidence < 0.75 ? true : false,
              moderationReviewNeeded: false,
            },
            demographics: {
              ageRange: citizen.ageRange,
              gender: citizen.gender,
              occupation: citizen.occupation,
              education: citizen.education,
            },
            lastAnalyzedAt: new Date(),
            events: [
              {
                type: "created",
                actor: citizen._id,
                data: { text: commentText },
                createdAt: vote.createdAt,
              },
              {
                type: "ai_analyzed",
                actor: null,
                data: { sentiment: sentimentLabel, confidence, keywords },
                createdAt: new Date(
                  vote.createdAt.getTime() + randomInt(1000, 3600000),
                ),
              },
            ],
            createdAt: vote.createdAt,
          });
          commentBatch.push(comment);
          commentTotal++;
        }

        if (voteBatch.length >= batchSize) {
          await Vote.insertMany(voteBatch);
          voteBatch = [];
        }
        if (commentBatch.length >= batchSize) {
          await Comment.insertMany(commentBatch);
          commentBatch = [];
        }
      }
    }
    if (voteBatch.length) await Vote.insertMany(voteBatch);
    if (commentBatch.length) await Comment.insertMany(commentBatch);
    console.log(`Votes created: ${voteTotal}`);
    console.log(`Comments created: ${commentTotal}`);

    // ---------- 6. SMS Subscriptions and Votes ----------
    const smsPhones = [
      "+251911234567",
      "+251922345678",
      "+251933456789",
      "+251944567890",
      "+251955678901",
    ];
    for (const phone of smsPhones) {
      await SmsSubscription.create({
        phoneHash: hashPhone(phone),
        subscribed: true,
        subscribedAt: randomDate(new Date(2025, 0, 1), new Date(2026, 4, 18)),
      });
    }
    let smsVoteCount = 0;
    for (const policy of policies) {
      if (policy.status !== "active") continue;
      for (const phone of smsPhones) {
        const value = generateVoteValue(policy.pollType, policy);
        await Vote.create({
          policyId: policy._id,
          userId: null,
          phoneHash: hashPhone(phone),
          channel: "sms",
          value,
          region: null,
          demographics: null,
          createdAt: randomDate(
            policy.startDate,
            new Date(Math.min(new Date(), policy.endDate)),
          ),
        });
        smsVoteCount++;
      }
    }
    console.log(`SMS votes created: ${smsVoteCount}`);

    // ---------- 7. Generate JWT Tokens ----------
    console.log("\nGenerating JWT tokens...");
    const tokens = [];
    const allUsers = await User.find({});
    const generateToken = (user) =>
      jwt.sign(
        {
          id: user._id.toString(),
          role: user.role,
          region: user.region,
          verified: user.verified,
        },
        JWT_SECRET,
        { expiresIn: "7d" },
      );
    for (const user of allUsers) {
      tokens.push({
        email: user.email,
        token: generateToken(user),
        role: user.role,
      });
    }
    const tokensDir = path.join(__dirname, "../tokens");
    if (!fs.existsSync(tokensDir)) fs.mkdirSync(tokensDir);
    fs.writeFileSync(
      path.join(tokensDir, "seed_tokens.json"),
      JSON.stringify(tokens, null, 2),
    );
    console.log(`Tokens saved to ${path.join(tokensDir, "seed_tokens.json")}`);

    // ---------- 8. Summary ----------
    const finalVotes = await Vote.countDocuments();
    const finalComments = await Comment.countDocuments();
    console.log("\n========== SEED COMPLETE ==========");
    console.log(`Planners: ${planners.length}`);
    console.log(`Citizens: ${citizens.length}`);
    console.log(`Policies: ${policies.length}`);
    console.log(`Total votes: ${finalVotes}`);
    console.log(`Total comments: ${finalComments}`);
    console.log(
      `Average votes per policy: ${(finalVotes / policies.length).toFixed(1)}`,
    );
    console.log(
      `Average comments per policy: ${(finalComments / policies.length).toFixed(1)}`,
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
