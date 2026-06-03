const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");
const path = require("path");
require("dotenv").config({ path: path.join(__dirname, "../.env") });

const User = require("../src/models/User");
const Policy = require("../src/models/Policy");
const Vote = require("../src/models/Vote");
const Comment = require("../src/models/Comment");

const MONGO_URI =
  process.env.MONGO_URI || "mongodb://localhost:27017/communityinsight";
const DEFAULT_PASSWORD = "Pass123!";
const PASSWORD_HASH_PROMISE = bcrypt.hash(DEFAULT_PASSWORD, 10);

const REGIONS = [
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

const PLANER_EMAIL = "public.analytics.seed.planner@test.com";
const CITIZEN_PREFIX = "public.analytics.seed.citizen";
const POLICY_PREFIX = "PUBA-";

const fullVisibility = {
  showResults: true,
  showBreakdown: true,
  showComments: true,
  showSentiment: true,
  allowTimeFilter: true,
};

const policyTemplates = [
  {
    title: "Road Safety and Street Lighting",
    description: "Closed policy on improving night visibility and road safety.",
    pollType: "rating",
    targetRegions: ["Addis Ababa", "Oromia"],
  },
  {
    title: "Primary School Meal Support",
    description: "Closed policy on school meal continuity and nutrition.",
    pollType: "binary",
    targetRegions: ["Amhara", "Sidama"],
  },
  {
    title: "Clinic Staffing and Medicine Supply",
    description: "Closed policy on rural health staffing and medicine supply.",
    pollType: "approval",
    targetRegions: ["Tigray", "Afar"],
  },
  {
    title: "Water Access Service Improvement",
    description: "Closed policy on water access and service reliability.",
    pollType: "likert",
    targetRegions: ["Somali", "Harari"],
  },
  {
    title: "Market Infrastructure Upgrade",
    description: "Closed policy on upgrading market sheds and drainage.",
    pollType: "multipleChoice",
    targetRegions: ["Gambela", "Benishangul-Gumuz"],
  },
  {
    title: "Youth Training and Job Placement",
    description: "Closed policy on work readiness and job support.",
    pollType: "rating",
    targetRegions: ["Addis Ababa", "Oromia", "Amhara"],
  },
  {
    title: "Public Transport Reliability",
    description: "Closed policy on route reliability and service frequency.",
    pollType: "binary",
    targetRegions: ["Sidama", "SNNPR"],
  },
  {
    title: "Food Price Stabilization",
    description: "Closed policy on consumer affordability and supply stability.",
    pollType: "approval",
    targetRegions: ["Addis Ababa", "Harari", "Somali"],
  },
  {
    title: "Civic Participation and Feedback",
    description: "Closed policy on direct feedback channels and civic awareness.",
    pollType: "multipleChoice",
    targetRegions: ["Tigray", "Afar", "Gambela"],
  },
  {
    title: "Digital Service Access",
    description: "Closed policy on expanding access to online public services.",
    pollType: "likert",
    targetRegions: ["Benishangul-Gumuz", "Oromia", "Addis Ababa"],
  },
];

function randomItem(items) {
  return items[Math.floor(Math.random() * items.length)];
}

function randomInt(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function buildPolicyCode(index) {
  return `${POLICY_PREFIX}${String(index + 1).padStart(2, "0")}`;
}

function buildVoteValue(pollType, policy) {
  switch (pollType) {
    case "binary":
      return randomItem(["yes", "no"]);
    case "approval":
      return randomItem(["approve", "reject", "abstain"]);
    case "rating":
    case "likert":
      return randomInt(1, 5);
    case "multipleChoice": {
      const optionIds = (policy.pollOptions || []).map((option) => option.id);
      const selectedCount = Math.min(policy.maxSelections || 1, optionIds.length);
      return [...optionIds].sort(() => 0.5 - Math.random()).slice(0, selectedCount);
    }
    case "rankedChoice": {
      const optionIds = (policy.pollOptions || []).map((option) => option.id);
      const selectedCount = Math.min(policy.rankedChoiceMaxRank || 3, optionIds.length);
      return [...optionIds].sort(() => 0.5 - Math.random()).slice(0, selectedCount);
    }
    default:
      return 3;
  }
}

function buildPollOptions(title) {
  return [
    { id: "opt-a", text: `${title} option A` },
    { id: "opt-b", text: `${title} option B` },
    { id: "opt-c", text: `${title} option C` },
  ];
}

function buildSentimentFromVote(voteValue) {
  if (voteValue === "yes" || voteValue === "approve" || voteValue >= 4) {
    return { label: "positive", confidence: 0.91 };
  }

  if (voteValue === "no" || voteValue === "reject" || voteValue <= 2) {
    return { label: "negative", confidence: 0.89 };
  }

  return { label: "neutral", confidence: 0.74 };
}

function buildCommentText(sentiment, policyTitle) {
  if (sentiment === "positive") {
    return `I support ${policyTitle}. It addresses a real public need.`;
  }

  if (sentiment === "negative") {
    return `I have concerns about ${policyTitle}. The implementation needs more detail.`;
  }

  return `${policyTitle} has some good points, but more information would help.`;
}

function buildKeywords(policyTitle, sentiment) {
  const keywords = [
    policyTitle.split(" ")[0].toLowerCase(),
    sentiment,
    "policy",
  ];

  return [...new Set(keywords)].slice(0, 3);
}

async function ensurePlanner(passwordHash) {
  let planner = await User.findOne({ email: PLANER_EMAIL });
  if (!planner) {
    planner = await User.create({
      email: PLANER_EMAIL,
      passwordHash,
      phoneHash: `planner-${Date.now()}`,
      region: "Addis Ababa",
      role: "planner",
      verified: true,
      active: true,
      ageRange: "35-44",
      gender: "female",
      occupation: "government-employee",
      education: "postgraduate",
      languagesSpoken: ["en", "am"],
      preferredLanguage: "en",
      trainingCompletedAt: new Date(),
    });
  }

  return planner;
}

async function ensureCitizens(passwordHash) {
  const existing = await User.find({ role: "citizen" }).sort({ createdAt: 1 }).limit(24);
  if (existing.length >= 12) {
    return existing;
  }

  const citizens = [...existing];
  const missingCount = 24 - existing.length;
  for (let index = 0; index < missingCount; index += 1) {
    const region = REGIONS[index % REGIONS.length];
    const citizen = await User.create({
      email: `${CITIZEN_PREFIX}.${Date.now()}.${index}@test.com`,
      passwordHash,
      phoneHash: `${CITIZEN_PREFIX}.${Date.now()}.${index}`,
      region,
      role: "citizen",
      verified: true,
      active: true,
      ageRange: randomItem(["18-24", "25-34", "35-44", "45-54", "55+"]),
      gender: randomItem(["male", "female", "prefer-not-to-say"]),
      occupation: randomItem([
        "student",
        "farmer",
        "merchant",
        "government-employee",
        "private-sector",
        "unemployed",
        "other",
      ]),
      education: randomItem([
        "no-formal",
        "primary",
        "secondary",
        "diploma",
        "bachelors",
        "postgraduate",
      ]),
      languagesSpoken: ["en", randomItem(["am", "om", "ti"] )],
      preferredLanguage: "en",
    });
    citizens.push(citizen);
  }

  return citizens;
}

async function seedPublicAnalyticsPolicies() {
  await mongoose.connect(MONGO_URI);

  const passwordHash = await PASSWORD_HASH_PROMISE;
  const planner = await ensurePlanner(passwordHash);
  const citizens = await ensureCitizens(passwordHash);

  const existingPolicies = await Policy.find({ policyCode: new RegExp(`^${POLICY_PREFIX}`) }).select("_id");
  const existingPolicyIds = existingPolicies.map((policy) => policy._id);
  if (existingPolicyIds.length) {
    await Vote.deleteMany({ policyId: { $in: existingPolicyIds } });
    await Comment.deleteMany({ policyId: { $in: existingPolicyIds } });
    await Policy.deleteMany({ _id: { $in: existingPolicyIds } });
  }

  const createdPolicies = [];

  for (let index = 0; index < policyTemplates.length; index += 1) {
    const template = policyTemplates[index];
    const policy = await Policy.create({
      title: template.title,
      description: template.description,
      targetRegions: template.targetRegions,
      policyCode: buildPolicyCode(index),
      startDate: new Date(Date.now() - randomInt(55, 90) * 24 * 60 * 60 * 1000),
      endDate: new Date(Date.now() - randomInt(5, 20) * 24 * 60 * 60 * 1000),
      status: "closed",
      createdBy: planner._id,
      pollType: template.pollType,
      pollOptions:
        template.pollType === "multipleChoice" || template.pollType === "rankedChoice"
          ? buildPollOptions(template.title)
          : [],
      maxSelections: template.pollType === "multipleChoice" ? 2 : 1,
      rankedChoiceMaxRank: template.pollType === "rankedChoice" ? 3 : 3,
      likertLabels: ["Very Poor", "Poor", "Average", "Good", "Excellent"],
      relevanceFactors: {
        women: true,
        youth: true,
        farmers: index % 2 === 0,
        urban: true,
        rural: index % 2 === 1,
        privateSector: true,
        government: true,
      },
      citizenAnalyticsVisibility: { ...fullVisibility },
      topics: [template.title.split(" ")[0], "Public"] ,
    });

    const targetCitizens = citizens.filter((citizen) => template.targetRegions.includes(citizen.region));
    const eligibleCitizens = targetCitizens.length ? targetCitizens : citizens;
    const voteCount = Math.min(eligibleCitizens.length, 12);
    const selectedCitizens = [...eligibleCitizens].sort(() => 0.5 - Math.random()).slice(0, voteCount);

    for (const citizen of selectedCitizens) {
      const voteValue = buildVoteValue(template.pollType, policy);
      await Vote.create({
        policyId: policy._id,
        userId: citizen._id,
        phoneHash: citizen.phoneHash,
        channel: "app",
        value: voteValue,
        region: citizen.region,
        demographics: {
          ageRange: citizen.ageRange,
          gender: citizen.gender,
          occupation: citizen.occupation,
          education: citizen.education,
        },
      });

      const sentiment = buildSentimentFromVote(voteValue).label;
      await Comment.create({
        userId: citizen._id,
        policyId: policy._id,
        parentCommentId: null,
        region: citizen.region,
        text: buildCommentText(sentiment, template.title),
        language: "en",
        aiStatus: "processed",
        sentiment: buildSentimentFromVote(voteValue),
        keywords: buildKeywords(template.title, sentiment),
        visibility: "visible",
        reportState: "clean",
        reportCount: 0,
        replyCount: 0,
        reviewFlags: {
          sentimentReviewNeeded: false,
          moderationReviewNeeded: false,
        },
      });
    }

    createdPolicies.push({ id: policy._id.toString(), policyCode: policy.policyCode, votes: selectedCitizens.length });
  }

  console.log(`Seeded ${createdPolicies.length} closed public policies with analytics.`);
  createdPolicies.forEach((entry) => {
    console.log(`- ${entry.policyCode}: ${entry.votes} votes/comments`);
  });

  await mongoose.disconnect();
}

seedPublicAnalyticsPolicies().catch(async (error) => {
  console.error(error);
  try {
    await mongoose.disconnect();
  } catch {
    // ignore
  }
  process.exit(1);
});