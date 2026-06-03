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
const SmsActivity = require("../src/models/SmsActivity");
const PlannerRequest = require("../src/models/PlannerRequest");
const PolicyAssociate = require("../src/models/PolicyAssociate");

const { hashPhone, hashPassword } = require("../src/utils/helpers");

const MONGO_URI =
  process.env.MONGO_URI || "mongodb://localhost:27017/communityinsight";
const JWT_SECRET = process.env.JWT_SECRET;
const DEFAULT_PASSWORD = process.env.SEED_DEFAULT_PASSWORD || "Pass123!";
const RANDOM_SEED = process.env.SEED_RANDOM_SEED || "20260603";

if (!JWT_SECRET) {
  console.error("JWT_SECRET not defined in .env");
  process.exit(1);
}

const PLANNER_COUNT = Number(process.env.SEED_PLANNER_COUNT || 12);
const COMMENT_MODERATOR_COUNT = Number(
  process.env.SEED_COMMENT_MODERATOR_COUNT || 3,
);
const POLICIES_PER_PLANNER = Number(
  process.env.SEED_POLICIES_PER_PLANNER || 8,
);
const CITIZENS_PER_COMBINATION = Number(
  process.env.SEED_CITIZENS_PER_COMBINATION || 1,
);
const COMMENTS_PER_LANGUAGE_SENTIMENT = Number(
  process.env.SEED_COMMENTS_PER_LANGUAGE_SENTIMENT || 2,
);
const REPLIES_PER_POLICY = Number(process.env.SEED_REPLIES_PER_POLICY || 6);
const SMS_VOTE_RATIO = Number(process.env.SEED_SMS_VOTE_RATIO || 0.28);
const COMMENT_LANGUAGE = process.env.SEED_COMMENT_LANGUAGE || "en";
const PUBLIC_DASHBOARD_CLOSED_POLICY_COUNT = Number(
  process.env.SEED_PUBLIC_CLOSED_POLICY_COUNT || 10,
);

const nanoid = customAlphabet("ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789", 6);

const createRng = (seedText) => {
  let seed = 0;
  for (const char of String(seedText)) {
    seed = (seed * 31 + char.charCodeAt(0)) >>> 0;
  }
  return () => {
    seed = (1664525 * seed + 1013904223) >>> 0;
    return seed / 4294967296;
  };
};

const rng = createRng(RANDOM_SEED);
const random = () => rng();
const randomInt = (min, max) =>
  Math.floor(random() * (max - min + 1)) + min;
const pick = (items) => items[Math.floor(random() * items.length)];
const shuffle = (items) =>
  [...items]
    .map((item) => ({ item, order: random() }))
    .sort((left, right) => left.order - right.order)
    .map((entry) => entry.item);

const batchInsert = async (Model, docs, batchSize = 500) => {
  const inserted = [];
  for (let index = 0; index < docs.length; index += batchSize) {
    const batch = docs.slice(index, index + batchSize);
    const result = await Model.insertMany(batch, { ordered: true });
    inserted.push(...result);
  }
  return inserted;
};

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

const languages = ["en", "am", "om", "ti"];
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
const statusCycle = [
  "active",
  "closed",
  "paused",
  "archived",
  "scheduled",
  "draft",
  "active",
  "closed",
];

const topicLibrary = {
  Health: {
    title: "Primary Healthcare Access and Clinic Service Improvement",
    description:
      "upgrade frontline health centers, strengthen medicine supply, and improve referral links for mothers, children, and chronic patients",
    benefit:
      "families need shorter travel times, reliable medicine shelves, and faster treatment at nearby facilities",
    concern:
      "the implementation still needs stronger staffing targets and a clearer maintenance budget for health posts",
    neutral:
      "residents want to compare the rollout schedule, the staffing plan, and the medicine procurement safeguards before deciding",
    reply:
      "service standards, medicine tracking, and staffing milestones will be published for local oversight",
    keywords: ["clinics", "medicine", "nurses", "maternal care", "referral"],
  },
  Education: {
    title: "School Quality, Teacher Support, and Classroom Readiness",
    description:
      "reduce overcrowding, improve teacher deployment, expand school materials, and strengthen student support in public schools",
    benefit:
      "parents and students need better classroom conditions, more dependable teaching time, and better learning materials",
    concern:
      "the current draft needs clearer commitments on teacher retention, textbook delivery, and school maintenance",
    neutral:
      "citizens want better evidence on costs, teacher allocation, and how quickly under-served schools will benefit",
    reply:
      "teacher deployment, school maintenance, and textbook delivery benchmarks will be monitored by region",
    keywords: ["schools", "teachers", "students", "textbooks", "classrooms"],
  },
  "Water Supply": {
    title: "Safe Water Access, Distribution Reliability, and Sanitation Support",
    description:
      "expand piped connections, repair distribution points, improve borehole maintenance, and strengthen sanitation service coverage",
    benefit:
      "households need safer daily water access, fewer supply interruptions, and less time spent fetching water",
    concern:
      "the plan needs clearer maintenance funding and better safeguards for rural water point reliability",
    neutral:
      "residents want to know which neighborhoods will be served first and how breakdown response times will improve",
    reply:
      "maintenance contracts, repair timelines, and service maps will be shared with communities",
    keywords: ["water", "pipes", "boreholes", "sanitation", "maintenance"],
  },
  Electricity: {
    title: "Electricity Reliability, Last-Mile Access, and Service Quality",
    description:
      "reduce outages, expand connections, improve transformer maintenance, and strengthen customer response for households and small firms",
    benefit:
      "families and businesses need more reliable power for lighting, refrigeration, and productive work",
    concern:
      "citizens are worried about outage response time, maintenance discipline, and whether low-income areas will be prioritized",
    neutral:
      "people want more detail on connection costs, outage reduction targets, and substation upgrades",
    reply:
      "network maintenance, outage reporting, and phased connection targets are part of the implementation package",
    keywords: ["power", "grid", "outages", "transformers", "connections"],
  },
  Housing: {
    title: "Affordable Housing Delivery and Urban Shelter Upgrading",
    description:
      "expand serviced land, improve rental oversight, and support affordable housing construction with better infrastructure links",
    benefit:
      "urban households need more affordable rental options and safer neighborhoods with basic services",
    concern:
      "citizens want stronger safeguards against unequal allocation, weak maintenance, and rising construction costs",
    neutral:
      "people are comparing whether serviced land, rental reform, or phased construction should be prioritized first",
    reply:
      "allocation rules, construction milestones, and service-readiness checks will be publicly tracked",
    keywords: ["housing", "rent", "construction", "serviced land", "shelter"],
  },
  Transport: {
    title: "Public Transport Service Reliability and Urban Mobility Improvement",
    description:
      "improve route planning, bus frequency, terminal management, and feeder connections for daily commuters",
    benefit:
      "workers and students need safer, faster, and more predictable public transport options",
    concern:
      "the proposal needs stronger traffic management coordination and more clarity on operator accountability",
    neutral:
      "residents want to compare terminal upgrades, bus frequency targets, and affordability measures",
    reply:
      "route performance, service frequency, and passenger safety indicators will be tracked in each corridor",
    keywords: ["buses", "routes", "terminals", "commute", "mobility"],
  },
  Roads: {
    title: "Road Maintenance, Local Access, and Bridge Connectivity",
    description:
      "repair damaged local roads, improve drainage, and strengthen feeder road links between communities and service centers",
    benefit:
      "communities need safer roads for market access, school trips, and emergency movement during rain seasons",
    concern:
      "citizens want more confidence that drainage, maintenance quality, and contractor supervision will be enforced",
    neutral:
      "people are weighing whether feeder roads, drainage works, or bridge repairs should happen first",
    reply:
      "maintenance schedules, contractor milestones, and road-condition reporting will be shared locally",
    keywords: ["roads", "bridges", "drainage", "access", "repairs"],
  },
  "Digital Infrastructure": {
    title: "Digital Connectivity, Broadband Expansion, and Public Access",
    description:
      "extend broadband access, improve public internet points, and strengthen digital service reliability for education and business",
    benefit:
      "students, businesses, and public offices need better connectivity for services, learning, and online transactions",
    concern:
      "citizens want stronger commitments on affordability, uptime, and service in under-connected districts",
    neutral:
      "residents want to compare school connectivity, public wi-fi, and business broadband priorities",
    reply:
      "coverage maps, connectivity targets, and service-quality reporting will be updated regularly",
    keywords: ["internet", "broadband", "digital services", "coverage", "connectivity"],
  },
  Agriculture: {
    title: "Agricultural Productivity, Irrigation, and Farmer Support Services",
    description:
      "expand irrigation, improve extension support, and strengthen access to inputs, storage, and market information",
    benefit:
      "farm households need better water access, lower post-harvest loss, and more dependable extension services",
    concern:
      "citizens are asking for clearer delivery plans on irrigation maintenance, seed quality, and local coordination",
    neutral:
      "people want to compare irrigation, extension support, and storage investment before backing one sequence",
    reply:
      "extension coverage, irrigation upkeep, and post-harvest support targets will be monitored by woreda",
    keywords: ["farmers", "irrigation", "extension", "inputs", "storage"],
  },
  Environment: {
    title: "Waste Management, Green Space, and Local Environmental Protection",
    description:
      "improve urban waste collection, community cleanup systems, and neighborhood environmental protection measures",
    benefit:
      "cleaner streets, drainage channels, and public spaces would improve health and day-to-day livability",
    concern:
      "citizens want stronger enforcement, better service consistency, and clearer accountability for waste contracts",
    neutral:
      "people are comparing cleanup operations, recycling pilots, and green-space maintenance priorities",
    reply:
      "collection performance, drainage cleanup, and neighborhood monitoring will be part of the rollout",
    keywords: ["waste", "cleanup", "green space", "drainage", "recycling"],
  },
  "Climate Change": {
    title: "Climate Resilience, Flood Response, and Drought Preparedness",
    description:
      "strengthen flood-control works, drought preparedness, and local resilience planning for climate-sensitive communities",
    benefit:
      "communities need better early action, safer infrastructure, and stronger support during weather shocks",
    concern:
      "citizens are looking for clearer financing and stronger coordination between local response agencies",
    neutral:
      "people want to compare drought measures, flood protection, and household resilience support before choosing priorities",
    reply:
      "risk mapping, preparedness plans, and local response triggers will be published and reviewed seasonally",
    keywords: ["resilience", "floods", "drought", "preparedness", "adaptation"],
  },
  Economy: {
    title: "Local Economic Recovery, Market Stability, and Household Opportunity",
    description:
      "support market activity, reduce local business bottlenecks, and improve links between public services and economic growth",
    benefit:
      "households need more stable prices, better local opportunities, and stronger business confidence",
    concern:
      "citizens want clearer evidence that the package will reach small firms and not just larger actors",
    neutral:
      "people are weighing whether price stability, business services, or jobs support should lead the package",
    reply:
      "market indicators, small-business access, and local delivery milestones will be reported regularly",
    keywords: ["markets", "growth", "prices", "business", "jobs"],
  },
  Employment: {
    title: "Youth Employment, Skills Pathways, and Job Matching Support",
    description:
      "expand practical training, placement services, and employer links for job seekers across urban and rural areas",
    benefit:
      "young people and job seekers need stronger pathways from training into real paid work",
    concern:
      "citizens want clearer employer participation targets and more transparency on placement outcomes",
    neutral:
      "people want to compare training quality, wage support, and employer incentives before deciding",
    reply:
      "placement results, employer participation, and follow-up support will be measured each quarter",
    keywords: ["jobs", "skills", "placement", "training", "employers"],
  },
  "Small Business": {
    title: "Small Business Growth, Credit Access, and Market Support",
    description:
      "improve micro and small enterprise support through market access, business training, and better financing pathways",
    benefit:
      "small operators need practical support to expand, hire, and manage working capital pressures",
    concern:
      "citizens want stronger guarantees that women, youth, and informal operators can access the support fairly",
    neutral:
      "people are comparing credit access, market facilities, and business advisory services as the first priority",
    reply:
      "credit readiness, business support uptake, and fair access indicators will be tracked publicly",
    keywords: ["small business", "credit", "markets", "entrepreneurs", "training"],
  },
  Industry: {
    title: "Industrial Service Readiness and Productive Investment Support",
    description:
      "improve industrial site readiness, utility coordination, and supplier development for productive local investment",
    benefit:
      "better service coordination can support jobs, production, and supplier opportunities for nearby communities",
    concern:
      "citizens want stronger safeguards so industrial growth does not outpace housing, transport, or environmental controls",
    neutral:
      "people want to compare utility readiness, local jobs commitments, and supplier support measures",
    reply:
      "site readiness, local employment reporting, and environmental safeguards are built into the rollout",
    keywords: ["industry", "manufacturing", "suppliers", "utilities", "investment"],
  },
  Trade: {
    title: "Trade Logistics, Market Access, and Price Movement Efficiency",
    description:
      "improve market logistics, storage links, and administrative efficiency to reduce trade bottlenecks and local price pressure",
    benefit:
      "faster and more predictable trade movement can help stabilize supply and lower avoidable transaction costs",
    concern:
      "citizens want stronger oversight on fees, local market fairness, and whether remote areas will benefit",
    neutral:
      "people are comparing logistics reforms, storage expansion, and market administration changes",
    reply:
      "market access indicators, logistics bottlenecks, and price-monitoring outputs will be reviewed often",
    keywords: ["trade", "logistics", "markets", "storage", "prices"],
  },
  Tourism: {
    title: "Tourism Services, Heritage Access, and Visitor Economy Development",
    description:
      "strengthen tourism facilities, local access, and service quality around cultural and natural destinations",
    benefit:
      "better tourism services can create jobs, support local businesses, and improve destination management",
    concern:
      "citizens want clearer local benefit-sharing and stronger maintenance of heritage and public spaces",
    neutral:
      "people are comparing access roads, hospitality training, and destination maintenance as first priorities",
    reply:
      "local jobs, destination maintenance, and service-quality standards will be tracked in the rollout",
    keywords: ["tourism", "heritage", "visitors", "hospitality", "destinations"],
  },
  "Social Protection": {
    title: "Targeted Social Protection and Household Support Delivery",
    description:
      "improve safety-net targeting, payment reliability, and coordination for vulnerable households facing hardship",
    benefit:
      "families need timely support, fewer payment delays, and better local coordination when shocks occur",
    concern:
      "citizens are asking for stronger fairness checks and better complaint resolution for excluded households",
    neutral:
      "people want to compare targeting quality, payment reliability, and grievance support improvements",
    reply:
      "targeting reviews, payment performance, and grievance-response data will be published regularly",
    keywords: ["safety net", "payments", "targeting", "households", "support"],
  },
  "Food Security": {
    title: "Food Supply Stability, Nutrition Access, and Local Resilience",
    description:
      "stabilize local food supply chains, support nutrition access, and reduce community vulnerability during price shocks",
    benefit:
      "families need more stable access to food, especially when transport or weather disrupts local supply",
    concern:
      "citizens want stronger plans for storage, distribution fairness, and support for vulnerable households",
    neutral:
      "people are weighing storage support, market stabilization, and nutrition programs before choosing priorities",
    reply:
      "supply stability, local storage readiness, and nutrition indicators will be monitored through the rollout",
    keywords: ["food", "nutrition", "supply", "prices", "storage"],
  },
  "Poverty Reduction": {
    title: "Household Poverty Reduction and Livelihood Opportunity Support",
    description:
      "coordinate local livelihood support, income pathways, and service access improvements for low-income households",
    benefit:
      "households need connected support that improves income, skills, and service access at the same time",
    concern:
      "citizens want clearer targeting, stronger follow-up, and better measurement of lasting livelihood outcomes",
    neutral:
      "people are comparing livelihood grants, skills support, and service access investments",
    reply:
      "targeting quality, livelihood outcomes, and follow-up support will be reviewed with local administrators",
    keywords: ["poverty", "livelihoods", "income", "skills", "support"],
  },
  Governance: {
    title: "Local Service Accountability and Transparent Public Communication",
    description:
      "improve public communication, local accountability, and feedback tracking for everyday government service delivery",
    benefit:
      "citizens need more transparent updates, faster response to complaints, and clearer ownership of service problems",
    concern:
      "people want stronger follow-through, not just announcements, and clearer timelines for issue resolution",
    neutral:
      "residents are comparing grievance response, service dashboards, and public reporting frequency",
    reply:
      "service standards, complaint resolution timelines, and public reporting commitments are part of the design",
    keywords: ["accountability", "transparency", "feedback", "grievances", "service delivery"],
  },
  Justice: {
    title: "Justice Access, Case Handling, and Legal Service Reach",
    description:
      "improve local legal support, case flow efficiency, and citizen access to fair and timely justice services",
    benefit:
      "people need clearer legal pathways, faster handling, and more equitable access to basic justice services",
    concern:
      "citizens want stronger guarantees on fairness, rural access, and protection against unnecessary delays",
    neutral:
      "residents are comparing legal aid expansion, local access points, and case-management reforms",
    reply:
      "case-flow targets, local access points, and legal-aid coverage will be reviewed in implementation reports",
    keywords: ["justice", "courts", "legal aid", "fairness", "case handling"],
  },
  "Public Safety": {
    title: "Community Safety Coordination and Local Incident Response",
    description:
      "improve local safety coordination, street lighting support, and response arrangements for high-risk areas",
    benefit:
      "families need safer streets, quicker incident response, and better prevention in public spaces",
    concern:
      "citizens want stronger accountability, better lighting maintenance, and more practical prevention work",
    neutral:
      "people are comparing incident response, lighting upgrades, and prevention outreach as the first priority",
    reply:
      "incident trends, lighting coverage, and local prevention actions will be reported at district level",
    keywords: ["safety", "response", "lighting", "prevention", "community policing"],
  },
  "Urban Planning": {
    title: "Urban Planning Coordination, Land Use, and Service Readiness",
    description:
      "align land use, service planning, and neighborhood growth management to reduce unmanaged urban expansion",
    benefit:
      "residents need neighborhoods that grow with roads, drainage, transport, and public services already planned",
    concern:
      "citizens want stronger enforcement against unmanaged growth and clearer service-readiness checks",
    neutral:
      "people are comparing zoning updates, service-readiness rules, and neighborhood planning priorities",
    reply:
      "land-use guidance, service-readiness checks, and neighborhood growth monitoring are core parts of the plan",
    keywords: ["zoning", "land use", "urban growth", "services", "planning"],
  },
  "Rural Development": {
    title: "Rural Service Access, Connectivity, and Community Livelihood Support",
    description:
      "improve road links, service access, and local economic support for rural communities with limited public infrastructure",
    benefit:
      "rural households need more reliable access to markets, schools, health posts, and water services",
    concern:
      "citizens want clearer sequencing so the most isolated areas are not left behind again",
    neutral:
      "people are comparing feeder roads, service access, and livelihood support priorities",
    reply:
      "rural access indicators, service coverage, and implementation milestones will be tracked by zone",
    keywords: ["rural access", "roads", "services", "markets", "livelihoods"],
  },
  Youth: {
    title: "Youth Opportunity, Skills Development, and Civic Participation",
    description:
      "expand youth training, participation spaces, and transition pathways into work, service, and leadership",
    benefit:
      "young people need practical opportunities, not just short-term programs, to build skills and income",
    concern:
      "citizens want clearer follow-up after training and better links between participation and actual opportunities",
    neutral:
      "people are comparing training, mentorship, and startup support measures for youth engagement",
    reply:
      "training completion, job linkage, and youth participation outcomes will be monitored closely",
    keywords: ["youth", "training", "mentorship", "jobs", "participation"],
  },
  "Women Affairs": {
    title: "Women’s Economic Inclusion, Safety, and Service Access",
    description:
      "improve women’s access to livelihood support, public services, and protective community response systems",
    benefit:
      "women need safer access to services, stronger income pathways, and more reliable institutional support",
    concern:
      "citizens want to see stronger implementation safeguards and clearer access for women outside major towns",
    neutral:
      "people are comparing livelihood support, safety services, and service-access reforms for women",
    reply:
      "service reach, women’s participation, and protection-response indicators will be reviewed publicly",
    keywords: ["women", "inclusion", "safety", "services", "livelihoods"],
  },
};

const humanize = (value) =>
  String(value || "")
    .replace(/-/g, " ")
    .replace(/\b\w/g, (letter) => letter.toUpperCase());

const regionCode = (region) =>
  region.replace(/[^A-Za-z0-9]/g, "").slice(0, 4).toUpperCase();

const buildUserDisplayName = (role, index, region) =>
  `${role === "admin" ? "Admin" : role === "planner" ? "Planner" : role === "comment_moderator" ? "Moderator" : "Citizen"}_${regionCode(region)}_${String(index + 1).padStart(3, "0")}`;

const buildLanguageSet = (preferredLanguage, regionIndex, comboIndex) => {
  const second = languages[(regionIndex + comboIndex + 1) % languages.length];
  const third = languages[(regionIndex + comboIndex + 2) % languages.length];
  return Array.from(new Set([preferredLanguage, "en", second, third])).slice(
    0,
    3,
  );
};

const topicKeys = Object.keys(topicLibrary);

const buildTargetRegions = (plannerRegion, globalIndex) => {
  if (globalIndex % 6 === 0) return [...regions];

  const plannerRegionIndex = regions.indexOf(plannerRegion);
  const span = 1 + (globalIndex % 3);
  const targetRegions = [];
  for (let offset = 0; offset < span; offset += 1) {
    targetRegions.push(
      regions[(plannerRegionIndex + offset + (globalIndex % 2)) % regions.length],
    );
  }
  return Array.from(new Set(targetRegions));
};

const buildPolicyTiming = (status, index) => {
  const today = new Date();
  const createdAt = new Date(
    today.getTime() - (170 + (index % 90)) * 24 * 60 * 60 * 1000,
  );

  if (status === "draft") {
    const startDate = new Date(
      today.getTime() + (21 + (index % 18)) * 24 * 60 * 60 * 1000,
    );
    const endDate = new Date(
      startDate.getTime() + (55 + (index % 40)) * 24 * 60 * 60 * 1000,
    );
    return { createdAt, startDate, endDate };
  }

  if (status === "scheduled") {
    const startDate = new Date(
      today.getTime() + (8 + (index % 12)) * 24 * 60 * 60 * 1000,
    );
    const endDate = new Date(
      startDate.getTime() + (45 + (index % 35)) * 24 * 60 * 60 * 1000,
    );
    return { createdAt, startDate, endDate };
  }

  if (status === "active") {
    const startDate = new Date(
      today.getTime() - (35 + (index % 30)) * 24 * 60 * 60 * 1000,
    );
    const endDate = new Date(
      today.getTime() + (25 + (index % 35)) * 24 * 60 * 60 * 1000,
    );
    return { createdAt, startDate, endDate };
  }

  if (status === "paused") {
    const startDate = new Date(
      today.getTime() - (70 + (index % 35)) * 24 * 60 * 60 * 1000,
    );
    const endDate = new Date(
      today.getTime() + (12 + (index % 20)) * 24 * 60 * 60 * 1000,
    );
    return { createdAt, startDate, endDate };
  }

  if (status === "closed") {
    const startDate = new Date(
      today.getTime() - (145 + (index % 45)) * 24 * 60 * 60 * 1000,
    );
    const endDate = new Date(
      today.getTime() - (24 + (index % 18)) * 24 * 60 * 60 * 1000,
    );
    return { createdAt, startDate, endDate };
  }

  const startDate = new Date(
    today.getTime() - (220 + (index % 60)) * 24 * 60 * 60 * 1000,
  );
  const endDate = new Date(
    today.getTime() - (75 + (index % 30)) * 24 * 60 * 60 * 1000,
  );
  return { createdAt, startDate, endDate };
};

const buildPolicyCode = (topicKey, index) =>
  `${regionCode(topicKey)}-${String(index + 1).padStart(3, "0")}-${nanoid()}`;

const buildPolicyTitle = (topic, targetRegions, pollType) => {
  const scope =
    targetRegions.length === regions.length
      ? "National"
      : targetRegions.length === 1
        ? targetRegions[0]
        : `${targetRegions[0]} and surrounding areas`;
  return `${scope}: ${topic.title}`;
};

const buildPolicyDescription = (topic, targetRegions) => {
  const scope =
    targetRegions.length === regions.length
      ? "across Ethiopia"
      : `in ${targetRegions.join(", ")}`;
  return `This proposal aims to ${topic.description} ${scope}. It focuses on practical delivery, measurable service improvements, and accountable implementation so residents can judge whether the rollout matches local needs. The policy also asks communities to weigh funding discipline, implementation sequencing, and the safeguards needed to make the reform sustainable.`;
};

const buildPollOptions = (pollType, topic) => {
  if (pollType === "binary") {
    return [
      {
        id: "yes",
        text: `Yes, support the ${topic.title.toLowerCase()} plan`,
        shortCode: "Y",
      },
      {
        id: "no",
        text: `No, do not support the ${topic.title.toLowerCase()} plan`,
        shortCode: "N",
      },
    ];
  }

  if (pollType === "approval") {
    return [
      {
        id: "approve",
        text: `Approve the ${topic.title.toLowerCase()} rollout`,
        shortCode: "A",
      },
      {
        id: "reject",
        text: `Reject the current ${topic.title.toLowerCase()} proposal`,
        shortCode: "R",
      },
      { id: "abstain", text: "Abstain pending further clarification", shortCode: "S" },
    ];
  }

  if (pollType === "multipleChoice") {
    return [
      { id: "coverage", text: "Prioritize wider geographic coverage", shortCode: "1" },
      { id: "quality", text: "Prioritize service quality and standards", shortCode: "2" },
      { id: "speed", text: "Prioritize faster phased delivery", shortCode: "3" },
      { id: "cost", text: "Prioritize budget discipline and maintenance", shortCode: "4" },
    ];
  }

  if (pollType === "rankedChoice") {
    return [
      { id: "service_access", text: "Expand direct service access first", shortCode: "1" },
      { id: "infrastructure", text: "Upgrade supporting infrastructure first", shortCode: "2" },
      { id: "workforce", text: "Invest in frontline staffing and training first", shortCode: "3" },
      { id: "oversight", text: "Strengthen oversight and accountability first", shortCode: "4" },
    ];
  }

  return [];
};

const buildLikertLabels = () => [
  "Strongly oppose",
  "Oppose",
  "Neutral",
  "Support",
  "Strongly support",
];

const buildPolicyNarrative = (topicKey, targetRegions, pollType) => {
  const topic = topicLibrary[topicKey];
  return {
    title: buildPolicyTitle(topic, targetRegions, pollType),
    description: buildPolicyDescription(topic, targetRegions),
  };
};

const createUsers = async () => {
  const passwordHash = await hashPassword(DEFAULT_PASSWORD);

  const admin = {
    email: "admin@demo.abrowork.com",
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
    trainingCompletedAt: new Date(),
    tokenVersion: 0,
    displayName: "Admin_AA_001",
  };

  const moderators = Array.from(
    { length: COMMENT_MODERATOR_COUNT },
    (_, index) => {
      const region = regions[(index + 2) % regions.length];
      const preferredLanguage = languages[(index + 1) % languages.length];
      return {
        email: `moderator${index + 1}@demo.abrowork.com`,
        passwordHash,
        phoneHash: hashPhone(`+25191290${String(1000 + index).slice(-4)}`),
        region,
        role: "comment_moderator",
        verified: true,
        active: true,
        ageRange: ageRanges[(index + 2) % ageRanges.length],
        gender: genders[index % genders.length],
        occupation: "government-employee",
        education: "postgraduate",
        preferredLanguage,
        languagesSpoken: buildLanguageSet(preferredLanguage, index, index),
        trainingCompletedAt: new Date(),
        tokenVersion: 0,
        displayName: buildUserDisplayName("comment_moderator", index, region),
      };
    },
  );

  const planners = Array.from({ length: PLANNER_COUNT }, (_, index) => {
    const region = regions[index % regions.length];
    const preferredLanguage = languages[index % languages.length];
    return {
      email: `planner${index + 1}@demo.abrowork.com`,
      passwordHash,
      phoneHash: hashPhone(`+25191300${String(1000 + index).slice(-4)}`),
      region,
      role: "planner",
      verified: true,
      active: true,
      ageRange: ageRanges[(index + 1) % ageRanges.length],
      gender: genders[index % genders.length],
      occupation: index % 2 === 0 ? "government-employee" : "private-sector",
      education: index % 2 === 0 ? "postgraduate" : "bachelors",
      preferredLanguage,
      languagesSpoken: buildLanguageSet(preferredLanguage, index, index + 3),
      trainingCompletedAt: new Date(),
      tokenVersion: 0,
      displayName: buildUserDisplayName("planner", index, region),
    };
  });

  const citizens = [];
  let citizenIndex = 0;

  for (let regionIndex = 0; regionIndex < regions.length; regionIndex += 1) {
    const region = regions[regionIndex];
    let combinationIndex = 0;
    for (const ageRange of ageRanges) {
      for (const gender of genders) {
        for (const occupation of occupations) {
          for (const education of educations) {
            for (let repeat = 0; repeat < CITIZENS_PER_COMBINATION; repeat += 1) {
              const preferredLanguage =
                languages[
                  (combinationIndex + repeat + regionIndex) % languages.length
                ];
              citizens.push({
                email: `citizen.${regionCode(region).toLowerCase()}.${String(
                  citizenIndex + 1,
                ).padStart(4, "0")}@demo.abrowork.com`,
                passwordHash,
                phoneHash: hashPhone(
                  `+251914${String(100000 + citizenIndex).slice(-6)}`,
                ),
                region,
                role: "citizen",
                verified: true,
                active: true,
                ageRange,
                gender,
                occupation,
                education,
                preferredLanguage,
                languagesSpoken: buildLanguageSet(
                  preferredLanguage,
                  regionIndex,
                  combinationIndex,
                ),
                tokenVersion: 0,
                displayName: buildUserDisplayName("citizen", citizenIndex, region),
              });
              citizenIndex += 1;
            }
            combinationIndex += 1;
          }
        }
      }
    }
  }

  const [adminUser] = await User.insertMany([admin], { ordered: true });
  const insertedModerators = await batchInsert(User, moderators, 250);
  const insertedPlanners = await batchInsert(User, planners, 250);
  const insertedCitizens = await batchInsert(User, citizens, 500);

  return {
    adminUser,
    moderators: insertedModerators,
    planners: insertedPlanners,
    citizens: insertedCitizens,
  };
};

const createPolicies = async ({ planners }) => {
  const policyDocs = [];
  const profiles = [];
  let publicClosedPolicyCount = 0;

  for (let plannerIndex = 0; plannerIndex < planners.length; plannerIndex += 1) {
    const planner = planners[plannerIndex];

    for (let slot = 0; slot < POLICIES_PER_PLANNER; slot += 1) {
      const globalIndex = plannerIndex * POLICIES_PER_PLANNER + slot;
      const topicKey = topicKeys[globalIndex % topicKeys.length];
      const secondaryTopic = topicKeys[(globalIndex + 7) % topicKeys.length];
      const pollType = pollTypes[globalIndex % pollTypes.length];
      const status = statusCycle[globalIndex % statusCycle.length];
      const targetRegions = buildTargetRegions(planner.region, globalIndex);
      const topic = topicLibrary[topicKey];
      const narrative = buildPolicyNarrative(topicKey, targetRegions, pollType);
      const timing = buildPolicyTiming(status, globalIndex);
      const supportProfile = ["supportive", "mixed", "skeptical", "balanced"][
        globalIndex % 4
      ];

      policyDocs.push({
        title: narrative.title,
        description: narrative.description,
        targetRegions,
        policyCode: buildPolicyCode(topicKey, globalIndex),
        startDate: timing.startDate,
        endDate: timing.endDate,
        status,
        createdBy: planner._id,
        createdAt: timing.createdAt,
        pollType,
        pollOptions: buildPollOptions(pollType, topic),
        maxSelections: pollType === "multipleChoice" ? 2 : 1,
        likertLabels:
          pollType === "likert" ? buildLikertLabels() : buildLikertLabels(),
        rankedChoiceMaxRank: pollType === "rankedChoice" ? 3 : 3,
        relevanceFactors: {
          women: ["Women Affairs", "Health", "Social Protection"].includes(
            topicKey,
          ),
          youth: ["Youth", "Education", "Employment"].includes(topicKey),
          farmers: [
            "Agriculture",
            "Food Security",
            "Rural Development",
          ].includes(topicKey),
          urban: targetRegions.includes("Addis Ababa") || targetRegions.length > 2,
          rural: targetRegions.length <= 2,
          privateSector: ["Economy", "Trade", "Small Business", "Industry"].includes(
            topicKey,
          ),
          government: true,
        },
        citizenAnalyticsVisibility:
          status === "closed"
            ? {
                showResults: true,
                showBreakdown: true,
                showComments: true,
                showSentiment: true,
                allowTimeFilter: true,
              }
            : {
                showResults: true,
                showBreakdown: globalIndex % 2 === 0,
                showComments: globalIndex % 3 !== 1,
                showSentiment: globalIndex % 4 !== 2,
                allowTimeFilter: globalIndex % 5 !== 0,
              },
        topics: [topicKey, secondaryTopic],
      });

      if (status === "closed" && publicClosedPolicyCount < PUBLIC_DASHBOARD_CLOSED_POLICY_COUNT) {
        publicClosedPolicyCount += 1;
      }

      profiles.push({
        planner,
        topicKey,
        supportProfile,
      });
    }
  }

  const policies = await Policy.insertMany(policyDocs, { ordered: true });
  const policyProfileMap = new Map();

  policies.forEach((policy, index) => {
    policyProfileMap.set(policy._id.toString(), profiles[index]);
  });

  return { policies, policyProfileMap };
};

const createCitizenIndexes = (citizens) => {
  const byRegion = new Map();
  for (const region of regions) byRegion.set(region, []);

  citizens.forEach((citizen) => {
    if (!byRegion.has(citizen.region)) {
      byRegion.set(citizen.region, []);
    }
    byRegion.get(citizen.region).push(citizen);
  });

  return { byRegion };
};

const getEligibleCitizens = (citizenIndex, targetRegions) => {
  const eligible = [];
  for (const region of targetRegions) {
    eligible.push(...(citizenIndex.byRegion.get(region) || []));
  }
  return eligible.length ? eligible : [...citizenIndex.byRegion.values()][0] || [];
};

const rotate = (items, offset) => {
  if (!items.length) return [];
  const normalized = offset % items.length;
  return items.slice(normalized).concat(items.slice(0, normalized));
};

const findDistinctUser = (pool, usedIds, predicate, offset = 0) => {
  const ordered = rotate(pool, offset);
  const candidate = ordered.find(
    (user) =>
      !usedIds.has(user._id.toString()) && (!predicate || predicate(user)),
  );
  if (candidate) {
    usedIds.add(candidate._id.toString());
  }
  return candidate || null;
};

const buildVoteCoverageSet = (eligibleCitizens, policyIndex) => {
  const usedIds = new Set();
  const selected = [];

  const pushIfFound = (predicate, offsetBase) => {
    const candidate = findDistinctUser(
      eligibleCitizens,
      usedIds,
      predicate,
      policyIndex + offsetBase,
    );
    if (candidate) selected.push(candidate);
  };

  ageRanges.forEach((ageRange, index) =>
    pushIfFound((user) => user.ageRange === ageRange, index * 3),
  );
  genders.forEach((gender, index) =>
    pushIfFound((user) => user.gender === gender, 30 + index * 3),
  );
  occupations.forEach((occupation, index) =>
    pushIfFound((user) => user.occupation === occupation, 60 + index * 5),
  );
  educations.forEach((education, index) =>
    pushIfFound((user) => user.education === education, 120 + index * 7),
  );

  return { selected, usedIds };
};

const voteTargetsByStatus = {
  draft: 24,
  scheduled: 30,
  active: 84,
  paused: 52,
  closed: 72,
  archived: 42,
};

const buildVoteCreatedAt = (policy, status, offset) => {
  const now = new Date();
  let start = policy.createdAt;
  let end = now;

  if (status === "active" || status === "paused") {
    start = policy.startDate;
    end = policy.endDate > now ? now : policy.endDate;
  } else if (status === "closed" || status === "archived") {
    start = policy.startDate;
    end = policy.endDate;
  } else if (status === "scheduled" || status === "draft") {
    end =
      policy.startDate > now
        ? new Date(policy.startDate.getTime() - 24 * 60 * 60 * 1000)
        : now;
  }

  if (end <= start) {
    end = new Date(start.getTime() + 3 * 24 * 60 * 60 * 1000);
  }

  const diff = end.getTime() - start.getTime();
  const ratio = ((offset % 19) + 1) / 20;
  return new Date(start.getTime() + Math.floor(diff * ratio));
};

const buildVoteValue = (policy, supportProfile, voterIndex) => {
  const tone = supportProfile;

  if (policy.pollType === "binary") {
    if (tone === "supportive") return voterIndex % 5 === 0 ? "no" : "yes";
    if (tone === "skeptical") return voterIndex % 4 === 0 ? "yes" : "no";
    if (tone === "mixed") return voterIndex % 2 === 0 ? "yes" : "no";
    return voterIndex % 3 === 0 ? "no" : "yes";
  }

  if (policy.pollType === "approval") {
    if (tone === "supportive") {
      return voterIndex % 6 === 0
        ? "abstain"
        : voterIndex % 5 === 0
          ? "reject"
          : "approve";
    }
    if (tone === "skeptical") {
      return voterIndex % 5 === 0 ? "abstain" : voterIndex % 2 === 0 ? "reject" : "approve";
    }
    if (tone === "mixed") {
      return ["approve", "reject", "abstain"][voterIndex % 3];
    }
    return voterIndex % 4 === 0 ? "abstain" : voterIndex % 3 === 0 ? "reject" : "approve";
  }

  if (policy.pollType === "multipleChoice") {
    const optionIds = (policy.pollOptions || []).map((option) => option.id);
    const rotated = rotate(optionIds, voterIndex % optionIds.length);
    const count = 1 + (voterIndex % Math.min(policy.maxSelections || 1, optionIds.length));
    return rotated.slice(0, count);
  }

  if (policy.pollType === "rankedChoice") {
    const optionIds = (policy.pollOptions || []).map((option) => option.id);
    return rotate(optionIds, voterIndex % optionIds.length).slice(
      0,
      Math.min(policy.rankedChoiceMaxRank || 3, optionIds.length),
    );
  }

  const ratingPools = {
    supportive: [5, 4, 4, 5, 3],
    mixed: [4, 3, 2, 5, 3],
    skeptical: [2, 1, 3, 2, 1],
    balanced: [4, 3, 3, 2, 5],
  };
  return ratingPools[tone][voterIndex % ratingPools[tone].length];
};

const createVotes = async ({ citizens, policies, policyProfileMap }) => {
  const citizenIndex = createCitizenIndexes(citizens);
  const voteDocs = [];
  const smsVoteRecords = [];

  policies.forEach((policy, policyIndex) => {
    const { supportProfile } = policyProfileMap.get(policy._id.toString());
    const eligibleCitizens = getEligibleCitizens(
      citizenIndex,
      policy.targetRegions || regions,
    );
    const { selected, usedIds } = buildVoteCoverageSet(
      eligibleCitizens,
      policyIndex,
    );
    const desiredVoteCount = Math.max(
      selected.length,
      voteTargetsByStatus[policy.status] || 30,
    );

    const orderedEligible = rotate(eligibleCitizens, policyIndex * 11);
    for (const citizen of orderedEligible) {
      if (selected.length >= desiredVoteCount) break;
      if (usedIds.has(citizen._id.toString())) continue;
      usedIds.add(citizen._id.toString());
      selected.push(citizen);
    }

    selected.forEach((citizen, voterIndex) => {
      const useSms = (policyIndex + voterIndex) % 10 < Math.round(SMS_VOTE_RATIO * 10);
      const value = buildVoteValue(policy, supportProfile, voterIndex);
      const createdAt = buildVoteCreatedAt(policy, policy.status, voterIndex + 1);

      voteDocs.push({
        policyId: policy._id,
        userId: useSms ? null : citizen._id,
        phoneHash: useSms ? citizen.phoneHash : null,
        channel: useSms ? "sms" : "app",
        value,
        region: citizen.region,
        demographics: {
          ageRange: citizen.ageRange,
          gender: citizen.gender,
          occupation: citizen.occupation,
          education: citizen.education,
        },
        createdAt,
      });

      if (useSms) {
        smsVoteRecords.push({
          citizen,
          policyId: policy._id,
          createdAt,
          command: policy.pollType === "binary" ? "VOTE" : "POLL",
          value,
        });
      }
    });
  });

  await batchInsert(Vote, voteDocs, 1000);
  return smsVoteRecords;
};

const getKeywordSlice = (topicKey, start, count = 3) => {
  const keywords = topicLibrary[topicKey].keywords;
  const rotated = rotate(keywords, start % keywords.length);
  return rotated.slice(0, count);
};

const buildDemographicsSnapshot = (user) => ({
  ageRange: user.ageRange,
  gender: user.gender,
  occupation: user.occupation,
  education: user.education,
});

const localizedTopicLabels = {
  am: {
    Health: "ጤና",
    Education: "ትምህርት",
    "Water Supply": "የውሃ አቅርቦት",
    Electricity: "ኤሌክትሪክ",
    Housing: "መኖሪያ ቤት",
    Transport: "ትራንስፖርት",
    Roads: "መንገዶች",
    "Digital Infrastructure": "ዲጂታል መሠረተ ልማት",
    Agriculture: "ግብርና",
    Environment: "አካባቢ",
    "Climate Change": "የአየር ንብረት ለውጥ",
    Economy: "ኢኮኖሚ",
    Employment: "ሥራ እና ቅጥር",
    "Small Business": "አነስተኛ ንግድ",
    Industry: "ኢንዱስትሪ",
    Trade: "ንግድ",
    Tourism: "ቱሪዝም",
    "Social Protection": "ማህበራዊ ጥበቃ",
    "Food Security": "የምግብ ደህንነት",
    "Poverty Reduction": "ድህነት ቅነሳ",
    Governance: "አስተዳደር",
    Justice: "ፍትሕ",
    "Public Safety": "የህዝብ ደህንነት",
    "Urban Planning": "ከተማ እቅድ",
    "Rural Development": "የገጠር ልማት",
    Youth: "ወጣቶች",
    "Women Affairs": "የሴቶች ጉዳይ",
  },
  om: {
    Health: "fayya",
    Education: "barnoota",
    "Water Supply": "dhiyeessa bishaanii",
    Electricity: "ibsa mootummaa",
    Housing: "mana jireenyaa",
    Transport: "geejjiba",
    Roads: "daandii",
    "Digital Infrastructure": "bu'uura dijitaalaa",
    Agriculture: "qonna",
    Environment: "naannoo",
    "Climate Change": "jijjiirama qilleensaa",
    Economy: "dinagdee",
    Employment: "carraa hojii",
    "Small Business": "daldala xixiqqaa",
    Industry: "indastirii",
    Trade: "daldala",
    Tourism: "turizimii",
    "Social Protection": "eeggumsa hawaasummaa",
    "Food Security": "nageenya nyaataa",
    "Poverty Reduction": "hir'ina hiyyummaa",
    Governance: "bulchiinsa gaarii",
    Justice: "haqa",
    "Public Safety": "nageenya uummataa",
    "Urban Planning": "karoora magaalaa",
    "Rural Development": "misooma baadiyyaa",
    Youth: "dargaggoota",
    "Women Affairs": "dhimma dubartootaa",
  },
  ti: {
    Health: "ጥዕና",
    Education: "ትምህርቲ",
    "Water Supply": "ቀረብ ማይ",
    Electricity: "ኤሌክትሪክ",
    Housing: "መንበሪ ቤት",
    Transport: "መጓዓዝያ",
    Roads: "መንገዲ",
    "Digital Infrastructure": "ዲጂታላዊ መሰረተ ልማት",
    Agriculture: "ሕርሻ",
    Environment: "ኣከባቢ",
    "Climate Change": "ለውጢ ኣየር",
    Economy: "ኢኮኖሚ",
    Employment: "ስራሕ",
    "Small Business": "ንእሽቶ ንግዲ",
    Industry: "ኢንዱስትሪ",
    Trade: "ንግዲ",
    Tourism: "ቱሪዝም",
    "Social Protection": "ማሕበራዊ ጥበቃ",
    "Food Security": "ውሕስነት ምግቢ",
    "Poverty Reduction": "ምቕናስ ድኽነት",
    Governance: "ኣመሓደርቲ",
    Justice: "ፍትሒ",
    "Public Safety": "ህዝባዊ ደሕንነት",
    "Urban Planning": "ምድላው ከተማ",
    "Rural Development": "ልምዓት ገጠር",
    Youth: "መንእሰያት",
    "Women Affairs": "ጉዳይ ደቂ ኣንስትዮ",
  },
};

const localizedOccupationLabels = {
  am: {
    student: "ተማሪ",
    farmer: "ገበሬ",
    merchant: "ነጋዴ",
    "government-employee": "የመንግስት ሰራተኛ",
    "private-sector": "የግል ዘርፍ ሰራተኛ",
    unemployed: "ስራ የሌለው",
    other: "ሌላ",
  },
  om: {
    student: "barataa",
    farmer: "qonnaan bulaa",
    merchant: "daldalaa",
    "government-employee": "hojjetaa mootummaa",
    "private-sector": "hojjetaa dhuunfaa",
    unemployed: "hojii hin qabne",
    other: "kan biraa",
  },
  ti: {
    student: "ተማሃራይ",
    farmer: "ሓረስታይ",
    merchant: "ነጋዳይ",
    "government-employee": "ሰራሕተኛ መንግስቲ",
    "private-sector": "ሰራሕተኛ ውልቃዊ ዘርፊ",
    unemployed: "ስራሕ ዘይብሉ",
    other: "ካልእ",
  },
};

const localizedRegionLabels = {
  am: {
    "Addis Ababa": "አዲስ አበባ",
    Oromia: "ኦሮሚያ",
    Amhara: "አማራ",
    Tigray: "ትግራይ",
    SNNPR: "ደቡብ ብሔሮች",
    Sidama: "ሲዳማ",
    Harari: "ሐረሪ",
    Gambela: "ጋምቤላ",
    "Benishangul-Gumuz": "ቤንሻንጉል ጉሙዝ",
    Afar: "አፋር",
    Somali: "ሶማሊ",
  },
  om: {
    "Addis Ababa": "Finfinnee",
    Oromia: "Oromiyaa",
    Amhara: "Amaaraa",
    Tigray: "Tigraay",
    SNNPR: "Kibba Biyyoolessaa",
    Sidama: "Sidaamaa",
    Harari: "Hararii",
    Gambela: "Gaambeellaa",
    "Benishangul-Gumuz": "Beenishaangul Gumuzii",
    Afar: "Afaarii",
    Somali: "Somaalee",
  },
  ti: {
    "Addis Ababa": "ኣዲስ ኣበባ",
    Oromia: "ኦሮሚያ",
    Amhara: "ኣምሓራ",
    Tigray: "ትግራይ",
    SNNPR: "ደቡብ ብሄራት",
    Sidama: "ሲዳማ",
    Harari: "ሓረሪ",
    Gambela: "ጋምቤላ",
    "Benishangul-Gumuz": "ቤንሻንጉል ጉሙዝ",
    Afar: "ኣፋር",
    Somali: "ሶማሊ",
  },
};

const getLocalizedTopicLabel = (topicKey, language) =>
  localizedTopicLabels[language]?.[topicKey] || topicKey;

const getLocalizedOccupationLabel = (occupation, language) =>
  localizedOccupationLabels[language]?.[occupation] || humanize(occupation);

const getLocalizedRegionLabel = (region, language) =>
  localizedRegionLabels[language]?.[region] || region;

const joinLocalizedRegions = (regionList, language) => {
  const names = regionList.map((region) => getLocalizedRegionLabel(region, language));
  if (language === "am" || language === "ti") {
    return names.join(" እና ");
  }
  if (language === "om") {
    return names.join(" fi ");
  }
  return names.join(", ");
};

const buildPolicyReference = (policy) => {
  const title = String(policy.title || "").split(": ").pop() || policy.title;
  const regionText =
    policy.targetRegions.length === regions.length
      ? "across Ethiopia"
      : `for ${policy.targetRegions.join(", ")}`;
  return { title, regionText };
};

const buildCommentText = ({ language, sentiment, topicKey, user, policy }) => {
  const topic = topicLibrary[topicKey];
  const policyRef = buildPolicyReference(policy);
  const scopeText =
    policy.targetRegions.length === regions.length
      ? "the national rollout"
      : `the rollout in ${policy.targetRegions.join(", ")}`;
  const occupationLabel = humanize(user.occupation);
  const localOccupation = getLocalizedOccupationLabel(user.occupation, language);
  const localTopic = getLocalizedTopicLabel(topicKey, language);
  const localUserRegion = getLocalizedRegionLabel(user.region, language);
  const localTargetRegions = joinLocalizedRegions(policy.targetRegions, language);

  if (language === "am") {
    if (sentiment === "positive") {
      return `እኔ በ${localUserRegion} የምኖር ${localOccupation} ነኝ። ይህ የ${localTopic} ፖሊሲ በኮድ ${policy.policyCode} ለ${localTargetRegions} አስፈላጊ መፍትሄ ይሰጣል ብዬ አምናለሁ። የአገልግሎት ጥራትን ማሻሻል እና ለህዝብ ቀጥተኛ ጥቅም ማምጣት ይችላል።`;
    }
    if (sentiment === "negative") {
      return `እኔ በ${localUserRegion} የምኖር ${localOccupation} ነኝ። ይህ የ${localTopic} ፖሊሲ በኮድ ${policy.policyCode} ገና ግልጽ ያልሆኑ ክፍተቶች አሉት። የአፈጻጸም ዕቅዱ፣ የበጀት ግልጽነቱ እና የክትትል መርሀ ግብሩ በቂ ማብራሪያ ያስፈልጋሉ።`;
    }
    return `እኔ ${localOccupation} ሆኜ በ${localUserRegion} እኖራለሁ። ይህ የ${localTopic} ፖሊሲ በኮድ ${policy.policyCode} ላይ ተጨማሪ ዝርዝር መረጃ እፈልጋለሁ። የአፈጻጸም ደረጃዎች፣ የጊዜ ሰሌዳው እና ለአካባቢው የሚያመጣው ትክክለኛ ለውጥ ግልጽ ማብራሪያ ያስፈልገኛል።`;
  }

  if (language === "om") {
    if (sentiment === "positive") {
      return `Ani ${localOccupation} kan ${localUserRegion} keessa jiraadhu dha. Imaammatni ${localTopic} koodii ${policy.policyCode} qabu kun naannolee ${localTargetRegions} keessatti bu'aa qaba jedheen amana. Tajaajila fooyyessuu fi rakkoo uummataa hir'isuuf gargaara jedheen nan ilaala.`;
    }
    if (sentiment === "negative") {
      return `Ani ${localOccupation} kan ${localUserRegion} keessa jiraadhu dha. Imaammatni ${localTopic} koodii ${policy.policyCode} qabu kun hanqina qaba. Karoora hojii isaa, iftoomina baajataa fi akkaataa hordoffii isaa irratti ibsi dabalataa barbaachisa.`;
    }
    return `Ani ${localOccupation} ta'ee ${localUserRegion} keessa jiraadha. Imaammata ${localTopic} koodii ${policy.policyCode} qabu irratti odeeffannoo dabalataa barbaada. Yoom akka hojii jalqabu, eenyu akka hordofu fi maal akka fooyyessu ifaan beekuun barbaada.`;
  }

  if (language === "ti") {
    if (sentiment === "positive") {
      return `ኣነ ${localOccupation} ኮይነ ኣብ ${localUserRegion} ዝነብር እየ። እዚ ናይ ${localTopic} ፖሊሲ ብኮድ ${policy.policyCode} ን${localTargetRegions} ጠቓሚ መፍትሒ እዩ ኢለ እኣምን። ንኣገልግሎት ንምምሕያሽን ንህዝቢ ቀጥታ ጥቕሚ ንምምጻእን ይሕግዝ እዩ።`;
    }
    if (sentiment === "negative") {
      return `ኣነ ${localOccupation} ኮይነ ኣብ ${localUserRegion} ዝነብር እየ። እዚ ናይ ${localTopic} ፖሊሲ ብኮድ ${policy.policyCode} ገና ዘይተበርሁ ክፍተታት ኣለዎ። ናይ ኣፈጻጽማ መደብን ናይ በጀት ግልጽነትን ዝያዳ መብርሂ የድሊ።`;
    }
    return `ኣነ ${localOccupation} ኮይነ ኣብ ${localUserRegion} እነብር እየ። እዚ ናይ ${localTopic} ፖሊሲ ብኮድ ${policy.policyCode} ዝያዳ ንጹር ሓበሬታ የድልየኒ። መዓልታዊ ኣፈጻጽማኡ፣ ግዜ ሰሌዳኡን ንኣካባቢና ዘምጽኦ ለውጥን ብግልጽ ክቐርብ ኣለዎ።`;
  }

  if (sentiment === "positive") {
    return `As a ${occupationLabel} living in ${user.region}, I support "${policyRef.title}" ${policyRef.regionText}. ${topic.benefit}. The focus on ${scopeText} matches what households like mine need.`;
  }
  if (sentiment === "negative") {
    return `I live in ${user.region} and work as a ${occupationLabel}. I am not convinced that "${policyRef.title}" is ready because ${topic.concern}. The plan needs stronger implementation safeguards before it can earn broad trust.`;
  }
  return `I am a ${occupationLabel} from ${user.region}. I can see value in "${policyRef.title}", but ${topic.neutral}. I would like clearer milestones before I fully support ${scopeText}.`;
};

const buildOfficialReplyText = ({ language, topicKey, commentUserRegion }) => {
  const localRegion = getLocalizedRegionLabel(commentUserRegion, language);
  if (language === "am") {
    return `ከ${localRegion} የቀረበውን አስተያየት እናመሰግናለን። የአፈጻጸም ደረጃዎች፣ የክትትል ሂደቶች እና የአገልግሎት ጥራት መለኪያዎች በግልጽ ይከታተላሉ።`;
  }
  if (language === "om") {
    return `Yaada keessan galatoomaa. Tarkaanfiileen hojii, sirna hordoffii fi madaalli qulqullinaa ifatti ni qoodamu.`;
  }
  if (language === "ti") {
    return `ንርእይቶኹም ነመስግን። ደረጃታት ኣፈጻጽማ፣ ስርዓት ክትትልን መለክዒ ጥራይ ኣገልግሎትን ብግልጽ ክቐርቡ እዮም።`;
  }
  return `Thank you for raising this point from ${commentUserRegion}. We will track delivery milestones and publish implementation updates during rollout.`;
};

const buildLowConfidenceText = ({ language, topicKey, user }) => {
  const localTopic = getLocalizedTopicLabel(topicKey, language);
  const localRegion = getLocalizedRegionLabel(user.region, language);
  if (language === "am") {
    return `በ${localRegion} ውስጥ የ${localTopic} ፖሊሲ በእርግጥ ውጤት ያመጣል ወይስ አያመጣም ብዬ ገና አልተረጋገጥኩም። ተጨማሪ መረጃ እና ግልጽ ማብራሪያ እፈልጋለሁ።`;
  }
  if (language === "om") {
    return `Imaammatni ${localTopic} kun ${localRegion} keessatti bu'aa qabaachuu danda'a; garuu ammaaf murteessuuf na rakkisa. Odeeffannoo dabalataa fi ibsa ifaa barbaada.`;
  }
  if (language === "ti") {
    return `እዚ ናይ ${localTopic} ፖሊሲ ኣብ ${localRegion} ጠቓሚ ክኸውን ይኽእል እዩ፣ ግን ሕጂ ብርግጽ ክብል ኣይክእልን። ዝያዳ ሓበሬታ እደሊ።`;
  }
  return `I can see parts of this ${topicKey.toLowerCase()} proposal working in ${user.region}, but I am still unsure. I would like clearer implementation details first.`;
};

const buildReportedText = ({ language, topicKey, user }) => {
  const localTopic = getLocalizedTopicLabel(topicKey, language);
  const localRegion = getLocalizedRegionLabel(user.region, language);
  if (language === "am") {
    return `ይህ የ${localTopic} ፖሊሲ ሂደት ለ${localRegion} ሰዎች ፍትሃዊ አይደለም ብዬ አስባለሁ፤ ስለዚህ እንደገና ሊመረመር ይገባል።`;
  }
  if (language === "om") {
    return `Adeemsi imaammata ${localTopic} kun jiraattota ${localRegion} hundaaf haqa qabeessa miti jedheen yaada; kanaaf akka irra deebi'amee ilaalamu barbaada.`;
  }
  if (language === "ti") {
    return `እዚ ናይ ${localTopic} ፖሊሲ ሂደት ንነበርቲ ${localRegion} ፍትሓዊ ኣይኮነን ኢለ እሓስብ፤ ስለዚ ዳግማይ ክርአ ኣለዎ።`;
  }
  return `I do not think the current discussion around this ${topicKey.toLowerCase()} policy is fair to residents in ${user.region}. It should be reviewed more carefully.`;
};

const buildAppealText = ({ language, topicKey, user }) => {
  const localTopic = getLocalizedTopicLabel(topicKey, language);
  const localRegion = getLocalizedRegionLabel(user.region, language);
  if (language === "am") {
    return `በ${localRegion} የ${localTopic} ጉዳይ ላይ የጻፍኩት አስተያየት እንደገና እንዲመረመር እፈልጋለሁ። ዓላማዬ ክርክርን ማሻሻያን ለማገዝ ነው።`;
  }
  if (language === "om") {
    return `Yaadni ani dhimma ${localTopic} irratti barreesse akka irra deebi'amee ilaalamu barbaada. Kaayyoon koo marii fi fooyya'iinsa deeggaruudha.`;
  }
  if (language === "ti") {
    return `ኣብ ጉዳይ ${localTopic} ዝጸሓፍክዎ ርእይቶ ዳግማይ ክርአ እደሊ። ዕላማይ ምምሕያሽ ዘለዎ ክትዕ ምድጋፍ እዩ።`;
  }
  return `I want my comment on this ${topicKey.toLowerCase()} policy to be reviewed again. My goal was to improve the discussion, not to disrupt it.`;
};

const buildCommentCreatedAt = (policy, offset) => {
  const start = policy.createdAt < policy.startDate ? policy.createdAt : policy.startDate;
  const end =
    policy.status === "closed" || policy.status === "archived"
      ? policy.endDate
      : policy.endDate > new Date()
        ? new Date()
        : policy.endDate;
  const safeEnd = end <= start ? new Date(start.getTime() + 5 * 24 * 60 * 60 * 1000) : end;
  const diff = safeEnd.getTime() - start.getTime();
  const ratio = ((offset % 23) + 1) / 24;
  return new Date(start.getTime() + Math.floor(diff * ratio));
};

const pickCommentersByLanguage = (
  eligibleCitizens,
  language,
  count,
  usedIds,
  offset,
) => {
  const languagePool = eligibleCitizens.filter(
    (citizen) =>
      citizen.preferredLanguage === language ||
      citizen.languagesSpoken.includes(language),
  );
  const ordered = rotate(languagePool.length ? languagePool : eligibleCitizens, offset);
  const picked = [];

  for (const citizen of ordered) {
    if (picked.length >= count) break;
    const id = citizen._id.toString();
    if (usedIds.has(id)) continue;
    usedIds.add(id);
    picked.push(citizen);
  }

  return picked;
};

const getSentimentCommentCounts = (policyIndex, languageIndex) => {
  const base = Math.max(COMMENTS_PER_LANGUAGE_SENTIMENT, 1);
  const sentiments = ["positive", "neutral", "negative"];
  const dominantSentiment = sentiments[policyIndex % sentiments.length];
  const secondarySentiment =
    sentiments[(policyIndex + 1) % sentiments.length];
  const tertiarySentiment =
    sentiments[(policyIndex + 2) % sentiments.length];
  const counts = {
    positive: base,
    neutral: base,
    negative: base,
  };

  counts[dominantSentiment] += 2 + ((policyIndex + languageIndex) % 2);
  counts[secondarySentiment] += languageIndex % 2 === 0 ? 1 : 0;
  counts[tertiarySentiment] += languageIndex % 3 === 0 ? 1 : 0;

  return counts;
};

const createComments = async ({
  citizens,
  planners,
  moderators,
  policies,
  policyProfileMap,
}) => {
  const citizenIndex = createCitizenIndexes(citizens);
  const topLevelDocs = [];
  const replyPlan = [];
  const visibleCommentParents = [];

  policies.forEach((policy, policyIndex) => {
    const { topicKey, planner } = policyProfileMap.get(policy._id.toString());
    const eligibleCitizens = getEligibleCitizens(
      citizenIndex,
      policy.targetRegions || regions,
    );
    const usedIds = new Set();
    let commentOffset = 0;

    // Allow multiple languages across comments (one language per comment)
    const policyLanguages = shuffle(languages).slice(0, Math.min(languages.length, 3));
    policyLanguages.forEach((language, languageIndex) => {
      const sentimentCounts = getSentimentCommentCounts(
        policyIndex,
        languageIndex,
      );

      ["positive", "neutral", "negative"].forEach((sentiment) => {
        const commenters = pickCommentersByLanguage(
          eligibleCitizens,
          language,
          sentimentCounts[sentiment],
          usedIds,
          policyIndex * 17 + commentOffset,
        );

        commenters.forEach((citizen, localIndex) => {
          const createdAt = buildCommentCreatedAt(
            policy,
            commentOffset + localIndex + 1,
          );
          // base text for language/sentiment
          let text = buildCommentText({
            language,
            sentiment,
            topicKey,
            user: citizen,
            policy,
          });

          // small localized suffixes to make individual comments visually different
          const localizedSuffixes = {
            en: ["", " Thanks for listening.", " I hope this helps.", " This matters."],
            am: ["", " እናመሰግናለን።", " እባክዎ ይህን ይከታተሉ።", " ይህ ጉዳይ አስፈላጊ ነው።"],
            om: ["", " Galatoomaa.", " Karaa kanaan isin galateeffadha.", " Kun dhimma guddaa dha."],
            ti: ["", " የተመስገን።", " እባክዎ ይህን ይከታተሉ።", " እዚ ጉዳይ ኣስፈላጊ እዩ።"],
          };
          const suffixPool = localizedSuffixes[language] || localizedSuffixes.en;
          const suffix = suffixPool[Math.floor(random() * suffixPool.length)];
          text = text + suffix;

          // vary confidence slightly so visualization changes
          const baseConfidence = sentiment === "neutral" ? 0.78 : sentiment === "positive" ? 0.9 : 0.86;
          const delta = (random() - 0.5) * 0.12; // +/-0.06
          let confidence = Math.max(0.35, Math.min(0.99, +(baseConfidence + delta).toFixed(2)));

          const keywords = getKeywordSlice(
            topicKey,
            commentOffset + localIndex,
            3,
          );
          topLevelDocs.push({
            policyId: policy._id,
            userId: citizen._id,
            parentCommentId: null,
            demographics: buildDemographicsSnapshot(citizen),
            region: citizen.region,
            text,
            language,
            visibility: "visible",
            aiStatus: "processed",
            sentiment: {
              label: sentiment,
              confidence,
              overriddenByModerator: false,
            },
            keywords,
            aiAnalysis: {
              raw: { sentiment, confidence, keywords },
              version: "defense-seed-v2",
              analyzedAt: createdAt,
            },
            lastAnalyzedAt: createdAt,
            reportState: "clean",
            reportCount: 0,
            reports: [],
            appeal: null,
            reviewFlags: {
              sentimentReviewNeeded: false,
              moderationReviewNeeded: false,
            },
            moderationActions: [],
            events: [
              {
                type: "created",
                actor: citizen._id,
                data: { text, language },
                createdAt,
              },
              {
                type: "ai_analyzed",
                actor: null,
                data: { sentiment, confidence, keywords },
                createdAt,
              },
            ],
            createdAt,
          });
          visibleCommentParents.push({
            policyIndex,
            topicKey,
            planner,
            citizen,
            language,
            createdAt,
          });
        });

        commentOffset += sentimentCounts[sentiment];
      });
    });

    const moderator = moderators[policyIndex % moderators.length];
    const lowConfidenceUser = pickCommentersByLanguage(
      eligibleCitizens,
      languages[policyIndex % languages.length],
      1,
      usedIds,
      policyIndex * 19,
    )[0];
    if (lowConfidenceUser) {
      const createdAt = buildCommentCreatedAt(policy, commentOffset + 4);
      const language = COMMENT_LANGUAGE;
      const text = buildLowConfidenceText({
        language,
        topicKey,
        user: lowConfidenceUser,
      });
      topLevelDocs.push({
        policyId: policy._id,
        userId: lowConfidenceUser._id,
        parentCommentId: null,
        demographics: buildDemographicsSnapshot(lowConfidenceUser),
        region: lowConfidenceUser.region,
        text,
        language,
        visibility: "visible",
        aiStatus: "processed",
        sentiment: {
          label: "neutral",
          confidence: 0.48,
          overriddenByModerator: false,
        },
        keywords: getKeywordSlice(topicKey, commentOffset + 3, 3),
        aiAnalysis: {
          raw: { sentiment: "neutral", confidence: 0.48 },
          version: "defense-seed-v2",
          analyzedAt: createdAt,
        },
        lastAnalyzedAt: createdAt,
        reportState: "clean",
        reportCount: 0,
        reports: [],
        appeal: null,
        reviewFlags: {
          sentimentReviewNeeded: true,
          moderationReviewNeeded: false,
        },
        moderationActions: [],
        events: [
          {
            type: "created",
            actor: lowConfidenceUser._id,
            data: { text, language },
            createdAt,
          },
          {
            type: "ai_analyzed",
            actor: null,
            data: { sentiment: "neutral", confidence: 0.48 },
            createdAt,
          },
        ],
        createdAt,
      });
    }

    const flaggedUser = pickCommentersByLanguage(
      eligibleCitizens,
      languages[(policyIndex + 1) % languages.length],
      1,
      usedIds,
      policyIndex * 23,
    )[0];
    if (flaggedUser) {
      const createdAt = buildCommentCreatedAt(policy, commentOffset + 8);
      const language = COMMENT_LANGUAGE;
      const text = buildReportedText({
        language,
        topicKey,
        user: flaggedUser,
      });
      const reporterPool = eligibleCitizens.filter(
        (citizen) => citizen._id.toString() !== flaggedUser._id.toString(),
      );
      const reporterOne = reporterPool[(policyIndex + 2) % reporterPool.length];
      const reporterTwo = reporterPool[(policyIndex + 11) % reporterPool.length];

      topLevelDocs.push({
        policyId: policy._id,
        userId: flaggedUser._id,
        parentCommentId: null,
        demographics: buildDemographicsSnapshot(flaggedUser),
        region: flaggedUser.region,
        text,
        language,
        visibility: "hidden",
        aiStatus: "processed",
        sentiment: {
          label: "negative",
          confidence: 0.94,
          overriddenByModerator: false,
        },
        keywords: getKeywordSlice(topicKey, commentOffset + 9, 3),
        aiAnalysis: {
          raw: { sentiment: "negative", confidence: 0.94 },
          version: "defense-seed-v2",
          analyzedAt: createdAt,
        },
        lastAnalyzedAt: createdAt,
        reportState: "under_review",
        reportCount: 2,
        reports: [
          {
            reporterId: reporterOne._id,
            reason: "harassment",
            details:
              "The wording feels hostile and distracts from constructive discussion.",
            status: "pending",
            createdAt,
            snapshot: {
              text,
              sentiment: { label: "negative", confidence: 0.94 },
              keywords: getKeywordSlice(topicKey, commentOffset + 9, 3),
              visibility: "visible",
              aiStatus: "processed",
              reportCount: 0,
            },
          },
          {
            reporterId: reporterTwo._id,
            reason: "misinformation",
            details:
              "The comment makes claims about implementation that are not supported by the policy text.",
            status: "pending",
            createdAt,
            snapshot: {
              text,
              sentiment: { label: "negative", confidence: 0.94 },
              keywords: getKeywordSlice(topicKey, commentOffset + 9, 3),
              visibility: "visible",
              aiStatus: "processed",
              reportCount: 1,
            },
          },
        ],
        appeal: null,
        reviewFlags: {
          sentimentReviewNeeded: false,
          moderationReviewNeeded: true,
        },
        moderationActions: [
          {
            action: "hide",
            reason: "reported_for_review",
            actor: moderator._id,
            createdAt,
          },
        ],
        moderatedBy: moderator._id,
        moderatedAt: createdAt,
        moderationReason: "Seeded moderation review case",
        events: [
          {
            type: "created",
            actor: flaggedUser._id,
            data: { text, language },
            createdAt,
          },
          {
            type: "reported",
            actor: reporterOne._id,
            data: { reason: "harassment" },
            createdAt,
          },
          {
            type: "reported",
            actor: reporterTwo._id,
            data: { reason: "misinformation" },
            createdAt,
          },
        ],
        createdAt,
      });
    }

    const appealUser = pickCommentersByLanguage(
      eligibleCitizens,
      languages[(policyIndex + 2) % languages.length],
      1,
      usedIds,
      policyIndex * 29,
    )[0];
    if (appealUser) {
      const createdAt = buildCommentCreatedAt(policy, commentOffset + 12);
      const language = COMMENT_LANGUAGE;
      const text = buildAppealText({ language, topicKey, user: appealUser });
      topLevelDocs.push({
        policyId: policy._id,
        userId: appealUser._id,
        parentCommentId: null,
        demographics: buildDemographicsSnapshot(appealUser),
        region: appealUser.region,
        text,
        language,
        visibility: "hidden",
        aiStatus: "processed",
        sentiment: {
          label: "neutral",
          confidence: 0.68,
          overriddenByModerator: false,
        },
        keywords: getKeywordSlice(topicKey, commentOffset + 13, 3),
        aiAnalysis: {
          raw: { sentiment: "neutral", confidence: 0.68 },
          version: "defense-seed-v2",
          analyzedAt: createdAt,
        },
        lastAnalyzedAt: createdAt,
        reportState: "clean",
        reportCount: 0,
        reports: [],
        appeal: {
          appellantId: appealUser._id,
          reason:
            "My comment was intended as constructive policy feedback and should be reviewed again.",
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
            reason: "appeal_seed_case",
            actor: moderator._id,
            createdAt,
          },
        ],
        moderatedBy: moderator._id,
        moderatedAt: createdAt,
        moderationReason: "Seeded appeal review case",
        events: [
          {
            type: "created",
            actor: appealUser._id,
            data: { text, language },
            createdAt,
          },
          {
            type: "appealed",
            actor: appealUser._id,
            data: {
              reason:
                "My comment was intended as constructive policy feedback and should be reviewed again.",
            },
            createdAt,
          },
        ],
        createdAt,
      });
    }
  });

  const topLevelComments = await batchInsert(Comment, topLevelDocs, 500);

  const commentsByPolicy = new Map();
  topLevelComments.forEach((comment) => {
    if (!commentsByPolicy.has(comment.policyId.toString())) {
      commentsByPolicy.set(comment.policyId.toString(), []);
    }
    commentsByPolicy.get(comment.policyId.toString()).push(comment);
  });

  policies.forEach((policy, policyIndex) => {
    const { topicKey, planner } = policyProfileMap.get(policy._id.toString());
    const visibleComments = (commentsByPolicy.get(policy._id.toString()) || []).filter(
      (comment) => comment.visibility === "visible" && !comment.parentCommentId,
    );
    const selectedParents = visibleComments.slice(0, REPLIES_PER_POLICY);

    selectedParents.forEach((parentComment, replyIndex) => {
      const createdAt = new Date(
        parentComment.createdAt.getTime() + (replyIndex + 1) * 90 * 60 * 1000,
      );
      replyPlan.push({
        policyId: policy._id,
        userId: planner._id,
        parentCommentId: parentComment._id,
        demographics: buildDemographicsSnapshot(planner),
        region: planner.region,
        text: buildOfficialReplyText({
          language: parentComment.language || planner.preferredLanguage || "en",
          topicKey,
          commentUserRegion:
            parentComment.userId?.region || policy.targetRegions[0] || planner.region,
        }),
        language: parentComment.language || planner.preferredLanguage || "en",
        visibility: "visible",
        aiStatus: "processed",
        sentiment: {
          label: "neutral",
          confidence: 0.89,
          overriddenByModerator: false,
        },
        keywords: getKeywordSlice(topicKey, replyIndex + policyIndex, 2),
        aiAnalysis: {
          raw: { sentiment: "neutral", confidence: 0.89 },
          version: "defense-seed-v2",
          analyzedAt: createdAt,
        },
        lastAnalyzedAt: createdAt,
        reportState: "clean",
        reportCount: 0,
        reports: [],
        appeal: null,
        reviewFlags: {
          sentimentReviewNeeded: false,
          moderationReviewNeeded: false,
        },
        moderationActions: [],
        events: [
          {
            type: "created",
            actor: planner._id,
            data: { parentCommentId: parentComment._id.toString(), official: true },
            createdAt,
          },
        ],
        isOfficialReply: true,
        createdAt,
      });
    });
  });

  const replyComments = await batchInsert(Comment, replyPlan, 500);

  const replyCounts = new Map();
  replyComments.forEach((reply) => {
    const key = reply.parentCommentId.toString();
    replyCounts.set(key, (replyCounts.get(key) || 0) + 1);
  });

  if (replyCounts.size) {
    await Comment.bulkWrite(
      Array.from(replyCounts.entries()).map(([commentId, count]) => ({
        updateOne: {
          filter: { _id: commentId },
          update: { $set: { replyCount: count } },
        },
      })),
    );
  }
};

const createPlannerRequests = async ({ citizens, adminUser }) => {
  const requestCitizens = citizens.slice(0, 18);
  const requests = requestCitizens.map((citizen, index) => {
    const status =
      index % 3 === 0 ? "pending" : index % 3 === 1 ? "approved" : "rejected";
    const reviewedAt =
      status === "pending"
        ? null
        : new Date(Date.now() - (8 - (index % 5)) * 24 * 60 * 60 * 1000);

    return {
      userId: citizen._id,
      applicantType: "citizen",
      fullName: `${humanize(citizen.occupation)} Leader ${index + 1}`,
      email: citizen.email,
      phone: `+2519${String(30000000 + index).slice(-8)}`,
      region: citizen.region,
      ageRange: citizen.ageRange,
      gender: citizen.gender,
      occupation: citizen.occupation,
      education: citizen.education,
      preferredLanguage: citizen.preferredLanguage,
      languagesSpoken: citizen.languagesSpoken,
      organization:
        index % 2 === 0
          ? "Local Civic Forum"
          : "Community Service Association",
      reason:
        "I regularly organize community discussions and need planner access to review policy feedback, track regional participation, and help present evidence-based summaries to local residents and administrators.",
      proofFile: null,
      proofFileName: null,
      status,
      reviewedBy: status === "pending" ? null : adminUser._id,
      reviewedAt,
      rejectionReason:
        status === "rejected"
          ? "The application needs more concrete experience in policy facilitation and public reporting."
          : null,
      createdAt: new Date(
        Date.now() - (30 - index) * 24 * 60 * 60 * 1000,
      ),
    };
  });

  await batchInsert(PlannerRequest, requests, 250);
};

const createPolicyAssociates = async ({ planners, policies }) => {
  const associateDocs = [];

  policies.forEach((policy, index) => {
    const ownerId = policy.createdBy.toString();
    const eligibleAssociates = planners.filter(
      (planner) => planner._id.toString() !== ownerId,
    );
    const acceptedAssociate = eligibleAssociates[index % eligibleAssociates.length];
    const pendingAssociate =
      eligibleAssociates[(index + 2) % eligibleAssociates.length];

    associateDocs.push({
      policyId: policy._id,
      plannerId: acceptedAssociate._id,
      permissions: ["moderate_comments", "reply_official", "export_data"],
      assignedBy: policy.createdBy,
      invitedAt: new Date(
        policy.createdAt.getTime() + 2 * 24 * 60 * 60 * 1000,
      ),
      expiresAt: new Date(
        policy.createdAt.getTime() + 14 * 24 * 60 * 60 * 1000,
      ),
      acceptedAt: new Date(
        policy.createdAt.getTime() + 5 * 24 * 60 * 60 * 1000,
      ),
      invitationStatus: "accepted",
      lastModifiedAt: new Date(
        policy.createdAt.getTime() + 5 * 24 * 60 * 60 * 1000,
      ),
      lastModifiedBy: policy.createdBy,
      metadata: { notes: "Seeded accepted associate for defense dataset." },
    });

    associateDocs.push({
      policyId: policy._id,
      plannerId: pendingAssociate._id,
      permissions: ["moderate_comments"],
      assignedBy: policy.createdBy,
      invitedAt: new Date(
        policy.createdAt.getTime() + 8 * 24 * 60 * 60 * 1000,
      ),
      expiresAt: new Date(
        policy.createdAt.getTime() + 22 * 24 * 60 * 60 * 1000,
      ),
      invitationStatus: "pending",
      lastModifiedAt: new Date(
        policy.createdAt.getTime() + 8 * 24 * 60 * 60 * 1000,
      ),
      lastModifiedBy: policy.createdBy,
      metadata: { notes: "Seeded pending associate invitation." },
    });
  });

  await batchInsert(PolicyAssociate, associateDocs, 300);
};

const createNotificationsAndAuditLogs = async ({
  adminUser,
  planners,
  moderators,
  citizens,
  policies,
}) => {
  const notifications = [
    {
      userId: citizens[0]._id,
      userRole: "citizen",
      type: "COMMENT_REPLY",
      title: "New policy reply",
      message:
        "A planner replied to your comment with implementation details for the proposal.",
      data: { policyId: policies[0]._id.toString() },
      read: false,
      severity: "info",
      source: "system",
      createdAt: new Date(),
      updatedAt: new Date(),
    },
    {
      userId: planners[0]._id,
      userRole: "planner",
      type: "PLANNER_APPROVED",
      title: "Planner workspace ready",
      message:
        "Your planner workspace has been seeded with policies, comments, and analytics for the defense demo.",
      data: {},
      read: false,
      severity: "info",
      source: "system",
      createdAt: new Date(),
      updatedAt: new Date(),
    },
    {
      userId: adminUser._id,
      userRole: "admin",
      type: "COMMENT_APPEAL",
      title: "Appeal queue populated",
      message:
        "Seeded comment appeals are available for review in the moderation dashboard.",
      data: {},
      read: false,
      severity: "warning",
      source: "system",
      createdAt: new Date(),
      updatedAt: new Date(),
    },
  ];

  await batchInsert(Notification, notifications, 100);

  const auditLogs = [
    {
      userId: adminUser._id,
      userRole: "admin",
      action: "DEFENSE_SEED_RESET",
      targetType: "Dataset",
      targetId: null,
      details: { message: "Demo collections reset before defense seed." },
      timestamp: new Date(),
    },
    {
      userId: planners[0]._id,
      userRole: "planner",
      action: "DEFENSE_POLICY_CREATED",
      targetType: "Policy",
      targetId: policies[0]._id,
      details: { title: policies[0].title },
      timestamp: new Date(),
    },
    {
      userId: moderators[0]._id,
      userRole: "comment_moderator",
      action: "DEFENSE_MODERATION_QUEUE_CREATED",
      targetType: "Comment",
      targetId: null,
      details: { queue: "pending_review_and_reports" },
      timestamp: new Date(),
    },
  ];

  await batchInsert(AuditLog, auditLogs, 100);
};

const createSmsArtifacts = async ({ smsVoteRecords, citizens }) => {
  const smsCitizens = smsVoteRecords.slice(0, 120).map((record) => record.citizen);
  const uniquePhoneMap = new Map();
  smsCitizens.forEach((citizen) => {
    uniquePhoneMap.set(citizen.phoneHash, citizen);
  });

  const subscriptions = Array.from(uniquePhoneMap.values()).map((citizen) => ({
    phoneHash: citizen.phoneHash,
    subscribed: true,
    preferredLanguage: citizen.preferredLanguage,
    region: citizen.region,
    subscribedAt: new Date(Date.now() - 45 * 24 * 60 * 60 * 1000),
    createdAt: new Date(Date.now() - 45 * 24 * 60 * 60 * 1000),
  }));

  await batchInsert(SmsSubscription, subscriptions, 200);

  const activities = smsVoteRecords.slice(0, 180).flatMap((record, index) => [
    {
      phoneHash: record.citizen.phoneHash,
      phoneLast4: String(index + 1000).slice(-4),
      direction: "inbound",
      command: record.command,
      inboundMessage: `Vote ${String(record.value)}`,
      replyMessage: "",
      success: true,
      statusCode: 200,
      policyId: record.policyId,
      metadata: { seeded: true, source: "defense_seed" },
      createdAt: record.createdAt,
    },
    {
      phoneHash: record.citizen.phoneHash,
      phoneLast4: String(index + 1000).slice(-4),
      direction: "outbound",
      command: "CONFIRM",
      inboundMessage: "",
      replyMessage:
        "Your vote was recorded successfully. Thank you for participating.",
      success: true,
      statusCode: 200,
      policyId: record.policyId,
      metadata: { seeded: true, source: "defense_seed" },
      createdAt: new Date(record.createdAt.getTime() + 90 * 1000),
    },
  ]);

  await batchInsert(SmsActivity, activities, 300);
};

const saveDemoCredentials = ({ adminUser, moderators, planners }) => {
  const demoAccounts = [adminUser, ...moderators, ...planners].map((user) => ({
    email: user.email,
    role: user.role,
    password: DEFAULT_PASSWORD,
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

  const outputDir = path.join(__dirname, "../tokens");
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }

  const outputPath = path.join(outputDir, "defense_seed_credentials.json");
  fs.writeFileSync(outputPath, JSON.stringify(demoAccounts, null, 2));
  return outputPath;
};

async function seed() {
  try {
    console.log("Connecting to MongoDB...");
    await mongoose.connect(MONGO_URI);
    console.log("Connected.");

    console.log("Resetting demo-facing collections...");
    await Promise.all([
      Vote.deleteMany({}),
      Comment.deleteMany({}),
      Policy.deleteMany({}),
      Notification.deleteMany({}),
      AuditLog.deleteMany({}),
      SmsSubscription.deleteMany({}),
      SmsActivity.deleteMany({}),
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
      SmsActivity.syncIndexes(),
      PlannerRequest.syncIndexes(),
      PolicyAssociate.syncIndexes(),
    ]);

    const { adminUser, moderators, planners, citizens } = await createUsers();
    const { policies, policyProfileMap } = await createPolicies({ planners });
    const smsVoteRecords = await createVotes({
      citizens,
      policies,
      policyProfileMap,
    });
    await createComments({
      citizens,
      planners,
      moderators,
      policies,
      policyProfileMap,
    });
    await createPlannerRequests({ citizens, adminUser });
    await createPolicyAssociates({ planners, policies });
    await createNotificationsAndAuditLogs({
      adminUser,
      planners,
      moderators,
      citizens,
      policies,
    });
    await createSmsArtifacts({ smsVoteRecords, citizens });

    const credentialsPath = saveDemoCredentials({
      adminUser,
      moderators,
      planners,
    });

    const [
      plannerCount,
      moderatorCount,
      citizenCount,
      policyCount,
      voteCount,
      commentCount,
      plannerRequestCount,
      associateCount,
      smsSubscriptionCount,
      smsActivityCount,
    ] = await Promise.all([
      User.countDocuments({ role: "planner" }),
      User.countDocuments({ role: "comment_moderator" }),
      User.countDocuments({ role: "citizen" }),
      Policy.countDocuments(),
      Vote.countDocuments(),
      Comment.countDocuments(),
      PlannerRequest.countDocuments(),
      PolicyAssociate.countDocuments(),
      SmsSubscription.countDocuments(),
      SmsActivity.countDocuments(),
    ]);

    console.log("\n========== DEFENSE DATASET COMPLETE ==========");
    console.log(`Admin accounts: 1`);
    console.log(`Comment moderators: ${moderatorCount}`);
    console.log(`Planners: ${plannerCount}`);
    console.log(`Citizens: ${citizenCount}`);
    console.log(`Policies: ${policyCount}`);
    console.log(`Votes: ${voteCount}`);
    console.log(`Comments (including replies): ${commentCount}`);
    console.log(`Planner requests: ${plannerRequestCount}`);
    console.log(`Policy associates: ${associateCount}`);
    console.log(`SMS subscriptions: ${smsSubscriptionCount}`);
    console.log(`SMS activity logs: ${smsActivityCount}`);
    console.log(`Credentials saved to: ${credentialsPath}`);
    console.log(`Default password: ${DEFAULT_PASSWORD}`);
    console.log("=============================================\n");

    await mongoose.disconnect();
  } catch (error) {
    console.error("Defense seed failed:", error);
    try {
      await mongoose.disconnect();
    } catch {
      // Ignore disconnect failures after seed errors.
    }
    process.exit(1);
  }
}

seed();
