const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");
const axios = require("axios");
const path = require("path");
const fs = require("fs");
require("dotenv").config({ path: path.join(__dirname, "../.env") });

const MONGO_URI = process.env.MONGO_URI;
const API_URL = process.env.API_URL || "http://localhost:5000/api";
const DEFAULT_PASSWORD = "temp123"; // defined in script

const insertAdmin = async () => {
  try {
    await mongoose.connect(MONGO_URI);
    const User = require(path.join(__dirname, "..", "src", "models", "User"));

    const email = "admin@example.com";
    const password = DEFAULT_PASSWORD;
    const passwordHash = await bcrypt.hash(password, 10);

    // Use a unique dummy phoneHash to avoid sparse index issues
    const admin = {
      email,
      passwordHash,
      phoneHash: `admin_dummy_${Date.now()}`,
      region: "",
      role: "admin",
      verified: true,
      active: true,
    };

    const result = await User.updateOne(
      { email },
      { $set: admin },
      { upsert: true },
    );

    if (result.upsertedCount > 0) {
      console.log(
        `Admin user created with email: ${email}, password: ${password}`,
      );
    } else if (result.modifiedCount > 0) {
      console.log(`Admin user updated (password reset to ${password})`);
    } else {
      console.log(`Admin user already exists, no changes.`);
    }

    // Now obtain a JWT token for the admin
    try {
      const response = await axios.post(`${API_URL}/auth/login`, {
        email,
        password,
      });
      if (response.data.status === "success") {
        const token = response.data.data.token;
        const tokensDir = path.join(__dirname, "../tokens");
        if (!fs.existsSync(tokensDir)) {
          fs.mkdirSync(tokensDir);
          console.log("Created tokens directory.");
        }
        const tokenFile = path.join(tokensDir, "admin_token.json");
        fs.writeFileSync(
          tokenFile,
          JSON.stringify({ email, token, role: "admin" }, null, 2),
        );
        console.log(`Admin token saved to ${tokenFile}`);
      } else {
        console.warn("Login failed for admin:", response.data.message);
      }
    } catch (err) {
      console.warn(
        "Could not obtain admin token (backend not reachable or login error):",
        err.message,
      );
    }

    process.exit();
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
};

insertAdmin();
