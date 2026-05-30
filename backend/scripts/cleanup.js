/**
 * Cleanup script – selectively delete data from the database.
 *
 * Usage:
 *   node scripts/cleanup.js [options]
 *
 * Options:
 *   --citizens, -c      Delete all citizen users (role: citizen)
 *   --planners, -p      Delete all planner users (role: planner)
 *   --admins, -a        Delete all admin users (role: admin) – DANGEROUS
 *   --votes, -v         Delete all vote documents
 *   --comments, -C      Delete all comment documents
 *   --policies, -P      Delete all policies
 *   --sms-votes         Delete all SMS votes (channel: sms) from votes collection
 *   --app-votes         Delete all app votes (channel: app) from votes collection
 *   --notifications, -N Delete all notification documents
 *   --audit-logs, -L    Delete all audit log documents
 *   --all               Delete EVERYTHING (citizens, planners, votes, comments, policies, notifications, audit logs, but NOT admins unless --admins also given)
 *   --dry-run           Show what would be deleted without actually deleting
 *   --help, -h          Show this help message
 *
 * Examples:
 *   node scripts/cleanup.js --citizens --planners
 *   node scripts/cleanup.js --all
 *   node scripts/cleanup.js --votes --comments --policies --dry-run
 */

const mongoose = require("mongoose");
const path = require("path");
require("dotenv").config({ path: path.join(__dirname, "../.env") });

const User = require("../src/models/User");
const Policy = require("../src/models/Policy");
const Vote = require("../src/models/Vote");
const Comment = require("../src/models/Comment");
const Notification = require("../src/models/Notification");
const AuditLog = require("../src/models/AuditLog");

const MONGO_URI =
  process.env.MONGO_URI || "mongodb://localhost:27017/communityinsight";

// Parse command line arguments
const args = process.argv.slice(2);
const flags = {
  citizens: false,
  planners: false,
  admins: false,
  votes: false,
  comments: false,
  policies: false,
  smsVotes: false,
  appVotes: false,
  notifications: false,
  auditLogs: false,
  all: false,
  dryRun: false,
  help: false,
};

for (let i = 0; i < args.length; i++) {
  const arg = args[i];
  switch (arg) {
    case "--citizens":
    case "-c":
      flags.citizens = true;
      break;
    case "--planners":
    case "-p":
      flags.planners = true;
      break;
    case "--admins":
    case "-a":
      flags.admins = true;
      break;
    case "--votes":
    case "-v":
      flags.votes = true;
      break;
    case "--comments":
    case "-C":
      flags.comments = true;
      break;
    case "--policies":
    case "-P":
      flags.policies = true;
      break;
    case "--sms-votes":
      flags.smsVotes = true;
      break;
    case "--app-votes":
      flags.appVotes = true;
      break;
    case "--notifications":
    case "-N":
      flags.notifications = true;
      break;
    case "--audit-logs":
    case "-L":
      flags.auditLogs = true;
      break;
    case "--all":
      flags.all = true;
      break;
    case "--dry-run":
      flags.dryRun = true;
      break;
    case "--help":
    case "-h":
      flags.help = true;
      break;
    default:
      console.error(`Unknown option: ${arg}`);
      flags.help = true;
  }
}

if (flags.help) {
  console.log(`
Cleanup script – selectively delete data.

Usage: node scripts/cleanup.js [options]

Options:
  --citizens, -c      Delete all citizen users (role: citizen)
  --planners, -p      Delete all planner users (role: planner)
  --admins, -a        Delete all admin users (role: admin) – DANGEROUS
  --votes, -v         Delete all vote documents
  --comments, -C      Delete all comment documents
  --policies, -P      Delete all policies
  --sms-votes         Delete only SMS votes (channel: sms)
  --app-votes         Delete only app votes (channel: app)
  --notifications, -N Delete all notification documents
  --audit-logs, -L    Delete all audit log documents
  --all               Delete EVERYTHING (citizens, planners, votes, comments, policies, notifications, audit logs, but NOT admins unless --admins also given)
  --dry-run           Show what would be deleted without actually deleting
  --help, -h          Show this help

Examples:
  node scripts/cleanup.js --citizens --planners
  node scripts/cleanup.js --all
  node scripts/cleanup.js --votes --comments --policies --dry-run
  `);
  process.exit(0);
}

// If --all is set, enable everything except admins (unless --admins also set)
if (flags.all) {
  flags.citizens = true;
  flags.planners = true;
  flags.votes = true;
  flags.comments = true;
  flags.policies = true;
  flags.notifications = true;
  flags.auditLogs = true;
  // admins remain false unless explicitly requested
}

async function cleanup() {
  try {
    await mongoose.connect(MONGO_URI);
    console.log("Connected to MongoDB");

    const deletions = [];

    // Citizens
    if (flags.citizens) {
      const result = await User.deleteMany({ role: "citizen" });
      deletions.push(`Citizens: ${result.deletedCount} deleted`);
    }

    // Planners
    if (flags.planners) {
      const result = await User.deleteMany({ role: "planner" });
      deletions.push(`Planners: ${result.deletedCount} deleted`);
    }

    // Admins (dangerous)
    if (flags.admins) {
      const result = await User.deleteMany({ role: "admin" });
      deletions.push(`Admins: ${result.deletedCount} deleted`);
    }

    // Votes (all)
    if (flags.votes) {
      const result = await Vote.deleteMany({});
      deletions.push(`Votes (all): ${result.deletedCount} deleted`);
    }

    // SMS votes only
    if (flags.smsVotes) {
      const result = await Vote.deleteMany({ channel: "sms" });
      deletions.push(`SMS votes: ${result.deletedCount} deleted`);
    }

    // App votes only
    if (flags.appVotes) {
      const result = await Vote.deleteMany({ channel: "app" });
      deletions.push(`App votes: ${result.deletedCount} deleted`);
    }

    // Comments
    if (flags.comments) {
      const result = await Comment.deleteMany({});
      deletions.push(`Comments: ${result.deletedCount} deleted`);
    }

    // Policies
    if (flags.policies) {
      const result = await Policy.deleteMany({});
      deletions.push(`Policies: ${result.deletedCount} deleted`);
    }

    // Notifications
    if (flags.notifications) {
      // Check if Notification model exists
      if (Notification && Notification.deleteMany) {
        const result = await Notification.deleteMany({});
        deletions.push(`Notifications: ${result.deletedCount} deleted`);
      } else {
        deletions.push("Notifications: Model not found – skipping");
      }
    }

    // Audit Logs
    if (flags.auditLogs) {
      if (AuditLog && AuditLog.deleteMany) {
        const result = await AuditLog.deleteMany({});
        deletions.push(`Audit Logs: ${result.deletedCount} deleted`);
      } else {
        deletions.push("Audit Logs: Model not found – skipping");
      }
    }

    if (deletions.length === 0) {
      console.log("Nothing to delete. Use --help to see options.");
    } else {
      if (flags.dryRun) {
        console.log("\n[DRY RUN] Would delete:");
        deletions.forEach((d) => console.log(`  - ${d}`));
      } else {
        console.log("\nDeleted:");
        deletions.forEach((d) => console.log(`  - ${d}`));
      }
    }

    await mongoose.disconnect();
    console.log("\nDisconnected.");
  } catch (err) {
    console.error("Cleanup error:", err);
    await mongoose.disconnect();
    process.exit(1);
  }
}

cleanup();
