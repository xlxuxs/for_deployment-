const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");
const axios = require("axios");
const path = require("path");
const fs = require("fs");
require("dotenv").config({ path: path.join(__dirname, "../.env") });

const User = require("../src/models/User");
const { hashPhone } = require("../src/utils/helpers");

const MONGO_URI =
  process.env.MONGO_URI || "mongodb://localhost:27017/communityinsight";
const API_URL = process.env.API_URL || "http://localhost:5000/api";
const DEFAULT_PASSWORD = "Pass123!";

const regions = [
  "Addis Ababa",
  "Oromia",
  "Amhara",
  "Tigray",
  "SNNPR",
  "Adama",
  "Bahir Dar",
  "Mekelle",
];
const ageRanges = ["18-24", "25-34", "35-44", "45-54", "55+"];
const genders = ["male", "female", "non-binary", "prefer-not-to-say"];
const occupations = [
  "student",
  "farmer",
  "merchant",
  "government-employee",
  "private-sector",
  "unemployed",
  "other",
];
const educations = [
  "no-formal",
  "primary",
  "secondary",
  "diploma",
  "bachelors",
  "postgraduate",
];

const randomItem = (arr) => arr[Math.floor(Math.random() * arr.length)];

async function seedCitizens() {
  try {
    console.log("Connecting to MongoDB...");
    await mongoose.connect(MONGO_URI);
    console.log("Connected.");

    const deleteResult = await User.deleteMany({ role: "citizen" });
    console.log(`Deleted ${deleteResult.deletedCount} existing citizens.`);

    const passwordHash = await bcrypt.hash(DEFAULT_PASSWORD, 10);
    const citizens = [];

    for (let i = 1; i <= 15; i++) {
      const email = `citizen${i}@test.com`;
      const phone = `+25191234${String(1000 + i).slice(-4)}`;
      const phoneHash = hashPhone(phone);
      citizens.push({
        email,
        passwordHash,
        phoneHash,
        region: randomItem(regions),
        ageRange: randomItem(ageRanges),
        gender: randomItem(genders),
        occupation: randomItem(occupations),
        education: randomItem(educations),
        role: "citizen",
        verified: true,
        active: true,
        tokenVersion: 0,
        deletedAt: null,
      });
    }

    await User.insertMany(citizens);
    console.log(`Created ${citizens.length} new citizens.`);

    await mongoose.disconnect();
    console.log("MongoDB disconnected.\n");

    console.log("Logging in citizens to obtain tokens...\n");
    const tokens = [];
    for (let i = 1; i <= 15; i++) {
      const email = `citizen${i}@test.com`;
      try {
        const response = await axios.post(`${API_URL}/auth/login`, {
          email,
          password: DEFAULT_PASSWORD,
        });
        let token, role;
        if (response.data.status === "success") {
          token = response.data.data.token;
          role = response.data.data.role;
        } else {
          token = response.data.token;
          role = response.data.role;
        }
        tokens.push({ email, token, role });
        console.log(`${email} logged in.`);
      } catch (err) {
        console.error(
          `Login failed for ${email}:`,
          err.response?.data || err.message,
        );
      }
    }

    const tokensDir = path.join(__dirname, "../tokens");
    if (!fs.existsSync(tokensDir)) fs.mkdirSync(tokensDir);
    const tokenFilePath = path.join(tokensDir, "citizen_tokens.json");
    fs.writeFileSync(tokenFilePath, JSON.stringify(tokens, null, 2));
    console.log(`\nTokens saved to ${tokenFilePath}`);
    console.log("\nCitizen Tokens (copy for Postman):\n");
    console.log(JSON.stringify(tokens, null, 2));
  } catch (err) {
    console.error("Seeding error:", err);
    await mongoose.disconnect();
    process.exit(1);
  }
}

seedCitizens();
