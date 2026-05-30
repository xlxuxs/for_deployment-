/**
 * Migration script to remove the old voteId index from comments collection
 * 
 * The voteId field was removed from the Comment model but the unique index
 * still exists in the database, causing duplicate key errors.
 * 
 * Usage:
 *   node scripts/fix-comment-index.js
 */

const mongoose = require("mongoose");
const path = require("path");
require("dotenv").config({ path: path.join(__dirname, "../.env") });

const MONGO_URI =
  process.env.MONGO_URI || "mongodb://localhost:27017/civic_engagement";

async function fixCommentIndex() {
  try {
    console.log("Connecting to MongoDB...");
    await mongoose.connect(MONGO_URI);
    console.log("Connected.");

    const db = mongoose.connection.db;
    const collection = db.collection("comments");

    // List all indexes
    console.log("\nCurrent indexes on comments collection:");
    const indexes = await collection.indexes();
    indexes.forEach((index) => {
      console.log(`  - ${index.name}:`, JSON.stringify(index.key));
    });

    // Check if voteId index exists
    const voteIdIndex = indexes.find((idx) => idx.key.voteId);
    
    if (voteIdIndex) {
      console.log(`\nFound voteId index: ${voteIdIndex.name}`);
      console.log("Dropping voteId index...");
      await collection.dropIndex(voteIdIndex.name);
      console.log("✓ voteId index dropped successfully");
    } else {
      console.log("\n✓ No voteId index found (already removed or never existed)");
    }

    // List indexes after cleanup
    console.log("\nIndexes after cleanup:");
    const finalIndexes = await collection.indexes();
    finalIndexes.forEach((index) => {
      console.log(`  - ${index.name}:`, JSON.stringify(index.key));
    });

    await mongoose.disconnect();
    console.log("\nDisconnected. Migration complete.");
  } catch (err) {
    console.error("Migration error:", err);
    await mongoose.disconnect();
    process.exit(1);
  }
}

fixCommentIndex();
