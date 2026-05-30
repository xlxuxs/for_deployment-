const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });
const mongoose = require('mongoose');

const User = require('../src/models/User');
const Comment = require('../src/models/Comment');

const MONGO_URI = process.env.MONGO_URI || 'mongodb://localhost:27017/communityinsight';

async function modifyAndLog(comment, actorId, actionDesc) {
  console.log(`\n--- ${actionDesc} ---`);
  console.log('Before:', JSON.stringify({
    id: comment._id,
    visibility: comment.visibility,
    sentiment: comment.sentiment,
    reviewFlags: comment.reviewFlags,
    reportState: comment.reportState,
    appeal: comment.appeal ? { status: comment.appeal.status } : null,
  }, null, 2));
}

async function run() {
  await mongoose.connect(MONGO_URI);
  console.log('Connected to MongoDB');

  const admin = await User.findOne({ email: 'admin@example.com' });
  if (!admin) {
    console.error('Admin user not found (admin@example.com)');
    process.exit(1);
  }
  const actorId = admin._id;

  // 1) AI need review: override sentiment
  const aiNeed = await Comment.findOne({ 'reviewFlags.sentimentReviewNeeded': true, visibility: 'visible' });
  if (!aiNeed) console.log('No AI-need-review comment found');
  else {
    await modifyAndLog(aiNeed, actorId, 'AI Need Review - BEFORE override');
    aiNeed.sentiment = { label: 'positive', confidence: 1, overriddenByModerator: true };
    aiNeed.reviewFlags.sentimentReviewNeeded = false;
    aiNeed.events.push({ type: 'moderated', actor: actorId, data: { action: 'override_sentiment', updates: aiNeed.sentiment }, createdAt: new Date() });
    aiNeed.moderationActions.push({ action: 'override_sentiment', reason: 'test_override', actor: actorId, createdAt: new Date() });
    await aiNeed.save();
    console.log('Override applied. After:', JSON.stringify({ id: aiNeed._id, sentiment: aiNeed.sentiment, reviewFlags: aiNeed.reviewFlags }, null, 2));
  }

  // 2) AI need review: delete (soft delete)
  const aiToDelete = await Comment.findOne({ 'reviewFlags.sentimentReviewNeeded': true, visibility: 'visible' });
  if (!aiToDelete) console.log('No AI-need-review comment available to delete');
  else {
    await modifyAndLog(aiToDelete, actorId, 'AI Need Review - BEFORE delete');
    aiToDelete.visibility = 'deleted';
    aiToDelete.events.push({ type: 'deleted', actor: actorId, data: { note: 'admin_deleted_test' }, createdAt: new Date() });
    await aiToDelete.save();
    console.log('Deleted. After visibility:', aiToDelete.visibility);
  }

  // 3) Reported page: approve report (resolve report as invalid and as valid), then delete
  const reported = await Comment.findOne({ reportState: { $in: ['reported','under_review'] } });
  if (!reported) console.log('No reported comment found');
  else {
    await modifyAndLog(reported, actorId, 'Reported - BEFORE resolveReport (invalid)');
    // resolve as invalid
    const report = reported.reports && reported.reports.length ? reported.reports[0] : null;
    if (report) {
      report.status = 'invalid';
      report.resolvedAt = new Date();
      report.resolvedBy = actorId;
      reported.events.push({ type: 'moderated', actor: actorId, data: { action: 'resolve_report', reportId: report._id, resolution: 'invalid' }, createdAt: new Date() });
      await reported.save();
      console.log('Report resolved as invalid. Report status:', report.status);
    }

    // Now delete the comment via soft delete
    await modifyAndLog(reported, actorId, 'Reported - BEFORE delete');
    reported.visibility = 'deleted';
    reported.events.push({ type: 'deleted', actor: actorId, data: { note: 'admin_deleted_after_report' }, createdAt: new Date() });
    await reported.save();
    console.log('Reported comment deleted. visibility:', reported.visibility);
  }

  // 4) Appeals: approve and reject
  const appealComment = await Comment.findOne({ 'appeal.status': 'pending' });
  if (!appealComment) console.log('No pending appeal found');
  else {
    await modifyAndLog(appealComment, actorId, 'Appeal - BEFORE approve');
    // Approve
    appealComment.appeal.status = 'approved';
    appealComment.appeal.resolvedAt = new Date();
    appealComment.appeal.resolvedBy = actorId;
    appealComment.appeal.moderatorNotes = 'approved by test';
    appealComment.visibility = 'visible';
    appealComment.moderationActions.push({ action: 'restore', reason: 'appeal approved (test)', actor: actorId, createdAt: new Date() });
    appealComment.events.push({ type: 'appeal_resolved', actor: actorId, data: { decision: 'approved' }, createdAt: new Date() });
    await appealComment.save();
    console.log('Appeal approved. After:', JSON.stringify({ appeal: appealComment.appeal, visibility: appealComment.visibility }, null, 2));

    // Now pick another pending appeal to reject (or reuse same by creating a test appeal)
    const another = await Comment.findOne({ 'appeal.status': 'pending' });
    if (another) {
      await modifyAndLog(another, actorId, 'Appeal - BEFORE reject');
      another.appeal.status = 'rejected';
      another.appeal.resolvedAt = new Date();
      another.appeal.resolvedBy = actorId;
      another.appeal.moderatorNotes = 'rejected by test';
      another.moderationActions.push({ action: 'reject_appeal', reason: 'test_reject', actor: actorId, createdAt: new Date() });
      another.events.push({ type: 'appeal_resolved', actor: actorId, data: { decision: 'rejected' }, createdAt: new Date() });
      await another.save();
      console.log('Appeal rejected. After:', JSON.stringify({ appeal: another.appeal }, null, 2));
    } else {
      console.log('No second pending appeal found to reject.');
    }
  }

  await mongoose.disconnect();
  console.log('\nAdmin moderation tests complete');
}

run().catch((err) => {
  console.error('Error running admin moderation tests:', err);
  process.exit(1);
});
