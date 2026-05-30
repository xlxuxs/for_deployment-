const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");
const axios = require("axios");
const path = require("path");
const fs = require("fs");
require("dotenv").config({ path: path.join(__dirname, "../.env") });

const User = require("../src/models/User");

const MONGO_URI =
  process.env.MONGO_URI || "mongodb://localhost:27017/communityinsight";
const API_URL = process.env.API_URL || "http://localhost:5000/api";
const DEFAULT_PASSWORD = "Pass123!";

// Fixed data for 5 planners with realistic demographics and languages
const plannerData = [
  {
    email: "planner1@test.com",
    region: "Addis Ababa",
    ageRange: "35-44",
    gender: "male",
    occupation: "government-employee",
    education: "postgraduate",
    languagesSpoken: ["am", "en"],
  },
  {
    email: "planner2@test.com",
    region: "Oromia",
    ageRange: "25-34",
    gender: "female",
    occupation: "government-employee",
    education: "bachelors",
    languagesSpoken: ["om", "en"],
  },
  {
    email: "planner3@test.com",
    region: "Tigray",
    ageRange: "45-54",
    gender: "male",
    occupation: "private-sector",
    education: "bachelors",
    languagesSpoken: ["ti", "en"],
  },
  {
    email: "planner4@test.com",
    region: "Amhara",
    ageRange: "25-34",
    gender: "female",
    occupation: "student",
    education: "bachelors",
    languagesSpoken: ["am", "en"],
  },
  {
    email: "planner5@test.com",
    region: "Addis Ababa",
    ageRange: "35-44",
    gender: "non-binary",
    occupation: "private-sector",
    education: "postgraduate",
    languagesSpoken: ["en", "am"],
  },
];

async function seedPlanners() {
  try {
    console.log("Connecting to MongoDB...");
    await mongoose.connect(MONGO_URI);
    console.log("Connected.");

    await User.deleteMany({ role: "planner" });
    console.log("Deleted existing planners.");

    const passwordHash = await bcrypt.hash(DEFAULT_PASSWORD, 10);
    const planners = [];

    for (const data of plannerData) {
      const phoneHash = `planner_dummy_${data.email.split("@")[0]}`; // dummy for seed
      planners.push({
        ...data,
        passwordHash,
        phoneHash,
        role: "planner",
        verified: true,
        active: true,
        trainingCompletedAt: new Date(), // mark training as completed for testing
        tokenVersion: 0,
        deletedAt: null,
        twoFactorEnabled: false,
      });
    }

    const inserted = await User.insertMany(planners);
    console.log(`Created ${inserted.length} planners.`);

    // Verify login works
    const testPlanner = await User.findOne({ email: "planner1@test.com" });
    const isMatch = await bcrypt.compare(
      DEFAULT_PASSWORD,
      testPlanner.passwordHash,
    );
    console.log(
      `Password verification for planner1: ${isMatch ? "OK" : "FAIL"}`,
    );

    await mongoose.disconnect();
    console.log("MongoDB disconnected.\n");

    if (!isMatch) {
      console.error("Password mismatch. Aborting login test.");
      process.exit(1);
    }

    // Obtain tokens
    console.log("Logging in planners...\n");
    const tokens = [];
    for (const data of plannerData) {
      try {
        const response = await axios.post(`${API_URL}/auth/login`, {
          email: data.email,
          password: DEFAULT_PASSWORD,
        });
        if (response.data.status === "success") {
          tokens.push({
            email: data.email,
            token: response.data.data.token,
            role: response.data.data.role,
          });
          console.log(`${data.email} logged in.`);
        } else {
          console.error(`${data.email} login failed:`, response.data);
        }
      } catch (err) {
        console.error(
          `${data.email} login error:`,
          err.response?.data || err.message,
        );
      }
    }

    const tokensDir = path.join(__dirname, "../tokens");
    if (!fs.existsSync(tokensDir)) fs.mkdirSync(tokensDir);
    const tokenFilePath = path.join(tokensDir, "planner_tokens.json");
    fs.writeFileSync(tokenFilePath, JSON.stringify(tokens, null, 2));
    console.log(`\nTokens saved to ${tokenFilePath}`);
    console.log("Planner Tokens:\n", JSON.stringify(tokens, null, 2));
  } catch (err) {
    console.error("Seeding error:", err);
  } finally {
    await mongoose.disconnect();
  }
}

seedPlanners();
