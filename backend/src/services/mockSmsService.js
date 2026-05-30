const Policy = require("../models/Policy");
const Vote = require("../models/Vote");
const User = require("../models/User");
const SmsSubscription = require("../models/SmsSubscription");
const SmsActivity = require("../models/SmsActivity");
const client = require("../config/redis");
const logger = require("../utils/logger");
const { hashPhone, normalizePhone } = require("../utils/helpers");
const { normalizeVoteValue, validateVoteValue } = require("../utils/pollTypes");

const DEFAULT_SMS_DAILY_VOTE_LIMIT = 3;
const RATE_LIMIT = (() => {
  const v = Number.parseInt(process.env.SMS_DAILY_VOTE_LIMIT, 10);
  return Number.isFinite(v) ? v : DEFAULT_SMS_DAILY_VOTE_LIMIT;
})();

const RATE_WINDOW = (() => {
  const v = Number.parseInt(process.env.SMS_RATE_WINDOW_SECONDS, 10);
  return Number.isFinite(v) ? v : 24 * 60 * 60;
})();
const PAGE_SIZE = 5;
const SESSION_TTL = 24 * 60 * 60;

const COMMANDS = {
  SUBSCRIBE: "SUBSCRIBE",
  UNSUBSCRIBE: "UNSUBSCRIBE",
  HELP: "HELP",
  POLICIES: "POLICIES",
  POLICY_SELECT: "POLICY_SELECT",
  VOTE: "VOTE",
  MYVOTES: "MYVOTES",
  POLICY_CLOSED: "POLICY_CLOSED",
  UNKNOWN: "UNKNOWN",
};

const SMS_COPY = {
  en: {
    serviceName: "Civic SMS",
    missingFields: "Phone and message are required.",
    alreadySubscribed: "You are already subscribed.",
    subscribed:
      "Welcome to Civic SMS.\nLanguage and region saved.\nSend POLICIES to browse active policies.",
    notSubscribed:
      "You are not subscribed.\nSend SUBSCRIBE to start.",
    notCurrentlySubscribed: "You are not currently subscribed.",
    unsubscribed:
      "You have unsubscribed.\nSend SUBSCRIBE anytime to rejoin.",
    help:
      "Commands:\nSUBSCRIBE\nPOLICIES\nMYVOTES\nSTOP\n\nAfter POLICIES:\n1-5 = open a policy\n6 = more policies",
    noPolicies: "No active policies found for your region right now.",
    policyListTitle: "ACTIVE POLICIES",
    replyWithNumber: "Reply with 1-5 to open a policy.",
    morePolicies: "Reply 6 for more policies.",
    noMorePolicies: "No more policies.\nSending the first page again.",
    selectedPolicyTitle: "POLICY DETAILS",
    votePrompt: "Reply now with your vote only.",
    invalidSelection: "Invalid selection.\nReply with 1-5 to open a policy or 6 for more.",
    policyNotFound: "Policy not found or not active.",
    policyRegionBlocked: "This policy is not available for your selected region.",
    appUserBlocked: "This phone is linked to an app account.\nPlease vote in the app.",
    alreadyVoted: "You already voted on this policy by SMS.",
    rateLimit: "Daily SMS vote limit reached.\nTry again in {hours} hour(s).",
    invalidVote: "Invalid vote.\n{format}",
    voteSaved: "VOTE RECORDED",
    currentSummary: "Current summary",
    votesLeft: "{remaining} vote(s) left today.",
    myVotesTitle: "YOUR SMS VOTES",
    noVotes: "You have not voted on any policies yet.",
    unknown: "Unknown message.\nSend POLICIES to browse or HELP for commands.",
    allRegions: "All regions",
    policyCode: "Code",
    policyType: "Type",
    regions: "Regions",
    options: "Options",
    howToVote: "How to vote",
    page: "Page",
    yes: "Yes",
    no: "No",
    approve: "Approve",
    reject: "Reject",
    abstain: "Abstain",
    binary: "Binary",
    multipleChoice: "Multiple choice",
    rating: "Rating",
    likert: "Likert",
    approval: "Approval",
    rankedChoice: "Ranked choice",
    statusActive: "Active",
    openPolicy: "Open policy",
  },
  am: {
    serviceName: "ሲቪክ ኤስኤምኤስ",
    missingFields: "ስልክ እና መልዕክት ያስፈልጋሉ።",
    alreadySubscribed: "አስቀድሞ ተመዝግበዋል።",
    subscribed:
      "እንኳን ወደ ሲቪክ ኤስኤምኤስ በደህና መጡ።\nቋንቋ እና ክልል ተቀምጠዋል።\nንቁ ፖሊሲዎችን ለማየት POLICIES ይላኩ።",
    notSubscribed: "አልተመዘገቡም።\nለመጀመር SUBSCRIBE ይላኩ።",
    notCurrentlySubscribed: "በአሁኑ ጊዜ አልተመዘገቡም።",
    unsubscribed: "ምዝገባዎ ተሰርዟል።\nለመመለስ SUBSCRIBE ይላኩ።",
    help:
      "ትእዛዞች:\nSUBSCRIBE\nPOLICIES\nMYVOTES\nSTOP\n\nከPOLICIES በኋላ:\n1-5 = ፖሊሲ ክፈት\n6 = ተጨማሪ ፖሊሲዎች",
    noPolicies: "ለክልልዎ በአሁኑ ጊዜ ንቁ ፖሊሲዎች የሉም።",
    policyListTitle: "ንቁ ፖሊሲዎች",
    replyWithNumber: "ፖሊሲ ለመክፈት 1-5 ይመልሱ።",
    morePolicies: "ተጨማሪ ፖሊሲዎችን ለማየት 6 ይመልሱ።",
    noMorePolicies: "ተጨማሪ ፖሊሲዎች የሉም።\nየመጀመሪያው ገጽ እንደገና ይላካል።",
    selectedPolicyTitle: "የፖሊሲ ዝርዝር",
    votePrompt: "አሁን ድምጽዎን ብቻ ይመልሱ።",
    invalidSelection: "የተሳሳተ ምርጫ።\n1-5 ወይም 6 ይላኩ።",
    policyNotFound: "ፖሊሲው አልተገኘም ወይም ንቁ አይደለም።",
    policyRegionBlocked: "ይህ ፖሊሲ ለተመረጠው ክልል አይገኝም።",
    appUserBlocked: "ይህ ስልክ ከመተግበሪያ መለያ ጋር ተያይዟል።\nእባክዎ በመተግበሪያው ድምጽ ይስጡ።",
    alreadyVoted: "በዚህ ፖሊሲ ላይ በኤስኤምኤስ አስቀድሞ ድምጽ ሰጥተዋል።",
    rateLimit: "የቀን የኤስኤምኤስ ድምጽ ገደብ ደርሷል።\nከ{hours} ሰዓት በኋላ ይሞክሩ።",
    invalidVote: "የተሳሳተ ድምጽ።\n{format}",
    voteSaved: "ድምጹ ተመዝግቧል",
    currentSummary: "የአሁኑ ማጠቃለያ",
    votesLeft: "ዛሬ {remaining} የቀሩ ድምጾች አሉ።",
    myVotesTitle: "የእርስዎ የኤስኤምኤስ ድምጾች",
    noVotes: "እስካሁን በምንም ፖሊሲ ላይ ድምጽ አልሰጡም።",
    unknown: "ያልታወቀ መልዕክት።\nPOLICIES ወይም HELP ይላኩ።",
    allRegions: "ሁሉም ክልሎች",
    policyCode: "ኮድ",
    policyType: "አይነት",
    regions: "ክልሎች",
    options: "ምርጫዎች",
    howToVote: "የድምጽ አሰጣጥ መንገድ",
    page: "ገጽ",
    yes: "አዎ",
    no: "አይ",
    approve: "አጽድቅ",
    reject: "ውድቅ",
    abstain: "ተቆጠብ",
    binary: "ሁለት-ምርጫ",
    multipleChoice: "ብዙ ምርጫ",
    rating: "ደረጃ አሰጣጥ",
    likert: "ሊከርት",
    approval: "ማጽደቅ",
    rankedChoice: "ተደርድሮ ምርጫ",
    statusActive: "ንቁ",
    openPolicy: "ፖሊሲ ክፈት",
  },
  om: {
    serviceName: "SMS Lammiilee",
    missingFields: "Lakkoofsi bilbilaa fi ergaan barbaachisu.",
    alreadySubscribed: "Dursee galmoofteetta.",
    subscribed:
      "Baga gara SMS Lammiileetti dhuftan.\nAfaanii fi naannoon kee kuufamaniiru.\nImaammata jiran arguuf POLICIES ergi.",
    notSubscribed: "Hin galmoofne.\nJalqabuuf SUBSCRIBE ergi.",
    notCurrentlySubscribed: "Amma galmaa'ee hin jirtu.",
    unsubscribed: "Galmeen kee haqameera.\nDebi'uuf SUBSCRIBE ergi.",
    help:
      "Ajajoota:\nSUBSCRIBE\nPOLICIES\nMYVOTES\nSTOP\n\nPOLICIES booda:\n1-5 = imaammata bani\n6 = imaammata dabalataa",
    noPolicies: "Naannoo kee keessatti amma imaammanni hojii irra jiru hin jiru.",
    policyListTitle: "IMAAMMATA JIRAN",
    replyWithNumber: "Imaammata banuuf 1-5 deebisi.",
    morePolicies: "Imaammata dabalataaf 6 deebisi.",
    noMorePolicies: "Imaammata dabalataa hin jiru.\nFuulli jalqabaa irra deebi'ee ni ergama.",
    selectedPolicyTitle: "BAL'INA IMAAMMATAA",
    votePrompt: "Amma sagalee kee qofa deebisi.",
    invalidSelection: "Filannoon sirrii miti.\n1-5 yookaan 6 deebisi.",
    policyNotFound: "Imaammanni hin argamne yookaan hojii irra hin jiru.",
    policyRegionBlocked: "Imaammatni kun naannoo filatameef hin banamne.",
    appUserBlocked: "Bilbilli kun app waliin walqabata.\nMee app keessatti sagalee kenni.",
    alreadyVoted: "Imaammata kana irratti dursee karaa SMS sagalee kenniteetta.",
    rateLimit: "Daangaan sagalee SMS guyyaa guutameera.\nSa'aatii {hours} booda yaali.",
    invalidVote: "Sagaleen sirrii miti.\n{format}",
    voteSaved: "SAGALEEN KEE GALMEEFFAMEERA",
    currentSummary: "Cuunfaa amma jiru",
    votesLeft: "Har'a sagalee {remaining} hafeera.",
    myVotesTitle: "SAGALEE SMS KEE",
    noVotes: "Ammaaf imaammata tokko irrattiyyuu sagalee hin kennine.",
    unknown: "Ergaan hin beekamne.\nPOLICIES yookaan HELP ergi.",
    allRegions: "Naannolee hunda",
    policyCode: "Koodii",
    policyType: "Gosa",
    regions: "Naannolee",
    options: "Filannoowwan",
    howToVote: "Akkaataa sagalee itti kennitu",
    page: "Fuula",
    yes: "Eeyyee",
    no: "Lakki",
    approve: "Mirkaneessi",
    reject: "Didi",
    abstain: "Of qusadhu",
    binary: "Lama keessaa tokko",
    multipleChoice: "Filannoo baay'ee",
    rating: "Sadarkaa",
    likert: "Likert",
    approval: "Mirkaneessaa",
    rankedChoice: "Filannoo tartiibaan",
    statusActive: "Hojii irra",
    openPolicy: "Imaammata bani",
  },
  ti: {
    serviceName: "Civic SMS",
    missingFields: "ቁጽሪ ስልኪን መልእኽትን የድሊ።",
    alreadySubscribed: "ድሮ ተመዝጊብካ ኣለኻ።",
    subscribed:
      "እንቋዕ ናብ Civic SMS ብደሓን መጻእካ።\nቋንቋን ክልልን ተዓቂቦም ኣለዉ።\nንንጡፍ ፖሊሲታት POLICIES ለኣኽ።",
    notSubscribed: "ኣይተመዝገብካን።\nንምጅማር SUBSCRIBE ለኣኽ።",
    notCurrentlySubscribed: "ሕጂ ኣይተመዝገብካን።",
    unsubscribed: "ምዝገባኻ ተሰሪዙ።\nንምምላስ SUBSCRIBE ለኣኽ።",
    help:
      "ትእዛዛት:\nSUBSCRIBE\nPOLICIES\nMYVOTES\nSTOP\n\nድሕሪ POLICIES:\n1-5 = ፖሊሲ ክፈት\n6 = ተወሳኺ ፖሊሲታት",
    noPolicies: "ኣብ ክልልካ ሕጂ ንጡፍ ፖሊሲታት የለዉን።",
    policyListTitle: "ንጡፍ ፖሊሲታት",
    replyWithNumber: "ፖሊሲ ንምኽፋት 1-5 መልስ።",
    morePolicies: "ተወሳኺ ፖሊሲታት ንምርኣይ 6 መልስ።",
    noMorePolicies: "ተወሳኺ ፖሊሲታት የለዉን።\nቀዳማይ ገጽ እንደገና ክልኣኽ እዩ።",
    selectedPolicyTitle: "ዝርዝር ፖሊሲ",
    votePrompt: "ሕጂ ድምጽኻ ጥራይ መልስ።",
    invalidSelection: "ጌጋ ምርጫ።\n1-5 ወይ 6 መልስ።",
    policyNotFound: "ፖሊሲ ኣይተረኽበን ወይ ንጡፍ ኣይኮነን።",
    policyRegionBlocked: "እዚ ፖሊሲ ንዝተመርጸ ክልል ኣይክፈትን።",
    appUserBlocked: "እዚ ስልኪ ምስ app ተኣሳሲሩ ኣሎ።\nበጃኻ ኣብ app ድምጺ ሃብ።",
    alreadyVoted: "በዚ ፖሊሲ ብSMS ድሮ ድምጺ ሂብካ ኢኻ።",
    rateLimit: "መዓልታዊ ገደብ ድምጺ SMS ተመሊኡ።\nድሕሪ {hours} ሰዓት ፈትን።",
    invalidVote: "ጌጋ ድምጺ።\n{format}",
    voteSaved: "ድምጽኻ ተመዝጊቡ",
    currentSummary: "እዋናዊ ማጠቓለያ",
    votesLeft: "ሎሚ {remaining} ድምጽታት ተሪፎም ኣለዉ።",
    myVotesTitle: "ድምጽታት SMS ናትካ",
    noVotes: "ክሳብ ሕጂ ኣብ ሓደ ፖሊሲ እኳ ድምጺ ኣይሃብካን።",
    unknown: "ዘይተፈልጠ መልእኽቲ።\nPOLICIES ወይ HELP ለኣኽ።",
    allRegions: "ኩሎም ክልላት",
    policyCode: "ኮድ",
    policyType: "ዓይነት",
    regions: "ክልላት",
    options: "ምርጫታት",
    howToVote: "ኣካይዳ ድምጺ",
    page: "ገጽ",
    yes: "እወ",
    no: "ኣይፋል",
    approve: "ኣጽድቕ",
    reject: "ንጸግ",
    abstain: "ተቖጠብ",
    binary: "ክልተ ምርጫ",
    multipleChoice: "ብዙሕ ምርጫ",
    rating: "ደረጃ",
    likert: "Likert",
    approval: "ምጽዳቕ",
    rankedChoice: "ተርታ ዘለዎ ምርጫ",
    statusActive: "ንጡፍ",
    openPolicy: "ፖሊሲ ክፈት",
  },
};

function t(locale, key, vars = {}) {
  const dictionary = SMS_COPY[locale] || SMS_COPY.en;
  let text = dictionary[key] || SMS_COPY.en[key] || key;
  Object.entries(vars).forEach(([name, value]) => {
    text = text.replaceAll(`{${name}}`, String(value));
  });
  return text;
}

function getPhoneLast4(normalizedPhone) {
  return String(normalizedPhone || "").slice(-4);
}

function textResponse({
  reply,
  statusCode = 200,
  command = COMMANDS.UNKNOWN,
  success = statusCode < 400,
  policy = null,
  metadata = {},
}) {
  return {
    reply,
    statusCode,
    command,
    success,
    policyId: policy?._id || null,
    metadata,
  };
}

function getOptionIndexMap(policy) {
  const map = new Map();
  (policy.pollOptions || []).forEach((option, index) => {
    map.set(index + 1, option);
  });
  return map;
}

function getPolicyTypeLabel(locale, pollType) {
  return t(locale, pollType);
}

function formatChoiceLines(locale, policy) {
  switch (policy.pollType) {
    case "binary":
      return `1. ${t(locale, "yes")}\n2. ${t(locale, "no")}`;
    case "approval":
      return `1. ${t(locale, "approve")}\n2. ${t(locale, "reject")}\n3. ${t(locale, "abstain")}`;
    default:
      return (policy.pollOptions || [])
        .map((option, index) => `${index + 1}. ${option.text}`)
        .join("\n");
  }
}

function getVoteFormatHint(locale, policy) {
  switch (policy.pollType) {
    case "binary":
      return `1 = ${t(locale, "yes")}, 2 = ${t(locale, "no")}`;
    case "multipleChoice":
      return policy.maxSelections > 1
        ? `1,3 (${policy.maxSelections} max)`
        : "2";
    case "rating":
    case "likert":
      return "1-5";
    case "approval":
      return `1 = ${t(locale, "approve")}, 2 = ${t(locale, "reject")}, 3 = ${t(locale, "abstain")}`;
    case "rankedChoice":
      return "3>1>2";
    default:
      return "1";
  }
}

function formatPolicyCard(locale, policy, pageIndex = null) {
  const sections = [
    `1. ${t(locale, "selectedPolicyTitle")}`,
    pageIndex !== null ? `2. ${t(locale, "openPolicy")} ${pageIndex}` : null,
    `3. ${policy.title}`,
    `4. ${t(locale, "policyCode")}: ${policy.policyCode}`,
    `5. ${t(locale, "policyType")}: ${getPolicyTypeLabel(locale, policy.pollType)}`,
    `6. ${t(locale, "regions")}: ${(policy.targetRegions || []).join(", ") || t(locale, "allRegions")}`,
  ].filter(Boolean);

  const optionLines = formatChoiceLines(locale, policy);
  if (optionLines) {
    sections.push(`7. ${t(locale, "options")}:\n${optionLines}`);
    sections.push(`8. ${t(locale, "howToVote")}: ${getVoteFormatHint(locale, policy)}`);
    sections.push(`9. ${t(locale, "votePrompt")}`);
  } else {
    sections.push(`7. ${t(locale, "howToVote")}: ${getVoteFormatHint(locale, policy)}`);
    sections.push(`8. ${t(locale, "votePrompt")}`);
  }

  return sections.join("\n");
}

function parseNumberList(rawValue, separator = ",") {
  return rawValue
    .split(separator)
    .map((part) => Number.parseInt(part.trim(), 10))
    .filter((value) => Number.isInteger(value));
}

function parseSmsVoteValue(policy, payload, locale) {
  const trimmed = String(payload || "").trim();
  const optionMap = getOptionIndexMap(policy);

  switch (policy.pollType) {
    case "binary":
      if (trimmed === "1") return { ok: true, value: "yes" };
      if (trimmed === "2") return { ok: true, value: "no" };
      break;
    case "multipleChoice": {
      const numbers = parseNumberList(trimmed);
      if (!numbers.length) break;
      if (new Set(numbers).size !== numbers.length) break;
      if (numbers.length > (policy.maxSelections || 1)) break;
      const optionIds = numbers.map((number) => optionMap.get(number)?.id).filter(Boolean);
      if (optionIds.length !== numbers.length) break;
      return { ok: true, value: optionIds };
    }
    case "likert":
    case "rating": {
      const numeric = Number.parseInt(trimmed, 10);
      if (Number.isInteger(numeric) && numeric >= 1 && numeric <= 5) {
        return { ok: true, value: numeric };
      }
      break;
    }
    case "approval":
      if (trimmed === "1") return { ok: true, value: "approve" };
      if (trimmed === "2") return { ok: true, value: "reject" };
      if (trimmed === "3") return { ok: true, value: "abstain" };
      break;
    case "rankedChoice": {
      const numbers = parseNumberList(trimmed, ">");
      if (!numbers.length) break;
      if (new Set(numbers).size !== numbers.length) break;
      if (numbers.length > (policy.rankedChoiceMaxRank || 1)) break;
      const optionIds = numbers.map((number) => optionMap.get(number)?.id).filter(Boolean);
      if (optionIds.length !== numbers.length) break;
      return { ok: true, value: optionIds };
    }
    default:
      break;
  }

  return {
    ok: false,
    error: t(locale, "invalidVote", { format: getVoteFormatHint(locale, policy) }),
  };
}

function formatPercentage(count, total) {
  if (!total) return "0.0";
  return ((count / total) * 100).toFixed(1);
}

async function getPolicyVoteSummary(policy) {
  const votes = await Vote.find({ policyId: policy._id }).lean();
  const totalVotes = votes.length;

  switch (policy.pollType) {
    case "binary": {
      const yesCount = votes.filter((vote) => vote.value === "yes").length;
      const noCount = totalVotes - yesCount;
      return [
        `Yes: ${yesCount} (${formatPercentage(yesCount, totalVotes)}%)`,
        `No: ${noCount} (${formatPercentage(noCount, totalVotes)}%)`,
      ].join("\n");
    }
    case "multipleChoice": {
      const counts = Object.fromEntries((policy.pollOptions || []).map((option) => [option.id, 0]));
      votes.forEach((vote) => {
        if (Array.isArray(vote.value)) {
          vote.value.forEach((optionId) => {
            if (counts[optionId] !== undefined) counts[optionId] += 1;
          });
        }
      });
      return (policy.pollOptions || [])
        .map((option, index) => {
          const count = counts[option.id] || 0;
          return `${index + 1}. ${option.text}: ${count} (${formatPercentage(count, totalVotes)}%)`;
        })
        .join("\n");
    }
    case "likert":
    case "rating": {
      const numericVotes = votes.map((vote) => Number(vote.value)).filter((value) => Number.isFinite(value));
      const sum = numericVotes.reduce((acc, value) => acc + value, 0);
      const average = totalVotes ? (sum / totalVotes).toFixed(2) : "0.00";
      const distribution = [1, 2, 3, 4, 5]
        .map((value) => {
          const count = numericVotes.filter((item) => item === value).length;
          return `${value}: ${count}`;
        })
        .join("\n");
      return `Average: ${average}\n${distribution}`;
    }
    case "approval": {
      const approveCount = votes.filter((vote) => vote.value === "approve").length;
      const rejectCount = votes.filter((vote) => vote.value === "reject").length;
      const abstainCount = votes.filter((vote) => vote.value === "abstain").length;
      return [
        `Approve: ${approveCount} (${formatPercentage(approveCount, totalVotes)}%)`,
        `Reject: ${rejectCount} (${formatPercentage(rejectCount, totalVotes)}%)`,
        `Abstain: ${abstainCount} (${formatPercentage(abstainCount, totalVotes)}%)`,
      ].join("\n");
    }
    case "rankedChoice": {
      const counts = Object.fromEntries((policy.pollOptions || []).map((option) => [option.id, 0]));
      votes.forEach((vote) => {
        if (Array.isArray(vote.value) && vote.value.length) {
          const firstChoice = vote.value[0];
          if (counts[firstChoice] !== undefined) counts[firstChoice] += 1;
        }
      });
      return (policy.pollOptions || [])
        .map((option, index) => {
          const count = counts[option.id] || 0;
          return `${index + 1}. ${option.text}: ${count} first-choice vote(s)`;
        })
        .join("\n");
    }
    default:
      return `Total votes: ${totalVotes}`;
  }
}

async function recordSmsActivity({
  phoneHash,
  phoneLast4,
  direction,
  command,
  inboundMessage = "",
  replyMessage = "",
  success = true,
  statusCode = 200,
  policyId = null,
  metadata = {},
}) {
  try {
    await SmsActivity.create({
      phoneHash,
      phoneLast4,
      direction,
      command,
      inboundMessage,
      replyMessage,
      success,
      statusCode,
      policyId,
      metadata,
    });
  } catch (error) {
    logger.error({ error: error.message }, "SMS activity record error");
  }
}

async function findSubscriptionState(phoneHash) {
  const subscription = await SmsSubscription.findOne({ phoneHash }).lean();
  return {
    subscribed: Boolean(subscription?.subscribed),
    preferredLanguage: subscription?.preferredLanguage || "en",
    region: subscription?.region || "",
    subscribedAt: subscription?.subscribedAt || null,
    unsubscribedAt: subscription?.unsubscribedAt || null,
  };
}

function stateKey(phoneHash) {
  return `sms:session:${phoneHash}`;
}

async function getConversationState(phoneHash) {
  const raw = await client.get(stateKey(phoneHash));
  if (!raw) return null;
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

async function setConversationState(phoneHash, state) {
  await client.setEx(stateKey(phoneHash), SESSION_TTL, JSON.stringify(state));
}

async function clearConversationState(phoneHash) {
  await client.del(stateKey(phoneHash));
}

async function createPolicyPageState(subscription, phoneHash, page = 0) {
  const now = new Date();
  const filter = {
    status: "active",
    startDate: { $lte: now },
    endDate: { $gte: now },
  };
  if (subscription?.region) {
    filter.targetRegions = subscription.region;
  }

  const policies = await Policy.find(filter)
    .select("title policyCode pollType targetRegions pollOptions maxSelections rankedChoiceMaxRank")
    .sort({ startDate: 1, createdAt: -1 });

  if (!policies.length) {
    return { policies: [], page: 0, totalPages: 0 };
  }

  const totalPages = Math.max(1, Math.ceil(policies.length / PAGE_SIZE));
  const safePage = page >= totalPages ? 0 : page;
  const slice = policies.slice(safePage * PAGE_SIZE, safePage * PAGE_SIZE + PAGE_SIZE);

  await setConversationState(phoneHash, {
    mode: "policy_list",
    page: safePage,
    totalPages,
    policyIds: slice.map((policy) => policy._id.toString()),
  });

  return { policies: slice, page: safePage, totalPages };
}

function formatPolicyList(locale, policies, page, totalPages) {
  const lines = [
    `1. ${t(locale, "policyListTitle")}`,
    `2. ${t(locale, "page")} ${page + 1}/${totalPages}`,
    "",
    ...policies.map((policy, index) => {
      const regions = (policy.targetRegions || []).join(", ") || t(locale, "allRegions");
      return `${index + 1}. ${policy.title}\n   ${t(locale, "policyType")}: ${getPolicyTypeLabel(locale, policy.pollType)}\n   ${t(locale, "regions")}: ${regions}`;
    }),
    "",
    `1. ${t(locale, "replyWithNumber")}`,
    `2. ${t(locale, "morePolicies")}`,
  ];

  return lines.join("\n");
}

async function openSelectedPolicy({ locale, phoneHash, state, selection }) {
  const policyId = state?.policyIds?.[selection - 1];
  if (!policyId) return null;

  const policy = await Policy.findById(policyId).select(
    "title policyCode pollType targetRegions pollOptions maxSelections rankedChoiceMaxRank status",
  );
  if (!policy || policy.status !== "active") return null;

  await setConversationState(phoneHash, {
    mode: "policy_selected",
    selectedPolicyId: policy._id.toString(),
    fromPage: state.page || 0,
  });

  return policy;
}

async function submitVote({ locale, phoneHash, subscription, policy, payload }) {
  const existingUser = await User.findOne({ phoneHash, verified: true });
  if (existingUser) {
    return textResponse({
      reply: t(locale, "appUserBlocked"),
      statusCode: 403,
      success: false,
      command: COMMANDS.VOTE,
      policy,
    });
  }

  const existingVote = await Vote.findOne({ policyId: policy._id, phoneHash });
  if (existingVote) {
    return textResponse({
      reply: t(locale, "alreadyVoted"),
      statusCode: 409,
      success: false,
      command: COMMANDS.VOTE,
      policy,
    });
  }

  const rateKey = `rate:sms:${phoneHash}:${new Date().toISOString().split("T")[0]}`;
  const current = await client.incr(rateKey);
  if (current === 1) await client.expire(rateKey, RATE_WINDOW);
  if (current > RATE_LIMIT) {
    const ttl = await client.ttl(rateKey);
    const hours = Math.ceil(ttl / 3600);
    return textResponse({
      reply: t(locale, "rateLimit", { hours }),
      statusCode: 429,
      success: false,
      command: COMMANDS.VOTE,
      policy,
    });
  }

  const parsed = parseSmsVoteValue(policy, payload, locale);
  if (!parsed.ok) {
    return textResponse({
      reply: parsed.error,
      statusCode: 400,
      success: false,
      command: COMMANDS.VOTE,
      policy,
    });
  }

  const normalizedValue = normalizeVoteValue(policy.pollType, parsed.value);
  if (!validateVoteValue(policy.pollType, normalizedValue, policy)) {
    return textResponse({
      reply: t(locale, "invalidVote", { format: getVoteFormatHint(locale, policy) }),
      statusCode: 400,
      success: false,
      command: COMMANDS.VOTE,
      policy,
    });
  }

  await Vote.create({
    policyId: policy._id,
    phoneHash,
    channel: "sms",
    value: normalizedValue,
    region: subscription?.region || null,
  });

  await clearConversationState(phoneHash);

  const summary = await getPolicyVoteSummary(policy);
  const remaining = RATE_LIMIT - current;
  return textResponse({
    reply: [
      t(locale, "voteSaved"),
      `${policy.title}`,
      "",
      `${t(locale, "currentSummary")}:`,
      summary,
      "",
      t(locale, "votesLeft", { remaining }),
    ].join("\n"),
    command: COMMANDS.VOTE,
    policy,
    metadata: { value: normalizedValue, remaining },
  });
}

async function processInboundSms({
  phone,
  message,
  preferredLanguage = "",
  region = "",
}) {
  if (!phone || !message) {
    return {
      normalizedPhone: null,
      phoneHash: null,
      phoneLast4: "",
      ...textResponse({
        reply: t("en", "missingFields"),
        statusCode: 400,
      }),
    };
  }

  const trimmed = String(message).trim();
  const upper = trimmed.toUpperCase();
  const normalizedPhone = normalizePhone(phone);
  const phoneHash = hashPhone(normalizedPhone);
  const phoneLast4 = getPhoneLast4(normalizedPhone);

  let subscription = await SmsSubscription.findOne({ phoneHash });
  const normalizedLanguage = ["en", "am", "om", "ti"].includes(preferredLanguage)
    ? preferredLanguage
    : "";
  const normalizedRegion = String(region || "").trim();

  const getLocale = () => {
    return (
      normalizedLanguage ||
      subscription?.preferredLanguage ||
      "en"
    );
  };

  const syncSubscriptionPreferences = async () => {
    if (!subscription) return;
    let changed = false;
    if (normalizedLanguage && subscription.preferredLanguage !== normalizedLanguage) {
      subscription.preferredLanguage = normalizedLanguage;
      changed = true;
    }
    if (normalizedRegion && subscription.region !== normalizedRegion) {
      subscription.region = normalizedRegion;
      changed = true;
    }
    if (changed) {
      await subscription.save();
    }
  };

  const enrich = (result) => ({
    normalizedPhone,
    phoneHash,
    phoneLast4,
    subscription: {
      subscribed: Boolean(subscription?.subscribed),
      preferredLanguage: subscription?.preferredLanguage || normalizedLanguage || "en",
      region: subscription?.region || normalizedRegion || "",
      subscribedAt: subscription?.subscribedAt || null,
      unsubscribedAt: subscription?.unsubscribedAt || null,
    },
    ...result,
  });

  if (upper === "SUBSCRIBE") {
    if (!subscription) {
      subscription = await SmsSubscription.create({
        phoneHash,
        subscribed: true,
        preferredLanguage: normalizedLanguage || "en",
        region: normalizedRegion,
      });
    } else if (!subscription.subscribed) {
      subscription.subscribed = true;
      subscription.unsubscribedAt = null;
      subscription.subscribedAt = new Date();
      if (normalizedLanguage) subscription.preferredLanguage = normalizedLanguage;
      if (normalizedRegion) subscription.region = normalizedRegion;
      await subscription.save();
    } else {
      await syncSubscriptionPreferences();
      return enrich(
        textResponse({
          reply: t(getLocale(), "alreadySubscribed"),
          command: COMMANDS.SUBSCRIBE,
        }),
      );
    }

    return enrich(
      textResponse({
        reply: t(getLocale(), "subscribed"),
        command: COMMANDS.SUBSCRIBE,
        metadata: { state: "subscribed" },
      }),
    );
  }

  if (upper === "STOP" || upper === "UNSUBSCRIBE") {
    if (!subscription || !subscription.subscribed) {
      return enrich(
        textResponse({
          reply: t(getLocale(), "notCurrentlySubscribed"),
          command: COMMANDS.UNSUBSCRIBE,
        }),
      );
    }

    subscription.subscribed = false;
    subscription.unsubscribedAt = new Date();
    await subscription.save();
    await clearConversationState(phoneHash);

    return enrich(
      textResponse({
        reply: t(getLocale(), "unsubscribed"),
        command: COMMANDS.UNSUBSCRIBE,
        metadata: { state: "unsubscribed" },
      }),
    );
  }

  if (!subscription?.subscribed) {
    return enrich(
      textResponse({
        reply: t(getLocale(), "notSubscribed"),
        statusCode: 403,
        success: false,
        command: COMMANDS.UNKNOWN,
      }),
    );
  }

  await syncSubscriptionPreferences();
  const locale = getLocale();
  const state = await getConversationState(phoneHash);

  if (upper === "HELP") {
    return enrich(
      textResponse({
        reply: t(locale, "help"),
        command: COMMANDS.HELP,
      }),
    );
  }

  if (upper === "POLICIES") {
    const pageResult = await createPolicyPageState(subscription, phoneHash, 0);
    if (!pageResult.policies.length) {
      return enrich(
        textResponse({
          reply: t(locale, "noPolicies"),
          command: COMMANDS.POLICIES,
        }),
      );
    }

    return enrich(
      textResponse({
        reply: formatPolicyList(locale, pageResult.policies, pageResult.page, pageResult.totalPages),
        command: COMMANDS.POLICIES,
        metadata: { count: pageResult.policies.length, page: pageResult.page + 1 },
      }),
    );
  }

  if (upper === "MYVOTES") {
    const votes = await Vote.find({ phoneHash, channel: "sms" })
      .populate("policyId", "title policyCode status")
      .sort({ createdAt: -1 });

    if (!votes.length) {
      return enrich(
        textResponse({
          reply: t(locale, "noVotes"),
          command: COMMANDS.MYVOTES,
        }),
      );
    }

    const lines = votes
      .map((vote, index) => {
        if (!vote.policyId) return null;
        const value = Array.isArray(vote.value) ? vote.value.join(", ") : vote.value;
        return `${index + 1}. ${vote.policyId.title}\n   ${t(locale, "policyCode")}: ${vote.policyId.policyCode}\n   Vote: ${value}`;
      })
      .filter(Boolean);

    return enrich(
      textResponse({
        reply: `${t(locale, "myVotesTitle")}\n\n${lines.join("\n\n")}`,
        command: COMMANDS.MYVOTES,
        metadata: { count: lines.length },
      }),
    );
  }

  if (state?.mode === "policy_list" && /^[1-6]$/.test(trimmed)) {
    const selection = Number(trimmed);
    if (selection === 6) {
      const nextPage = state.page + 1 >= state.totalPages ? 0 : state.page + 1;
      const pageResult = await createPolicyPageState(subscription, phoneHash, nextPage);
      const note = nextPage === 0 && state.page + 1 >= state.totalPages
        ? `${t(locale, "noMorePolicies")}\n\n`
        : "";

      return enrich(
        textResponse({
          reply:
            note +
            formatPolicyList(locale, pageResult.policies, pageResult.page, pageResult.totalPages),
          command: COMMANDS.POLICIES,
          metadata: { count: pageResult.policies.length, page: pageResult.page + 1 },
        }),
      );
    }

    const policy = await openSelectedPolicy({
      locale,
      phoneHash,
      state,
      selection,
    });

    if (!policy) {
      return enrich(
        textResponse({
          reply: t(locale, "invalidSelection"),
          statusCode: 400,
          success: false,
          command: COMMANDS.POLICY_SELECT,
        }),
      );
    }

    return enrich(
      textResponse({
        reply: formatPolicyCard(locale, policy, selection),
        command: COMMANDS.POLICY_SELECT,
        policy,
      }),
    );
  }

  if (state?.mode === "policy_selected") {
    const policy = await Policy.findById(state.selectedPolicyId).select(
      "title policyCode pollType targetRegions pollOptions maxSelections rankedChoiceMaxRank status",
    );

    if (!policy || policy.status !== "active") {
      await clearConversationState(phoneHash);
      return enrich(
        textResponse({
          reply: t(locale, "policyNotFound"),
          statusCode: 404,
          success: false,
          command: COMMANDS.VOTE,
        }),
      );
    }

    if (
      subscription?.region &&
      Array.isArray(policy.targetRegions) &&
      policy.targetRegions.length &&
      !policy.targetRegions.includes(subscription.region)
    ) {
      await clearConversationState(phoneHash);
      return enrich(
        textResponse({
          reply: t(locale, "policyRegionBlocked"),
          statusCode: 403,
          success: false,
          command: COMMANDS.VOTE,
          policy,
        }),
      );
    }

    const voteResult = await submitVote({
      locale,
      phoneHash,
      subscription,
      policy,
      payload: trimmed,
    });
    return enrich(voteResult);
  }

  const voteMatch = upper.match(/^VOTE\s+(\S+)\s+(.+)$/i);
  if (voteMatch) {
    const policyCode = voteMatch[1];
    const payload = voteMatch[2];
    const policy = await Policy.findOne({ policyCode, status: "active" }).select(
      "title policyCode pollType targetRegions pollOptions maxSelections rankedChoiceMaxRank status",
    );

    if (!policy) {
      return enrich(
        textResponse({
          reply: t(locale, "policyNotFound"),
          statusCode: 404,
          success: false,
          command: COMMANDS.VOTE,
        }),
      );
    }

    if (
      subscription?.region &&
      Array.isArray(policy.targetRegions) &&
      policy.targetRegions.length &&
      !policy.targetRegions.includes(subscription.region)
    ) {
      return enrich(
        textResponse({
          reply: t(locale, "policyRegionBlocked"),
          statusCode: 403,
          success: false,
          command: COMMANDS.VOTE,
          policy,
        }),
      );
    }

    const voteResult = await submitVote({
      locale,
      phoneHash,
      subscription,
      policy,
      payload,
    });
    return enrich(voteResult);
  }

  return enrich(
    textResponse({
      reply: t(locale, "unknown"),
      statusCode: 400,
      success: false,
      command: COMMANDS.UNKNOWN,
    }),
  );
}

async function simulateInboundSms({ phone, message, preferredLanguage, region }) {
  const result = await processInboundSms({
    phone,
    message,
    preferredLanguage,
    region,
  });

  if (result.phoneHash) {
    await recordSmsActivity({
      phoneHash: result.phoneHash,
      phoneLast4: result.phoneLast4,
      direction: "inbound",
      command: result.command,
      inboundMessage: String(message || ""),
      replyMessage: result.reply,
      success: result.success,
      statusCode: result.statusCode,
      policyId: result.policyId,
      metadata: result.metadata,
    });
  }

  return result;
}

async function recordOutboundSmsNotification({
  phoneHash,
  message,
  policyId = null,
  metadata = {},
}) {
  await recordSmsActivity({
    phoneHash,
    phoneLast4: "",
    direction: "outbound",
    command: COMMANDS.POLICY_CLOSED,
    inboundMessage: "",
    replyMessage: message,
    success: true,
    statusCode: 200,
    policyId,
    metadata,
  });
}

module.exports = {
  COMMANDS,
  findSubscriptionState,
  getPhoneLast4,
  getPolicyVoteSummary,
  processInboundSms,
  recordOutboundSmsNotification,
  simulateInboundSms,
};
