require("dotenv").config();

const axios = require("axios");
const jwt = require("jsonwebtoken");

const API_BASE =
  process.env.PROD_API_BASE || "https://citizenvoice-backend.onrender.com/api";
const PROD_JWT_SECRET =
  process.env.PROD_JWT_SECRET || "your_super_secret_key_here";
const PROD_ADMIN_ID =
  process.env.PROD_ADMIN_ID || "6a20b2b829844b1a73ffbb79";
const SEED_TAG =
  process.env.SEED_TAG || `MODLANG-${new Date().toISOString().slice(0, 10)}`;
const SEED_MODE = String(process.env.SEED_MODE || "all").toLowerCase();

const TARGET_LANGUAGES = ["am", "om", "ti", "en"];
const REPORTS_PER_COMMENT = 5;
const USERS_PER_LANGUAGE = 6;
const POLL_INTERVAL_MS = 10000;
const POLL_ATTEMPTS = 18;

const AI_TEXTS = {
  am: [
    `[${SEED_TAG}] ይህ ፖሊሲ ጥሩ ነው እና አይደለምም፤ አንዳንድ ጊዜ ይረዳል አንዳንድ ጊዜ ግን ያስቸግራል። ደግፌዋለሁ ነገር ግን አልተረጋገጥኩም።`,
    `[${SEED_TAG}] አገልግሎቱ ጥሩ ሊሆን ይችላል ግን መጥፎም ሊሆን ይችላል፤ ፈጣን ነው እንጂ ደግሞ ዘገይ ይመስላል።`,
  ],
  om: [
    `[${SEED_TAG}] Imaammanni kun gaarii dha jedheen yaada, garuu hamaa ta'uu danda'a. Na gargaara fakkaata, garuu yeroo biraa rakkoo ta'a. Deeggaraas mormaas walitti qaba.`,
    `[${SEED_TAG}] Tajaajilli kun saffisaa fakkaata, garuu suuta jedheenis natti dhaga'ama. Sirrii ta'uu mala, dogoggora ta'uu malus jira.`,
  ],
  ti: [
    `[${SEED_TAG}] እዚ ፖሊሲ ጽቡቕ እዩ እሞ ኣይጽቡቕን እዩ፤ ሓደ ግዜ ይጠቕም ሓደ ግዜ ግን የሸግር። እደግፎ እየ ግን ኣይተረጋገጽኩን።`,
    `[${SEED_TAG}] እቲ ኣገልግሎት ቅልጡፍ ይመስል ግን ደንጉዩ እውን ይመስል። ቅኑዕ ክኸውን ይኽእል ግን ጌጋ እውን ክኸውን ይኽእል።`,
  ],
  en: [
    `[${SEED_TAG}] I support this policy and I do not support it at the same time. It feels helpful and harmful together, so I am genuinely unsure how to judge it.`,
    `[${SEED_TAG}] This seems efficient but also wasteful, fair but also unfair. I can see benefits and problems equally, so my opinion keeps changing.`,
  ],
};

const REPORTED_TEXTS = {
  am: `[${SEED_TAG}] ይህ አስተያየት ለሪፖርት ሙከራ ነው። የቋንቋ ማጣሪያ እንዲሰራ በአማርኛ ተጻፎአል።`,
  om: `[${SEED_TAG}] Kun yaada qorannoo report ti. Akka calaltuun afaanii hojjetuuf afaan Oromoon barreeffameera.`,
  ti: `[${SEED_TAG}] እዚ ርእይቶ ናይ report ሙከራ እዩ። እቲ ማጣርያ ቋንቋ ንኽሰርሕ ብትግርኛ ተጻሒፉ።`,
  en: `[${SEED_TAG}] This is a reported-comment seed written in English so moderators can test the language filter.`,
};

const APPEAL_TEXTS = {
  am: `[${SEED_TAG}] ይህ አስተያየት ለይግባኝ ሙከራ ነው። ሞዴሬተሮች በቋንቋ እንዲያጣሩት በአማርኛ ተጻፎአል።`,
  om: `[${SEED_TAG}] Kun yaada appeal ti. Moderattonni afaaniin akka isa calalan afaan Oromoon barreeffameera.`,
  ti: `[${SEED_TAG}] እዚ ርእይቶ ናይ appeal ሙከራ እዩ። ሞደሬተራት ብቋንቋ ንኽጣርይዎ ብትግርኛ ተጻሒፉ።`,
  en: `[${SEED_TAG}] This is an appeal-seed comment in English so admins and moderators can filter pending appeals by language.`,
};

const APPEAL_REASONS = {
  am: "ይህ ይግባኝ ለቋንቋ ማጣሪያ ሙከራ ብቻ ነው። አስተያየቱ እንደገና እንዲገመገም እጠይቃለሁ።",
  om: "Appealiin kun qorannoo calallii afaaniif qofa. Yaadni kun irra deebi'amee akka ilaalamu nan gaafadha.",
  ti: "እዚ appeal ንሙከራ ማጣርያ ቋንቋ ጥራይ እዩ። እቲ ርእይቶ ዳግማይ ክርአ እሓትት።",
  en: "This appeal is only for moderation-language filter testing. Please keep it pending for review.",
};

const REPORT_REASON = "language filter seed";

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

function signToken(user) {
  return jwt.sign(
    {
      id: user._id || user.id,
      role: user.role,
      region: user.region,
      verified: user.verified !== false,
    },
    PROD_JWT_SECRET,
    { expiresIn: "6h" },
  );
}

async function apiRequest(method, path, token, { data, params } = {}) {
  const response = await axios({
    method,
    url: `${API_BASE}${path}`,
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    data,
    params,
    timeout: 30000,
  });
  return response.data;
}

async function fetchActiveCitizens(adminToken) {
  const byLanguage = { am: [], om: [], ti: [], en: [] };

  for (let page = 1; page <= 8; page += 1) {
    const result = await apiRequest(
      "get",
      "/admin/users/citizens",
      adminToken,
      {
        params: { active: true, page, limit: 100 },
      },
    );

    const citizens = result?.data?.citizens || [];
    for (const citizen of citizens) {
      const lang = citizen.preferredLanguage;
      if (!TARGET_LANGUAGES.includes(lang)) continue;
      if (byLanguage[lang].some((item) => item._id === citizen._id)) continue;
      byLanguage[lang].push(citizen);
    }

    const complete = TARGET_LANGUAGES.every(
      (lang) => byLanguage[lang].length >= USERS_PER_LANGUAGE,
    );
    if (complete) return byLanguage;
  }

  const summary = TARGET_LANGUAGES.map(
    (lang) => `${lang}:${byLanguage[lang].length}`,
  ).join(", ");
  throw new Error(`Not enough active production citizens. Found ${summary}`);
}

async function fetchActivePolicies(adminToken) {
  const result = await apiRequest("get", "/policies", adminToken);
  const policies = result?.data?.policies || [];
  const activePolicies = policies.filter((policy) => policy.status === "active");

  if (!activePolicies.length) {
    throw new Error("No active production policies available for seeding.");
  }

  return activePolicies;
}

async function createComment(user, policyId, text) {
  const token = signToken(user);
  const result = await apiRequest("post", "/comments", token, {
    data: { policyId, text },
  });
  return result?.data;
}

async function reportComment(user, commentId, reason) {
  const token = signToken(user);
  return apiRequest("post", `/comments/${commentId}/report`, token, {
    data: {
      reason,
      description: `${SEED_TAG} report seed`,
    },
  });
}

async function appealComment(user, commentId, reason) {
  const token = signToken(user);
  return apiRequest("post", `/comments/${commentId}/appeal`, token, {
    data: {
      reason,
      description: `${SEED_TAG} appeal seed`,
    },
  });
}

async function fetchPendingMatches(adminToken) {
  const result = await apiRequest("get", "/admin/comments/pending", adminToken, {
    params: { content: SEED_TAG },
  });
  return result?.data?.comments || [];
}

async function fetchFlaggedMatches(adminToken) {
  const result = await apiRequest("get", "/admin/comments/flagged", adminToken, {
    params: { content: SEED_TAG },
  });
  return result?.data?.comments || [];
}

async function fetchAppealMatches(adminToken) {
  const result = await apiRequest("get", "/admin/appeals", adminToken, {
    params: { q: SEED_TAG },
  });
  return result?.data?.appeals || [];
}

async function waitForQueueItem(
  fetcher,
  commentId,
  predicate,
  label,
) {
  let lastItem = null;

  for (let attempt = 1; attempt <= POLL_ATTEMPTS; attempt += 1) {
    const items = await fetcher();
    lastItem = items.find(
      (item) =>
        item._id === commentId ||
        item.id === commentId ||
        item.commentId === commentId,
    );
    if (lastItem && predicate(lastItem)) return lastItem;
    console.log(
      `Waiting for ${label} on ${commentId} (${attempt}/${POLL_ATTEMPTS})...`,
    );
    await sleep(POLL_INTERVAL_MS);
  }

  return lastItem;
}

function pickUsers(byLanguage, language) {
  const users = byLanguage[language].slice(0, USERS_PER_LANGUAGE);
  return {
    author: users[0],
    reporters: users.slice(1, 1 + REPORTS_PER_COMMENT),
  };
}

async function seedAiNeedsReview(adminToken, byLanguage, policies) {
  const seeded = [];

  for (const language of TARGET_LANGUAGES) {
    const { author } = pickUsers(byLanguage, language);

    for (const text of AI_TEXTS[language]) {
      const policy = policies[seeded.length % policies.length];
      const comment = await createComment(author, policy.id, text);
      seeded.push({
        queue: "ai-needs-review",
        language,
        policyId: policy.id,
        commentId: comment._id,
        text,
      });
      console.log(`Created AI candidate ${comment._id} (${language})`);
      await sleep(250);
    }
  }

  const successful = [];
  const fetchPending = () => fetchPendingMatches(adminToken);

  for (const item of seeded) {
    const comment = await waitForQueueItem(
      fetchPending,
      item.commentId,
      (current) =>
        current?.language &&
        current?.aiStatus === "processed" &&
        current?.reviewFlags?.sentimentReviewNeeded === true,
      `AI review flag for ${item.language}`,
    );

    if (
      comment?.language &&
      comment?.aiStatus === "processed" &&
      comment?.reviewFlags?.sentimentReviewNeeded === true
    ) {
      successful.push({
        ...item,
        detectedLanguage: comment.language,
      });
      console.log(
        `AI Needs Review ready: ${item.commentId} (${item.language} -> ${comment.language})`,
      );
    } else {
      console.warn(
        `AI candidate did not enter pending queue: ${item.commentId} (${item.language})`,
      );
    }
  }

  return successful;
}

async function seedReported(adminToken, byLanguage, policies) {
  const seeded = [];

  for (const language of TARGET_LANGUAGES) {
    const { author, reporters } = pickUsers(byLanguage, language);
    const policy = policies[seeded.length % policies.length];
    const comment = await createComment(author, policy.id, REPORTED_TEXTS[language]);

    console.log(`Created report target ${comment._id} (${language})`);
    for (const reporter of reporters) {
      await reportComment(reporter, comment._id, REPORT_REASON);
      await sleep(150);
    }

    const finalComment = await waitForQueueItem(
      () => fetchFlaggedMatches(adminToken),
      comment._id,
      (current) =>
        current?.visibility === "hidden" &&
        current?.reportState === "under_review" &&
        Boolean(current?.language),
      `reported queue state for ${language}`,
    );

    seeded.push({
      queue: "reported",
      language,
      policyId: policy.id,
      commentId: comment._id,
      detectedLanguage: finalComment?.language || null,
      reportCount: finalComment?.reportCount || 0,
    });
    console.log(
      `Reported queue ready: ${comment._id} (${language} -> ${finalComment?.language || "unknown"})`,
    );
  }

  return seeded;
}

async function seedAppeals(adminToken, byLanguage, policies) {
  const seeded = [];

  for (const language of TARGET_LANGUAGES) {
    const { author, reporters } = pickUsers(byLanguage, language);
    const policy = policies[seeded.length % policies.length];
    const comment = await createComment(author, policy.id, APPEAL_TEXTS[language]);

    console.log(`Created appeal target ${comment._id} (${language})`);
    for (const reporter of reporters) {
      await reportComment(reporter, comment._id, REPORT_REASON);
      await sleep(150);
    }

    await waitForQueueItem(
      () => fetchFlaggedMatches(adminToken),
      comment._id,
      (current) => current?.visibility === "hidden",
      `hidden state before appeal for ${language}`,
    );

    await appealComment(author, comment._id, APPEAL_REASONS[language]);

    const finalComment = await waitForQueueItem(
      () => fetchAppealMatches(adminToken),
      comment._id,
      (current) => current?.appeal?.status === "pending",
      `appeal queue state for ${language}`,
    );

    seeded.push({
      queue: "appeals-pending",
      language,
      policyId: policy.id,
      commentId: comment._id,
      detectedLanguage: language,
      appealStatus: finalComment?.appeal?.status || null,
    });
    console.log(
      `Appeal queue ready: ${comment._id} (${language} -> ${finalComment?.language || "unknown"})`,
    );
  }

  return seeded;
}

async function fetchQueueCount(adminToken, path) {
  const result = await apiRequest("get", path, adminToken);
  const data = result?.data || {};

  if (Array.isArray(data)) return data.length;
  if (Array.isArray(data.comments)) return data.comments.length;
  if (Array.isArray(data.appeals)) return data.appeals.length;
  return 0;
}

async function main() {
  console.log(`Production moderation seed tag: ${SEED_TAG}`);
  console.log(`Production moderation seed mode: ${SEED_MODE}`);

  const adminToken = signToken({
    _id: PROD_ADMIN_ID,
    role: "admin",
    region: "Addis Ababa",
    verified: true,
  });

  const byLanguage = await fetchActiveCitizens(adminToken);
  const policies = await fetchActivePolicies(adminToken);

  console.log(
    `Using active production citizens: ${TARGET_LANGUAGES
      .map((lang) => `${lang}:${byLanguage[lang].slice(0, USERS_PER_LANGUAGE).map((u) => u.email).join(",")}`)
      .join(" | ")}`,
  );
  console.log(
    `Using active policies: ${policies.slice(0, 5).map((policy) => `${policy.id}:${policy.title}`).join(" | ")}`,
  );

  const includeAi = SEED_MODE === "all" || SEED_MODE.includes("ai");
  const includeReported =
    SEED_MODE === "all" || SEED_MODE.includes("reported");
  const includeAppeals =
    SEED_MODE === "all" || SEED_MODE.includes("appeal");

  const ai = includeAi
    ? await seedAiNeedsReview(adminToken, byLanguage, policies)
    : [];
  const reported = includeReported
    ? await seedReported(adminToken, byLanguage, policies)
    : [];
  const appeals = includeAppeals
    ? await seedAppeals(adminToken, byLanguage, policies)
    : [];

  const [pendingCount, flaggedCount, appealsCount] = await Promise.all([
    fetchQueueCount(adminToken, `/admin/comments/pending?content=${encodeURIComponent(SEED_TAG)}`),
    fetchQueueCount(adminToken, `/admin/comments/flagged?content=${encodeURIComponent(SEED_TAG)}`),
    fetchQueueCount(adminToken, `/admin/appeals?q=${encodeURIComponent(SEED_TAG)}`),
  ]);

  console.log("");
  console.log("Seed complete.");
  console.log(
    JSON.stringify(
      {
        seedTag: SEED_TAG,
        created: {
          aiNeedsReview: ai,
          reported,
          appealsPending: appeals,
        },
        queueMatches: {
          pendingCount,
          flaggedCount,
          appealsCount,
        },
      },
      null,
      2,
    ),
  );
}

main().catch((error) => {
  const status = error?.response?.status;
  const body = error?.response?.data;
  console.error("Production moderation seed failed.");
  if (status) {
    console.error(`HTTP ${status}`);
  }
  if (body) {
    console.error(JSON.stringify(body, null, 2));
  } else {
    console.error(error.stack || error.message);
  }
  process.exit(1);
});
