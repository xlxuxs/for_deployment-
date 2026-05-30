const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });
const mongoose = require('mongoose');
const Comment = require('../src/models/Comment');
const Policy = require('../src/models/Policy');

const MONGO_URI = process.env.MONGO_URI || 'mongodb://localhost:27017/communityinsight';

async function run() {
  await mongoose.connect(MONGO_URI, {});
  console.log('Connected to MongoDB');

  // Admin pending: visibility visible AND (sentimentReviewNeeded OR aiStatus pending with lastAnalyzedAt != null)
  const adminPendingFilter = {
    visibility: 'visible',
    $or: [
      { 'reviewFlags.sentimentReviewNeeded': true },
      { aiStatus: 'pending', lastAnalyzedAt: { $ne: null } },
    ],
  };
  const adminPendingCount = await Comment.countDocuments(adminPendingFilter);
  const adminPendingSamples = await Comment.find(adminPendingFilter)
    .limit(5)
    .select('text policyId userId aiStatus reviewFlags lastAnalyzedAt')
    .lean();

  // Comments needing review (same as above, used by /comments/needs-review)
  const reviewFilter = adminPendingFilter;
  const reviewCount = adminPendingCount;

  // Flagged (reported/under_review) and hidden
  const flaggedFilter = { reportState: { $in: ['reported', 'under_review'] }, visibility: 'hidden' };
  const flaggedCount = await Comment.countDocuments(flaggedFilter);
  const flaggedSamples = await Comment.find(flaggedFilter)
    .limit(5)
    .select('text policyId userId reportState reportCount reports')
    .lean();

  // Pending appeals
  const appealsFilter = { 'appeal.status': 'pending' };
  const appealsCount = await Comment.countDocuments(appealsFilter);
  const appealsSamples = await Comment.find(appealsFilter)
    .limit(5)
    .select('text policyId userId appeal')
    .lean();

  console.log('\n=== Admin pending (AI review needed) ===');
  console.log('Count:', adminPendingCount);
  adminPendingSamples.forEach((c, i) => {
    console.log(`- [${i+1}] id=${c._id} aiStatus=${c.aiStatus} reviewFlags=${JSON.stringify(c.reviewFlags)} lastAnalyzedAt=${c.lastAnalyzedAt}`);
    console.log(`  text: ${String(c.text).slice(0,120).replace(/\n/g,' ')}\n`);
  });

  console.log('\n=== Comments needing review (public/planner endpoint) ===');
  console.log('Count:', reviewCount);

  console.log('\n=== Flagged (reported/under_review, hidden) ===');
  console.log('Count:', flaggedCount);
  flaggedSamples.forEach((c, i) => {
    console.log(`- [${i+1}] id=${c._id} reportState=${c.reportState} reportCount=${c.reportCount}`);
    console.log(`  text: ${String(c.text).slice(0,120).replace(/\n/g,' ')}\n`);
  });

  console.log('\n=== Pending appeals ===');
  console.log('Count:', appealsCount);
  appealsSamples.forEach((c, i) => {
    console.log(`- [${i+1}] id=${c._id} appeal=${JSON.stringify(c.appeal).slice(0,200)}`);
    console.log(`  text: ${String(c.text).slice(0,120).replace(/\n/g,' ')}\n`);
  });

  await mongoose.disconnect();
  console.log('Done');
}

run().catch((err) => {
  console.error('Test script error:', err);
  process.exit(1);
});
