const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");
const axios = require("axios");
const path = require("path");
const fs = require("fs");
require("dotenv").config({ path: path.join(__dirname, "../.env") });

const User = require("../src/models/User");
const Policy = require("../src/models/Policy");
const Vote = require("../src/models/Vote");
const Comment = require("../src/models/Comment");
const SmsSubscription = require("../src/models/SmsSubscription"); // <-- new

const MONGO_URI =
  process.env.MONGO_URI || "mongodb://localhost:27017/communityinsight";
const API_URL = process.env.API_URL || "http://localhost:5000/api";
const DEFAULT_PASSWORD = "Pass123!";

// Ethiopian regions (for geographic coverage)
const ALL_REGIONS = [
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

const randomItem = (arr) => arr[Math.floor(Math.random() * arr.length)];
const randomInt = (min, max) =>
  Math.floor(Math.random() * (max - min + 1)) + min;

// Generate a random date between 2026-02-01 and 2026-04-30
const randomVoteDate = () => {
  const start = new Date("2026-02-01T00:00:00Z");
  const end = new Date("2026-04-30T23:59:59Z");
  return new Date(
    start.getTime() + Math.random() * (end.getTime() - start.getTime()),
  );
};

const generateComment = (sentiment) => {
  const comments = {
    positive: [
      "This policy is excellent! It will help many people. በጣም ጥሩ ፖሊሲ ነው።",
      "I fully support this initiative. Great work!",
      "Finally a policy that addresses our needs. Thank you.",
      "This will improve access to clean water. Very positive step.",
      "The government is listening to citizens. Keep it up!",
    ],
    negative: [
      "This policy does not consider rural areas. Disappointed.",
      "Waste of tax money. No consultation with locals.",
      "Implementation will fail like previous ones. Not happy.",
      "The timeline is unrealistic. We need more time.",
      "Excludes important stakeholders. Bad approach.",
    ],
    neutral: [
      "Need more details before forming an opinion.",
      "Some good points, some concerns. Let's see implementation.",
      "The policy has pros and cons. Neutral for now.",
      "Waiting for pilot results.",
    ],
  };
  return randomItem(comments[sentiment]);
};

const extractKeywordsFromComment = (comment) => {
  const words = comment.toLowerCase().split(/\W+/);
  const common = [
    "policy",
    "water",
    "access",
    "money",
    "government",
    "citizens",
    "implementation",
    "support",
    "time",
    "education",
    "road",
    "health",
    "business",
    "youth",
  ];
  const found = words.filter((w) => common.includes(w) && w.length > 3);
  return [...new Set(found.slice(0, 3))];
};

const getSentimentObject = (label) => {
  const confidence =
    label === "neutral" ? randomInt(50, 80) / 100 : randomInt(70, 98) / 100;
  return { label, confidence };
};

// Wait for backend to be ready
async function waitForBackend(retries = 10, delayMs = 2000) {
  const healthUrl = API_URL.replace("/api", "") + "/health";
  for (let i = 0; i < retries; i++) {
    try {
      await axios.get(healthUrl, { timeout: 5000 });
      console.log("Backend is ready.");
      return true;
    } catch (err) {
      console.log(`Waiting for backend... (${i + 1}/${retries})`);
      await new Promise((resolve) => setTimeout(resolve, delayMs));
    }
  }
  console.warn("Backend not reachable after retries. Continuing anyway...");
  return false;
}

async function loginAndSaveTokens(users, filename, retries = 3) {
  const tokens = [];
  for (const user of users) {
    let success = false;
    for (let attempt = 1; attempt <= retries; attempt++) {
      try {
        await new Promise((resolve) => setTimeout(resolve, 500 * attempt));
        const response = await axios.post(
          `${API_URL}/auth/login`,
          {
            email: user.email,
            password: DEFAULT_PASSWORD,
          },
          { timeout: 10000 },
        );
        if (response.data.status === "success") {
          tokens.push({
            email: user.email,
            token: response.data.data.token,
            role: response.data.data.role,
          });
          console.log(`   Logged in: ${user.email}`);
          success = true;
          break;
        } else {
          console.warn(
            `   Login failed for ${user.email} (attempt ${attempt}): ${response.data.message}`,
          );
        }
      } catch (err) {
        console.warn(
          `   Login error for ${user.email} (attempt ${attempt}): ${err.response?.data?.error?.message || err.message}`,
        );
      }
    }
    if (!success) {
      console.error(
        `   Could not log in ${user.email} after ${retries} attempts.`,
      );
    }
  }
  const tokensDir = path.join(__dirname, "../tokens");
  if (!fs.existsSync(tokensDir)) fs.mkdirSync(tokensDir);
  const filePath = path.join(tokensDir, filename);
  fs.writeFileSync(filePath, JSON.stringify(tokens, null, 2));
  console.log(`   Tokens saved to ${filePath}`);
  return tokens;
}

async function seed() {
  try {
    console.log("Connecting to MongoDB...");
    await mongoose.connect(MONGO_URI);
    console.log("Connected to MongoDB");

    // Drop existing data (keep admin users)
    console.log("Cleaning database (keeping admin users)...");
    await Vote.deleteMany({});
    await Comment.deleteMany({});
    await Policy.deleteMany({});
    await SmsSubscription.deleteMany({}); // clear old subscriptions
    await User.deleteMany({ role: { $ne: "admin" } });
    console.log("Cleaned.");

    // Sync indexes
    await Vote.syncIndexes();
    await Comment.syncIndexes();
    await SmsSubscription.syncIndexes();
    console.log("Indexes synced");

    const passwordHash = await bcrypt.hash(DEFAULT_PASSWORD, 10);

    // ---- 1. Create 2 planners ----
    const planners = [];
    for (let i = 1; i <= 2; i++) {
      const email = `planner${i}@test.com`;
      const user = new User({
        email,
        passwordHash,
        phoneHash: `planner_dummy_${i}_${Date.now()}`,
        region: randomItem(ALL_REGIONS),
        ageRange: randomItem(["25-34", "35-44", "45-54"]),
        gender: randomItem(["male", "female"]),
        occupation: randomItem(["government-employee", "private-sector"]),
        education: randomItem(["bachelors", "postgraduate"]),
        languagesSpoken: ["en", randomItem(["am", "om", "ti"])],
        role: "planner",
        verified: true,
        active: true,
        trainingCompletedAt: new Date(),
      });
      await user.save();
      planners.push({ email, _id: user._id.toString() });
    }
    console.log(
      `Created ${planners.length} planners (password: ${DEFAULT_PASSWORD})`,
    );

    // ---- 2. Create 2 citizens per region (total 22) ----
    const citizens = [];
    let citizenIndex = 1;
    for (const region of ALL_REGIONS) {
      for (let j = 1; j <= 2; j++) {
        const email = `citizen${citizenIndex}@test.com`;
        const phoneHash = `hash_${Math.random().toString(36).substring(2, 15)}`;
        const user = new User({
          email,
          passwordHash,
          phoneHash,
          region,
          ageRange: randomItem(["18-24", "25-34", "35-44", "45-54", "55+"]),
          gender: randomItem(["male", "female", "non-binary"]),
          occupation: randomItem(["student", "farmer", "merchant", "government-employee", "private-sector", "unemployed"]),
          education: randomItem(["no-formal", "primary", "secondary", "diploma", "bachelors"]),
          role: "citizen",
          verified: true,
          active: true,
        });
        await user.save();
        citizens.push({ email, _id: user._id.toString(), region, phoneHash });
        citizenIndex++;
      }
    }
    console.log(
      `Created ${citizens.length} citizens (2 per region, password: ${DEFAULT_PASSWORD})`,
    );

    // ---- 3. Create policies ----
    const policyTitles = [
      "Geographic Test Policy (All Regions)",
      "Clean Water Access Initiative",
      "Digital Education for All",
      "Rural Road Development",
      "Healthcare Modernization",
      "Youth Employment Scheme",
    ];
    const policies = [];
    for (let i = 0; i < policyTitles.length; i++) {
      const title = policyTitles[i];
      const description = `${title} – a comprehensive policy to improve lives.`;
      let targetRegions;
      if (i === 0) {
        targetRegions = [...ALL_REGIONS];
      } else {
        targetRegions = [
          randomItem(ALL_REGIONS),
          randomItem(ALL_REGIONS),
        ].slice(0, randomInt(1, 2));
      }
      const startDate = new Date("2026-02-01");
      const endDate = i === 5 ? new Date("2026-03-15") : new Date("2026-07-30");
      let status = "active";
      if (i === 5) status = "closed";
      const createdBy = randomItem(planners)._id;
      const policyCode =
        title.substring(0, 4).toUpperCase() +
        Math.random().toString(36).substring(2, 6).toUpperCase();
      const policy = new Policy({
        title,
        description,
        targetRegions,
        policyCode,
        startDate,
        endDate,
        status,
        createdBy,
      });
      await policy.save();
      policies.push({ ...policy.toObject(), _id: policy._id.toString() });
    }
    const activePolicies = policies.filter((p) => p.status === "active");
    const closedPolicies = policies.filter((p) => p.status === "closed");
    console.log(
      `Created ${policies.length} policies (${activePolicies.length} active, ${closedPolicies.length} closed)`,
    );

    // ---- 4. Create app votes & comments for all active AND closed policies ----
    const policiesToSeed = [...activePolicies, ...closedPolicies];
    let voteCounter = 0;

    for (const policy of policiesToSeed) {
      for (const citizen of citizens) {
        if (!policy.targetRegions.includes(citizen.region)) continue;
        voteCounter++;
        const rating = randomInt(1, 5);
        const hasComment = Math.random() > 0.3;
        const createdAt = randomVoteDate();

        const vote = new Vote({
          policyId: policy._id,
          userId: citizen._id,
          phoneHash: citizen.phoneHash,
          channel: "app",
          value: rating,
          region: citizen.region,
          createdAt,
        });
        await vote.save();

        if (hasComment) {
          const sentimentLabel =
            rating <= 2 ? "negative" : rating === 3 ? "neutral" : "positive";
          const commentText = generateComment(sentimentLabel);
          const sentimentObj = getSentimentObject(sentimentLabel);
          const keywords = extractKeywordsFromComment(commentText);
          let moderationStatus = "reviewed";
          if (Math.random() < 0.1) {
            moderationStatus = "needs_review";
            sentimentObj.label = "neutral";
            sentimentObj.confidence = 0;
          }
          const commentDoc = new Comment({
            voteId: vote._id,
            policyId: policy._id,
            userId: citizen._id,
            rating,
            text: commentText,
            sentiment: sentimentObj,
            keywords,
            moderationStatus,
            retryCount: 0,
            nextRetry: null,
            createdAt,
          });
          await commentDoc.save();
        }
      }
    }

    // ---- 5. Create SMS votes and corresponding subscriptions ----
    const smsPhones = [
      "+251911234567",
      "+251922345678",
      "+251933456789",
      "+251944567890",
    ];
    const smsSubscriptions = [];
    for (const phone of smsPhones) {
      const phoneHash = require("../src/utils/helpers").hashPhone(phone);
      const existingSub = await SmsSubscription.findOne({ phoneHash });
      if (!existingSub) {
        const sub = new SmsSubscription({ phoneHash, subscribed: true });
        await sub.save();
        smsSubscriptions.push(sub);
      }
    }
    console.log(`Created ${smsSubscriptions.length} SMS subscriptions.`);

    for (const policy of activePolicies) {
      for (let i = 0; i < 3; i++) {
        const rating = randomInt(1, 5);
        const createdAt = randomVoteDate();
        const phoneHash = require("../src/utils/helpers").hashPhone(
          smsPhones[i % smsPhones.length],
        );
        const vote = new Vote({
          policyId: policy._id,
          userId: null,
          phoneHash,
          channel: "sms",
          value: rating,
          region: null,
          createdAt,
        });
        await vote.save();
      }
    }

    const totalVotes = await Vote.countDocuments();
    const totalComments = await Comment.countDocuments();
    const totalSmsVotes = await Vote.countDocuments({ channel: "sms" });
    console.log(
      `Created ${totalVotes} votes (including ${totalSmsVotes} SMS votes)`,
    );
    console.log(`Created ${totalComments} comments (with AI processing)`);

    const geographicPolicy = activePolicies[0];
    if (geographicPolicy) {
      console.log(
        `\n🔍 Use this policy ID for geographic / heatmap testing: ${geographicPolicy._id}`,
      );
      console.log(`   Policy title: ${geographicPolicy.title}`);
      console.log(`   Target regions: all ${ALL_REGIONS.length} regions`);
    }

    if (closedPolicies.length) {
      console.log(
        `\n🔒 Use this policy ID for closed-policy analytics: ${closedPolicies[0]._id}`,
      );
      console.log(`   Policy title: ${closedPolicies[0].title}`);
    }

    console.log("\nSMS test phone numbers and their subscription status:");
    for (const phone of smsPhones) {
      const phoneHash = require("../src/utils/helpers").hashPhone(phone);
      const sub = await SmsSubscription.findOne({ phoneHash });
      console.log(
        `   ${phone} -> subscribed: ${sub ? sub.subscribed : "no subscription"}`,
      );
    }

    // ---- 6. Obtain JWT tokens for manual API testing (optional) ----
    console.log("\nObtaining JWT tokens for citizens and planners...");
    await waitForBackend();

    let citizenTokens = [],
      plannerTokens = [];
    try {
      citizenTokens = await loginAndSaveTokens(citizens, "citizen_tokens.json");
      plannerTokens = await loginAndSaveTokens(planners, "planner_tokens.json");
      console.log("\nTokens saved to tokens/ directory.");
    } catch (err) {
      console.warn(
        "\nBackend not reachable. Skipping token generation. Start the backend and run again if needed.",
      );
    }

    console.log("\n========== SEED COMPLETE ==========");
    console.log(`Planners: ${planners.length}`);
    console.log(
      `Citizens: ${citizens.length} (2 per region, covering ${ALL_REGIONS.length} regions)`,
    );
    console.log(
      `Policies: ${policies.length} (${activePolicies.length} active, ${closedPolicies.length} closed, 0 draft/published)`,
    );
    console.log(`Total votes: ${totalVotes}`);
    console.log(`  - App votes: ${totalVotes - totalSmsVotes}`);
    console.log(`  - SMS votes: ${totalSmsVotes}`);
    console.log(`Comments: ${totalComments}`);
    console.log(
      `Region snapshots stored on Vote: ${await Vote.countDocuments({ region: { $ne: null } })}`,
    );
    console.log(
      `SMS subscriptions: ${await SmsSubscription.countDocuments({ subscribed: true })}`,
    );
    console.log("===================================\n");

    await mongoose.disconnect();
    console.log("Disconnected.");
  } catch (err) {
    console.error("Seeding error:", err);
    await mongoose.disconnect();
    process.exit(1);
  }
}

seed();
