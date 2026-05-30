/**
 * @typedef {"planner" | "admin"} Role
 * @typedef {"draft" | "published" | "active" | "paused" | "closed"} PolicyStatus
 *
 * @typedef {Object} Policy
 * @property {string} id
 * @property {string} title
 * @property {string} description
 * @property {string} policyCode
 * @property {PolicyStatus} status
 * @property {string[]} targetRegions
 * @property {string} startDate
 * @property {string} endDate
 * @property {number} averageRating
 * @property {number} totalVotes
 *
 * @typedef {Object} PolicyAnalytics
 * @property {string} policyId
 * @property {string} title
 * @property {number} averageRating
 * @property {Record<string, number>} ratingDistribution
 * @property {Record<string, number>} sentimentCounts
 * @property {{ keyword: string, count: number }[]} topKeywords
 * @property {number} totalVotes
 * @property {number} appVotes
 * @property {number} smsVotes
 *
 * @typedef {Object} PolicyComment
 * @property {string} id
 * @property {string} text
 * @property {"positive" | "negative" | "neutral" | null} sentiment
 * @property {number | null} confidence
 * @property {string[]} keywords
 * @property {string} createdAt
 *
 * @typedef {Object} PlannerUser
 * @property {string} _id
 * @property {string} email
 * @property {boolean} active
 * @property {boolean} verified
 * @property {string} createdAt
 */

export {};
