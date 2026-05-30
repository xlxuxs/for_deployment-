const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");
const path = require("path");
require("dotenv").config({ path: path.join(__dirname, "../.env") });

const User = require("../src/models/User");

const MONGO_URI = process.env.MONGO_URI || "mongodb://localhost:27017/communityinsight";
const DEFAULT_PASSWORD = "Pass123!";

async function addUsers() {
  try {
    console.log("Connecting to MongoDB...");
    await mongoose.connect(MONGO_URI);
    console.log("Connected to MongoDB");

    const passwordHash = await bcrypt.hash(DEFAULT_PASSWORD, 10);

    // Delete existing users if they exist
    const emailsToDelete = [
      "masofficial2015@gmail.com",
      "mesudahmed903@gmail.com",
      "mesudahmed83@gmail.com"
    ];

    for (const email of emailsToDelete) {
      await User.findOneAndDelete({ email });
      console.log(`Deleted existing user: ${email}`);
    }

    // Add new users
    const users = [
      {
        email: "masofficial2015@gmail.com",
        role: "planner",
        region: "Addis Ababa",
        ageRange: "25-34",
        gender: "male",
        occupation: "government-employee",
        education: "bachelors",
        languagesSpoken: ["en", "am"],
        trainingCompletedAt: new Date(),
      },
      {
        email: "mesudahmed903@gmail.com",
        role: "planner",
        region: "Oromia",
        ageRange: "25-34",
        gender: "male",
        occupation: "private-sector",
        education: "bachelors",
        languagesSpoken: ["om", "en"],
        trainingCompletedAt: new Date(),
      },
      {
        email: "mesudahmed83@gmail.com",
        role: "admin",
        region: "Addis Ababa",
        ageRange: "35-44",
        gender: "male",
        occupation: "government-employee",
        education: "postgraduate",
        languagesSpoken: ["en", "am"],
      },
    ];

    for (const userData of users) {
      const user = new User({
        ...userData,
        passwordHash,
        phoneHash: `dummy_${userData.email.split("@")[0]}_${Date.now()}`,
        verified: true,
        active: true,
        tokenVersion: 0,
        deletedAt: null,
        twoFactorEnabled: false,
      });
      await user.save();
      console.log(`Created user: ${userData.email} (${userData.role})`);
    }

    console.log("All users added successfully!");
    console.log(`Default password: ${DEFAULT_PASSWORD}`);

  } catch (error) {
    console.error("Error:", error);
  } finally {
    await mongoose.disconnect();
    console.log("Disconnected from MongoDB");
  }
}

addUsers();