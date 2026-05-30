const UserInteraction = require("../models/UserInteraction");
const Policy = require("../models/Policy");

/**
 * Get a user's keyword profile: a map of topic -> weight
 * Weight = number of times the user interacted with policies having that topic.
 */
const getUserKeywordProfile = async (userId) => {
  const interactions = await UserInteraction.find({ userId }).populate(
    "policyId",
    "topics",
  );
  const profile = {};
  for (const interaction of interactions) {
    const topics = interaction.policyId?.topics || [];
    for (const topic of topics) {
      profile[topic] = (profile[topic] || 0) + 1;
    }
  }
  return profile;
};

module.exports = { getUserKeywordProfile };
