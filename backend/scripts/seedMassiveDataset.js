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
const JWT_SECRET = process.env.JWT_SECRET;
const DEFAULT_PASSWORD = process.env.SEED_DEFAULT_PASSWORD || "Pass123!";

if (!JWT_SECRET) {
  console.error("JWT_SECRET not defined in .env");
  process.exit(1);
}

const ALL_REGION_POLLS = Number(process.env.SEED_ALL_REGION_POLLS || 100);
const REGION_POLLS = Number(process.env.SEED_REGION_POLLS || 200);
const COMMENTS_PER_POLL = Number(process.env.SEED_COMMENTS_PER_POLL || 20);
const PLANNER_COUNT = Number(process.env.SEED_PLANNER_COUNT || 8);
const CITIZENS_PER_REGION = Number(process.env.SEED_CITIZENS_PER_REGION || 5);

const nanoid = customAlphabet("ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789", 6);

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
const pollTypes = [
  "binary",
  "multipleChoice",
  "likert",
  "approval",
  "rating",
  "rankedChoice",
];
const statuses = ["draft", "published", "active", "paused", "closed", "archived"];

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

const topicKeywords = {
  Health: ["hospitals", "medicine", "clinics", "care", "access"],
  Education: ["schools", "teachers", "students", "learning", "books"],
  "Water Supply": ["water", "pipes", "sanitation", "drought", "access"],
  Electricity: ["power", "grid", "energy", "outage", "supply"],
  Housing: ["housing", "rent", "shelter", "construction", "affordability"],
  Transport: ["buses", "mobility", "commute", "stations", "routes"],
  Roads: ["roads", "bridges", "traffic", "repairs", "connectivity"],
  "Digital Infrastructure": ["internet", "broadband", "connectivity", "digital", "access"],
  Agriculture: ["farmers", "crops", "irrigation", "subsidies", "harvest"],
  Environment: ["pollution", "conservation", "trees", "waste", "green"],
  "Climate Change": ["resilience", "floods", "drought", "adaptation", "weather"],
  Economy: ["jobs", "growth", "taxes", "investment", "inflation"],
  Employment: ["jobs", "vacancies", "skills", "training", "hiring"],
  "Small Business": ["business", "entrepreneurs", "credit", "markets", "support"],
  Industry: ["manufacturing", "factories", "production", "trade", "investment"],
  Trade: ["exports", "imports", "markets", "logistics", "prices"],
  Tourism: ["tourism", "visitors", "culture", "jobs", "investment"],
  "Social Protection": ["safety net", "support", "benefits", "families", "welfare"],
  "Food Security": ["food", "prices", "nutrition", "supply", "stability"],
  "Poverty Reduction": ["poverty", "incomes", "opportunity", "support", "development"],
  Governance: ["transparency", "accountability", "leadership", "services", "trust"],
  Justice: ["courts", "rights", "fairness", "law", "access"],
  "Public Safety": ["safety", "crime", "police", "security", "protection"],
  "Urban Planning": ["cities", "zoning", "housing", "transport", "growth"],
  "Rural Development": ["villages", "roads", "services", "farms", "access"],
  Youth: ["youth", "training", "jobs", "skills", "opportunity"],
  "Women Affairs": ["women", "equality", "opportunity", "protection", "leadership"],
  default: ["policy", "community", "improvement", "change", "support"],
};

const commentBySentiment = {
  positive: [
    "This is a strong idea and should help the community.",
    "I support this direction and think it can make a real difference.",
    "This looks practical and beneficial if implemented well.",
    "A positive step for the region and its people.",
    "This could improve lives in a meaningful way.",
  ],
  negative: [
    "This feels rushed and may create more problems than it solves.",
    "I do not support this approach as written.",
    "The proposal seems weak and needs major revision.",
    "This may not work well in practice.",
    "There are too many gaps in this plan.",
  ],
  neutral: [
    "I need more details before taking a firm position.",
    "There are good and bad parts, so I am still undecided.",
    "This could work, but the implementation matters.",
    "I am neutral for now and want to see more evidence.",
    "The idea is fine, but more explanation would help.",
  ],
};

const randomItem = (arr) => arr[Math.floor(Math.random() * arr.length)];
const randomInt = (min, max) =>
  Math.floor(Math.random() * (max - min + 1)) + min;
const shuffle = (items) => [...items].sort(() => 0.5 - Math.random());
const randomDate = (daysBack = 180) =>
  new Date(Date.now() - randomInt(1, daysBack) * 24 * 60 * 60 * 1000);

const batchInsert = async (Model, docs, batchSize = 500) => {
  const inserted = [];
  for (let i = 0; i < docs.length; i += batchSize) {
    const batch = docs.slice(i, i + batchSize);
    const result = await Model.insertMany(batch, { ordered: false });
    inserted.push(...result);
  }
  return inserted;
};

const generatePolicyCode = (prefix, index) =>
  `${prefix}-${String(index + 1).padStart(3, "0")}-${nanoid()}`;

const regionCode = (region) => region.replace(/[^A-Za-z0-9]/g, "").slice(0, 4).toUpperCase();

const makeTitle = ({ label, pollType, status, topic, index }) =>
  `${label} ${pollType} ${status} #${String(index + 1).padStart(3, "0")} - ${topic}`;

const buildPollOptions = (pollType, topic) => {
  if (pollType === "binary") {
    return [
      { id: "yes", text: `Yes, support the ${topic.toLowerCase()} proposal` },
      { id: "no", text: `No, reject the ${topic.toLowerCase()} proposal` },
    ];
  }

  if (pollType === "approval") {
    return [
      { id: "approve", text: `Approve the ${topic.toLowerCase()} proposal` },
      { id: "reject", text: `Reject the ${topic.toLowerCase()} proposal` },
      { id: "abstain", text: "Abstain" },
    ];
  }

  if (pollType === "multipleChoice") {
    return [
      { id: "funding", text: "Increase funding" },
      { id: "phased", text: "Roll out in phases" },
      { id: "pilot", text: "Start with a pilot" },
      { id: "delay", text: "Delay and review" },
    ];
  }

  if (pollType === "rankedChoice") {
    return [
      { id: "priority1", text: `${topic} as first priority` },
      { id: "priority2", text: "Education" },
      { id: "priority3", text: "Health" },
      { id: "priority4", text: "Infrastructure" },
    ];
  }

  return [];
};

const buildLikertLabels = (topic) => [
  `Very negative for ${topic.toLowerCase()}`,
  `Negative for ${topic.toLowerCase()}`,
  "Neutral",
  `Positive for ${topic.toLowerCase()}`,
  `Very positive for ${topic.toLowerCase()}`,
];

const sentimentFromSlot = (slot) => {
  if (slot % 3 === 0) return "positive";
  if (slot % 3 === 1) return "neutral";
  return "negative";
};

const buildCommentText = (sentiment, topic, region, status) => {
  const base = randomItem(commentBySentiment[sentiment]);
  return `${base} It is being discussed for ${topic.toLowerCase()} in ${region}. Current poll status: ${status}.`;
};

const buildKeywords = (topic) => {
  const pool = topicKeywords[topic] || topicKeywords.default;
  return shuffle(pool).slice(0, randomInt(2, 4));
};

const buildUserDisplayName = (role, index, region) =>
  `${role === "admin" ? "Admin" : role === "planner" ? "Planner" : "Citizen"}_${regionCode(region)}_${String(index + 1).padStart(3, "0")}`;

const createUsers = async () => {
  const passwordHash = await hashPassword(DEFAULT_PASSWORD);

  const admin = {
    email: "admin@example.com",
    passwordHash,
    phoneHash: hashPhone("+251911111111"),
    region: "Addis Ababa",
    role: "admin",
    verified: true,
    active: true,
    ageRange: "35-44",
    gender: "male",
    occupation: "government-employee",
    education: "postgraduate",
    preferredLanguage: "en",
    languagesSpoken: ["en", "am"],
    tokenVersion: 0,
    displayName: "Admin_Addis_001",
  };

  const plannerSeedData = Array.from({ length: PLANNER_COUNT }, (_, index) => {
    const region = regions[index % regions.length];
    const spoken = ["en"];
    if (index % 3 === 0) spoken.push("am");
    if (index % 3 === 1) spoken.push("om");
    if (index % 3 === 2) spoken.push("ti");
    return {
      email: `planner${index + 1}@test.com`,
      passwordHash,
      phoneHash: hashPhone(`+25191300${String(1000 + index).slice(-4)}`),
      region,
      role: "planner",
      verified: true,
      active: true,
      ageRange: randomItem(["25-34", "35-44", "45-54"]),
      gender: randomItem(["male", "female"]),
      occupation: randomItem(["government-employee", "private-sector"]),
      education: randomItem(["bachelors", "postgraduate"]),
      preferredLanguage: spoken[1] || "en",
      languagesSpoken: spoken,
      trainingCompletedAt: new Date(),
      tokenVersion: 0,
      displayName: buildUserDisplayName("planner", index, region),
    };
  });

  const citizenSeedData = [];
  let citizenIndex = 0;
  for (const region of regions) {
    for (let i = 0; i < CITIZENS_PER_REGION; i++) {
      citizenSeedData.push({
        email: `citizen${citizenIndex + 1}@test.com`,
        passwordHash,
        phoneHash: hashPhone(`+251914${String(100000 + citizenIndex).slice(-6)}`),
        region,
        role: "citizen",
        verified: true,
        active: true,
        ageRange: randomItem(ageRanges),
        gender: randomItem(genders),
        occupation: randomItem(occupations),
        education: randomItem(educations),
        preferredLanguage: randomItem(["am", "om", "ti", "en"]),
        languagesSpoken: shuffle(["am", "om", "ti", "en"]).slice(0, randomInt(1, 3)),
        tokenVersion: 0,
        displayName: buildUserDisplayName("citizen", citizenIndex, region),
      });
      citizenIndex += 1;
    }
  }

  const [adminUser] = await User.insertMany([admin], { ordered: true });
  const planners = await User.insertMany(plannerSeedData, { ordered: true });
  const citizens = await User.insertMany(citizenSeedData, { ordered: true });

  return { adminUser, planners, citizens };
};

const createPolicies = async ({ planners }) => {
  const policies = [];
  const allRegionRegionSet = [...regions];

  for (let i = 0; i < ALL_REGION_POLLS; i++) {
    const pollType = pollTypes[i % pollTypes.length];
    const status = statuses[i % statuses.length];
    const topic = topicPool[i % topicPool.length];
    const owner = planners[i % planners.length];
    const title = makeTitle({ label: "All Regions", pollType, status, topic, index: i });
    policies.push({
      title,
      description: `Nationwide ${topic.toLowerCase()} poll for every region.`,
      targetRegions: allRegionRegionSet,
      policyCode: generatePolicyCode(`ALL-${regionCode(topic)}`, i),
      startDate: new Date(Date.now() - randomInt(30, 240) * 86400000),
      endDate: new Date(Date.now() + randomInt(15, 240) * 86400000),
      status,
      createdBy: owner._id,
      pollType,
      pollOptions: buildPollOptions(pollType, topic),
      maxSelections: pollType === "multipleChoice" ? 2 : 1,
      likertLabels: pollType === "likert" ? buildLikertLabels(topic) : undefined,
      rankedChoiceMaxRank: pollType === "rankedChoice" ? 3 : undefined,
      relevanceFactors: {
        women: i % 5 === 0,
        youth: i % 4 === 0,
        farmers: topic === "Agriculture" || topic === "Food Security",
        urban: i % 2 === 0,
        rural: i % 3 === 0,
        privateSector: i % 6 === 0,
        government: i % 7 === 0,
      },
      citizenAnalyticsVisibility: {
        showResults: true,
        showBreakdown: i % 2 === 0,
        showComments: i % 3 !== 0,
        showSentiment: i % 4 === 0,
        allowTimeFilter: i % 5 === 0,
      },
      topics: [topic, randomItem(topicPool)],
    });
  }

  for (let i = 0; i < REGION_POLLS; i++) {
    const pollType = pollTypes[(i + 1) % pollTypes.length];
    const status = statuses[(i + 2) % statuses.length];
    const topic = topicPool[(i + 7) % topicPool.length];
    const owner = planners[(i + 1) % planners.length];
    const startIndex = i % regions.length;
    const regionCount = 1 + (i % 3);
    const targetRegions = Array.from({ length: regionCount }, (_, offset) =>
      regions[(startIndex + offset) % regions.length],
    );
    const title = makeTitle({
      label: `Regional ${targetRegions.join(" / ")}`,
      pollType,
      status,
      topic,
      index: i,
    });

    policies.push({
      title,
      description: `Regional poll focused on ${targetRegions.join(", ")}.`,
      targetRegions,
      policyCode: generatePolicyCode(`REG-${regionCode(targetRegions[0])}`, i),
      startDate: new Date(Date.now() - randomInt(15, 180) * 86400000),
      endDate: new Date(Date.now() + randomInt(10, 180) * 86400000),
      status,
      createdBy: owner._id,
      pollType,
      pollOptions: buildPollOptions(pollType, topic),
      maxSelections: pollType === "multipleChoice" ? 2 : 1,
      likertLabels: pollType === "likert" ? buildLikertLabels(topic) : undefined,
      rankedChoiceMaxRank: pollType === "rankedChoice" ? 3 : undefined,
      relevanceFactors: {
        women: i % 4 === 0,
        youth: i % 3 === 0,
        farmers: topic === "Agriculture" || topic === "Rural Development",
        urban: targetRegions.includes("Addis Ababa") || targetRegions.includes("Dire Dawa"),
        rural: targetRegions.length > 1,
        privateSector: i % 5 === 0,
        government: i % 6 === 0,
      },
      citizenAnalyticsVisibility: {
        showResults: true,
        showBreakdown: i % 2 === 1,
        showComments: i % 3 === 0,
        showSentiment: i % 4 !== 0,
        allowTimeFilter: i % 5 !== 0,
      },
      topics: [topic, randomItem(topicPool)],
    });
  }

  return await Policy.insertMany(policies, { ordered: true });
};

const pickEligibleCitizens = (citizens, targetRegions) => {
  const pool = targetRegions.includes("Addis Ababa") && targetRegions.length === regions.length
    ? citizens
    : citizens.filter((citizen) => targetRegions.includes(citizen.region));
  return pool.length ? pool : citizens;
};

const votesPerStatus = {
  draft: 0,
  published: 5,
  active: 10,
  paused: 4,
  closed: 6,
  archived: 2,
};

const createVotes = async ({ citizens, policies }) => {
  const voteDocs = [];

  for (const policy of policies) {
    const eligibleCitizens = pickEligibleCitizens(citizens, policy.targetRegions || regions);
    const sampleSize = Math.min(votesPerStatus[policy.status] ?? 3, eligibleCitizens.length);
    const voters = shuffle(eligibleCitizens).slice(0, sampleSize);

    for (const citizen of voters) {
      const value = (() => {
        switch (policy.pollType) {
          case "binary":
            return randomItem(["yes", "no"]);
          case "multipleChoice": {
            const optionIds = (policy.pollOptions || []).map((opt) => opt.id);
            return shuffle(optionIds).slice(0, Math.min(policy.maxSelections || 1, optionIds.length));
          }
          case "likert":
            return randomInt(1, 5);
          case "approval":
            return randomItem(["approve", "reject", "abstain"]);
          case "rating":
            return randomInt(1, 5);
          case "rankedChoice": {
            const optionIds = (policy.pollOptions || []).map((opt) => opt.id);
            return shuffle(optionIds).slice(0, Math.min(policy.rankedChoiceMaxRank || 3, optionIds.length));
          }
          default:
            return 3;
        }
      })();

      voteDocs.push({
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
        createdAt: randomDate(220),
      });
    }
  }

  return await batchInsert(Vote, voteDocs, 1000);
};

const createComments = async ({ citizens, policies }) => {
  const commentDocs = [];
  const now = new Date();

  for (const policy of policies) {
    const eligibleCitizens = pickEligibleCitizens(citizens, policy.targetRegions || regions);
    for (let i = 0; i < COMMENTS_PER_POLL; i++) {
      const citizen = randomItem(eligibleCitizens);
      const topic = policy.topics?.[0] || randomItem(topicPool);
      const sentimentSlot = i % 20;
      const sentiment = sentimentFromSlot(sentimentSlot);
      const keywords = buildKeywords(topic);
      const createdAt = new Date(now.getTime() - randomInt(1, 200) * 86400000);

      if (sentimentSlot <= 15) {
        const text = buildCommentText(sentiment, topic, citizen.region, policy.status);
        commentDocs.push({
          policyId: policy._id,
          userId: citizen._id,
          parentCommentId: null,
          text,
          visibility: "visible",
          aiStatus: "processed",
          sentiment: {
            label: sentiment,
            confidence: sentiment === "neutral" ? 0.82 : 0.91,
            overriddenByModerator: false,
          },
          keywords,
          aiAnalysis: {
            raw: { sentiment, keywords },
            version: "mass-seed-v1",
            analyzedAt: createdAt,
          },
          lastAnalyzedAt: createdAt,
          reportState: "clean",
          reportCount: 0,
          reports: [],
          reviewFlags: {
            sentimentReviewNeeded: false,
            moderationReviewNeeded: false,
          },
          moderationActions: [],
          events: [
            {
              type: "created",
              actor: citizen._id,
              data: { text },
              createdAt,
            },
            {
              type: "ai_analyzed",
              actor: null,
              data: { sentiment, confidence: sentiment === "neutral" ? 0.82 : 0.91, keywords },
              createdAt,
            },
          ],
          createdAt,
        });
        continue;
      }

      if (sentimentSlot === 16 || sentimentSlot === 17) {
        const text = `This is a low-confidence test comment for ${topic.toLowerCase()} in ${citizen.region}.`;
        commentDocs.push({
          policyId: policy._id,
          userId: citizen._id,
          parentCommentId: null,
          text,
          visibility: "visible",
          aiStatus: "processed",
          sentiment: {
            label: "neutral",
            confidence: 0.42,
            overriddenByModerator: false,
          },
          keywords: ["test", "uncertain", topic.toLowerCase()],
          aiAnalysis: {
            raw: { sentiment: "neutral", confidence: 0.42 },
            version: "mass-seed-v1",
            analyzedAt: createdAt,
          },
          lastAnalyzedAt: createdAt,
          reportState: "clean",
          reportCount: 0,
          reports: [],
          reviewFlags: {
            sentimentReviewNeeded: true,
            moderationReviewNeeded: false,
          },
          moderationActions: [],
          events: [
            {
              type: "created",
              actor: citizen._id,
              data: { text },
              createdAt,
            },
            {
              type: "ai_analyzed",
              actor: null,
              data: { sentiment: "neutral", confidence: 0.42, keywords: ["test", "uncertain"] },
              createdAt,
            },
          ],
          createdAt,
        });
        continue;
      }

      if (sentimentSlot === 18) {
        const text = `This comment was reported in the ${policy.status} ${topic.toLowerCase()} poll.`;
        commentDocs.push({
          policyId: policy._id,
          userId: citizen._id,
          parentCommentId: null,
          text,
          visibility: "hidden",
          aiStatus: "processed",
          sentiment: {
            label: "negative",
            confidence: 0.95,
            overriddenByModerator: false,
          },
          keywords: ["reported", topic.toLowerCase()],
          aiAnalysis: {
            raw: { sentiment: "negative", confidence: 0.95 },
            version: "mass-seed-v1",
            analyzedAt: createdAt,
          },
          lastAnalyzedAt: createdAt,
          reportState: "reported",
          reportCount: 3,
          reports: [
            {
              reporterId: randomItem(eligibleCitizens)._id,
              reason: "inappropriate",
              status: "pending",
              createdAt,
              snapshot: {
                text,
                sentiment: { label: "negative", confidence: 0.95 },
                keywords: ["reported", topic.toLowerCase()],
                visibility: "visible",
                aiStatus: "processed",
                reportCount: 0,
              },
            },
            {
              reporterId: randomItem(eligibleCitizens)._id,
              reason: "spam",
              status: "pending",
              createdAt,
              snapshot: {
                text,
                sentiment: { label: "negative", confidence: 0.95 },
                keywords: ["reported", topic.toLowerCase()],
                visibility: "visible",
                aiStatus: "processed",
                reportCount: 1,
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
              reason: "auto_seed_reported",
              actor: null,
              createdAt,
            },
          ],
          events: [
            {
              type: "created",
              actor: citizen._id,
              data: { text },
              createdAt,
            },
            {
              type: "reported",
              actor: null,
              data: { reportCount: 3 },
              createdAt,
            },
          ],
          createdAt,
        });
        continue;
      }

      const text = `I want to appeal the moderation on this ${topic.toLowerCase()} comment in ${citizen.region}.`;
      commentDocs.push({
        policyId: policy._id,
        userId: citizen._id,
        parentCommentId: null,
        text,
        visibility: "hidden",
        aiStatus: "processed",
        sentiment: {
          label: "neutral",
          confidence: 0.55,
          overriddenByModerator: false,
        },
        keywords: ["appeal", topic.toLowerCase()],
        aiAnalysis: {
          raw: { sentiment: "neutral", confidence: 0.55 },
          version: "mass-seed-v1",
          analyzedAt: createdAt,
        },
        lastAnalyzedAt: createdAt,
        reportState: "clean",
        reportCount: 0,
        reports: [],
        appeal: {
          appellantId: citizen._id,
          reason: "I believe this moderation decision should be reviewed.",
          status: "pending",
          createdAt,
          snapshot: {
            text,
            visibility: "hidden",
            reportState: "clean",
            reportCount: 0,
          },
        },
        reviewFlags: {
          sentimentReviewNeeded: false,
          moderationReviewNeeded: true,
        },
        moderationActions: [
          {
            action: "hide",
            reason: "seed_appeal_case",
            actor: null,
            createdAt,
          },
        ],
        events: [
          {
            type: "created",
            actor: citizen._id,
            data: { text },
            createdAt,
          },
          {
            type: "appealed",
            actor: citizen._id,
            data: { reason: "I believe this moderation decision should be reviewed." },
            createdAt,
          },
        ],
        createdAt,
      });
    }
  }

  return await batchInsert(Comment, commentDocs, 1000);
};

const createSupportingData = async ({ planners, citizens, policies }) => {
  const smsPhones = [
    "+251911234567",
    "+251922345678",
    "+251933456789",
    "+251944567890",
    "+251955678901",
  ];

  const smsDocs = smsPhones.map((phone) => ({
    phoneHash: hashPhone(phone),
    subscribed: true,
    subscribedAt: new Date(),
  }));
  await SmsSubscription.insertMany(smsDocs, { ordered: false });

    const plannerRequests = planners.slice(0, Math.min(4, planners.length)).map((planner, index) => ({
    userId: planner._id,
    fullName: `${planner.displayName} Request`,
    region: planner.region,
    reason:
      index % 2 === 0
        ? "Requesting planner access to moderate comments and oversee policy feedback."
        : "Need access to regional dashboards and comment moderation tools.",
    status: index === 0 ? "approved" : index === 1 ? "pending" : index === 2 ? "rejected" : "approved",
    reviewedBy: null,
    reviewedAt: null,
    createdAt: new Date(),
  }));
  await PlannerRequest.insertMany(plannerRequests, { ordered: false });

    const policyAssociates = policies.slice(0, 18).map((policy, index) => ({
    plannerId: planners[index % planners.length]._id,
    policyId: policy._id,
    permissions: index % 2 === 0 ? ["moderate_comments"] : ["moderate_comments", "reply_official"],
    invitationStatus: index % 3 === 0 ? "pending" : index % 3 === 1 ? "accepted" : "expired",
    invitedAt: new Date(Date.now() - randomInt(1, 120) * 86400000),
    expiresAt: new Date(Date.now() + randomInt(7, 30) * 86400000),
      assignedBy: planners[(index + 1) % planners.length]._id,
    createdAt: new Date(),
  }));
  await PolicyAssociate.insertMany(policyAssociates, { ordered: false });

  const notifications = [
    {
      userId: citizens[0]._id,
      userRole: "citizen",
      type: "COMMENT_REPLY",
      title: "New reply on your comment",
      message: "A planner replied to your comment on a regional poll.",
      read: false,
      data: { policyId: policies[0]._id.toString() },
      createdAt: new Date(),
    },
    {
      userId: planners[0]._id,
      userRole: "planner",
      type: "PLANNER_APPROVED",
      title: "Planner access approved",
      message: "Your planner account is active and ready.",
      read: false,
      data: {},
      createdAt: new Date(),
    },
  ];
  await Notification.insertMany(notifications, { ordered: false });

  const auditLogs = [
    {
      userId: planners[0]._id,
      userRole: "planner",
      action: "mass_seed_created",
      targetType: "Policy",
      targetId: policies[0]._id,
      details: { note: "Massive seed dataset generated." },
      createdAt: new Date(),
    },
    {
      userId: citizens[0]._id,
      userRole: "citizen",
      action: "mass_seed_comment",
      targetType: "Comment",
      targetId: null,
      details: { note: "Seed comment created for testing." },
      createdAt: new Date(),
    },
  ];
  await AuditLog.insertMany(auditLogs, { ordered: false });
};

const saveTokens = (users) => {
  const tokens = users.map((user) => ({
    email: user.email,
    role: user.role,
    token: jwt.sign(
      {
        id: user._id.toString(),
        role: user.role,
        region: user.region,
        verified: user.verified,
      },
      JWT_SECRET,
      { expiresIn: "7d" },
    ),
  }));

  const tokensDir = path.join(__dirname, "../tokens");
  if (!fs.existsSync(tokensDir)) fs.mkdirSync(tokensDir, { recursive: true });
  const tokenPath = path.join(tokensDir, "massive_seed_tokens.json");
  fs.writeFileSync(tokenPath, JSON.stringify(tokens, null, 2));
  return tokenPath;
};

async function seed() {
  try {
    console.log("Connecting to MongoDB...");
    await mongoose.connect(MONGO_URI);
    console.log("Connected.");

    console.log("Cleaning existing non-admin data...");
    await Promise.all([
      Vote.deleteMany({}),
      Comment.deleteMany({}),
      Policy.deleteMany({}),
      Notification.deleteMany({}),
      AuditLog.deleteMany({}),
      SmsSubscription.deleteMany({}),
      PlannerRequest.deleteMany({}),
      PolicyAssociate.deleteMany({}),
      User.deleteMany({}),
    ]);

    await Promise.all([
      User.syncIndexes(),
      Policy.syncIndexes(),
      Vote.syncIndexes(),
      Comment.syncIndexes(),
      Notification.syncIndexes(),
      AuditLog.syncIndexes(),
      SmsSubscription.syncIndexes(),
      PlannerRequest.syncIndexes(),
      PolicyAssociate.syncIndexes(),
    ]);

    const { planners, citizens } = await createUsers();
    const policies = await createPolicies({ planners });
    await createVotes({ citizens, policies });
    await createComments({ citizens, policies });
    await createSupportingData({ planners, citizens, policies });

    const allUsers = await User.find({ role: { $in: ["citizen", "planner", "admin"] } });
    const tokenPath = saveTokens(allUsers);

    const counts = await Promise.all([
      User.countDocuments({ role: "planner" }),
      User.countDocuments({ role: "citizen" }),
      Policy.countDocuments(),
      Vote.countDocuments(),
      Comment.countDocuments(),
      Notification.countDocuments(),
      SmsSubscription.countDocuments({ subscribed: true }),
    ]);

    const [plannerCount, citizenCount, policyCount, voteCount, commentCount, notificationCount, smsCount] = counts;

    console.log("\n========== MASSIVE SEED COMPLETE ==========");
    console.log(`Planners: ${plannerCount}`);
    console.log(`Citizens: ${citizenCount}`);
    console.log(`Policies: ${policyCount}`);
    console.log(`  - All-region polls: ${ALL_REGION_POLLS}`);
    console.log(`  - Region-specific polls: ${REGION_POLLS}`);
    console.log(`Votes: ${voteCount}`);
    console.log(`Comments: ${commentCount}`);
    console.log(`Notifications: ${notificationCount}`);
    console.log(`SMS subscriptions: ${smsCount}`);
    console.log(`Tokens saved to: ${tokenPath}`);
    console.log("===========================================\n");

    await mongoose.disconnect();
  } catch (err) {
    console.error("Error during massive seeding:", err);
    await mongoose.disconnect();
    process.exit(1);
  }
}

seed();