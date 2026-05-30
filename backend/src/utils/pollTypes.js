const validateBinary = (value) => {
  return value === "yes" || value === "no";
};

const normalizeBinary = (value) => (value === "yes" ? "yes" : "no");

const validateMultipleChoice = (value, options, maxSelections) => {
  if (!Array.isArray(value)) return false;
  if (value.length === 0 || value.length > maxSelections) return false;
  const optionIds = options.map((opt) => opt.id);
  return value.every((v) => optionIds.includes(v));
};

const validateLikert = (value) => {
  return Number.isInteger(value) && value >= 1 && value <= 5;
};

const validateApproval = (value) => {
  return ["approve", "reject", "abstain"].includes(value);
};

const validateRating = (value) => {
  return Number.isInteger(value) && value >= 1 && value <= 5;
};

const validateRankedChoice = (value, options, maxRank) => {
  if (!Array.isArray(value)) return false;
  if (value.length < 1 || value.length > maxRank) return false;
  const optionIds = options.map((opt) => opt.id);
  const unique = new Set(value);
  if (unique.size !== value.length) return false;
  return value.every((v) => optionIds.includes(v));
};

const validateVoteValue = (pollType, value, policy) => {
  switch (pollType) {
    case "binary":
      return validateBinary(value);
    case "multipleChoice":
      return validateMultipleChoice(
        value,
        policy.pollOptions,
        policy.maxSelections,
      );
    case "likert":
      return validateLikert(value);
    case "approval":
      return validateApproval(value);
    case "rating":
      return validateRating(value);
    case "rankedChoice":
      return validateRankedChoice(
        value,
        policy.pollOptions,
        policy.rankedChoiceMaxRank,
      );
    default:
      return false;
  }
};

const normalizeVoteValue = (pollType, value) => {
  switch (pollType) {
    case "binary":
      return normalizeBinary(value);
    case "multipleChoice":
      return value.slice().sort(); // ensure consistent order
    default:
      return value;
  }
};

module.exports = {
  validateVoteValue,
  normalizeVoteValue,
};
