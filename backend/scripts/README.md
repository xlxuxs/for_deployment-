# Utility Scripts – Backend Seeding, Admin Setup & Cleanup

This folder contains scripts to populate the database with test data, create/reset admin users, generate JWT tokens, and selectively clean up data.

## Prerequisites

- MongoDB must be running (locally or via Docker).
- The backend server **does not need to be running** for database seeding (except for token generation – see notes below).
- Environment variables (`.env` file in the `backend` root) must define `MONGO_URI` (defaults to `mongodb://localhost:27017/civic_engagement`).

## Scripts Overview

| Script             | Purpose                                                                                                                                                                                                                          | Output                                                                                              |
| ------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------- |
| `insertAdmin.js`   | Creates or resets the admin user.                                                                                                                                                                                                | Admin account `admin@example.com` / `temp123`.                                                      |
| `seedCitizens.js`  | Creates 15 citizens (app users) and logs them in (if backend running).                                                                                                                                                           | 15 citizen accounts + `citizen_tokens.json`.                                                        |
| `seedPlanner.js`   | Creates 5 planners and logs them in.                                                                                                                                                                                             | 5 planner accounts + `planner_tokens.json`.                                                         |
| `seedAnalytics.js` | **Full database seeder** – creates 2 planners, 22 citizens (2 per Ethiopian region), 6 policies (including a geographic policy covering all regions), and app votes for all citizens on active policies. Also logs in all users. | Full test dataset + `citizen_tokens.json` and `planner_tokens.json`. Prints policy IDs for testing. |
| `seedMassiveDataset.js` | **Massive test dataset** – creates 8 planners, 55 citizens, 300 polls (100 all-region + 200 regional), 20 comments per poll, votes across poll statuses, and supporting notifications/subscriptions. | Huge dataset + `massive_seed_tokens.json`. |
| `cleanup.js`       | **Selectively delete data** – citizens, planners, admins, app votes, SMS votes, policies, or all. Supports dry run.                                                                                                              | Deletes specified records.                                                                          |

---

## Detailed Instructions

### 1. `insertAdmin.js`

**What it does**

- Creates an admin user with email `admin@example.com` and password `temp123`.
- If the admin already exists, it resets the password to `temp123`.
- Uses a unique dummy `phoneHash` to avoid sparse index issues.

**How to run**

```
cd backend
node scripts/insertAdmin.js
```

**When to use**

- Before first deployment or after clearing the database.
- When you forget the admin password.

---

### 2. `seedCitizens.js`

**What it does**

- Deletes all existing citizens (`role: "citizen"`).
- Creates 15 new citizens with random Ethiopian regions.
- **If the backend is running** (port 5000), it logs in each citizen and saves their JWT tokens to `backend/citizen_tokens.json`.

**How to run**

```
cd backend
node scripts/seedCitizens.js
```

**Notes**

- The backend must be running to obtain tokens; otherwise token generation is skipped (but citizens are still created).
- Tokens are saved as a JSON array in the backend root.

---

### 3. `seedPlanner.js`

**What it does**

- Deletes all existing planners (`role: "planner"`).
- Creates 5 new planners (`planner1@test.com` … `planner5@test.com`).
- **If the backend is running**, it logs in each planner and saves tokens to `backend/planner_tokens.json`.

**How to run**

```
cd backend
node scripts/seedPlanner.js
```

**Notes**

- Same token generation requirements as `seedCitizens.js`.

---

### 4. `seedAnalytics.js` – Full test dataset

**What it does** (complete list)

- **Cleans** the database (keeps admin users, deletes all other users, policies, and feedback).
- **Recreates** unique sparse indexes on the `Feedback` collection.
- **Creates:**
  - 2 planners (`planner1@test.com`, `planner2@test.com`).
  - 22 citizens (2 per Ethiopian region – 11 regions).
  - 6 policies:
    - **Policy 0**: `Geographic Test Policy (All Regions)` – targets **all 11 regions** (use for heatmap testing).
    - Policies 1‑4: active policies with random target regions.
    - Policy 5: closed (inactive).
  - **App votes** only – each citizen votes on every active policy (with optional comments, sentiment, keywords).
- **Saves JWT tokens** for all citizens and planners (if backend is running).
- **Prints** two policy IDs:
  - First ID → for geographic `/analytics/:id/geographic` testing.
  - Second ID → for general analytics (ratings, comments, trends).

**How to run**

```
cd backend
node scripts/seedAnalytics.js
```

**Expected output** (example)

```
Connecting to MongoDB...
Connected to MongoDB
...
Created 22 citizens (2 per region, password: Pass123!)
Created 6 policies (active: 5)
Created 110 feedback entries (22 citizens × 5 policies = 110 app votes)

Use this policy ID for geographic heatmap testing: 67a1b2c3d4e5f6a7b8c9d0e1
Policy title: Geographic Test Policy (All Regions)

Use this policy ID for general analytics testing: 67a1b2c3d4e5f6a7b8c9d0e2
Policy title: Clean Water Access Initiative

Obtaining JWT tokens...
Tokens saved to citizen_tokens.json and planner_tokens.json
```

**After seeding**

- Use the printed geographic policy ID to test `/analytics/:policyId/geographic`.
- Use any citizen or planner token from the JSON files to authenticate API calls in Postman.

### 5. `seedMassiveDataset.js` – Large-volume dataset

**What it does**

- Creates 8 planners and 55 citizens by default.
- Seeds 100 all-region polls and 200 regional polls.
- Cycles through every poll type and poll status.
- Creates 20 comments for every poll, with a mix of clean, low-confidence, reported, and appeal cases.
- Seeds votes, notifications, SMS subscriptions, audit logs, planner requests, and policy associate records.

**How to run**

```
cd backend
npm run seed:massive
```

**Optional overrides**

- `SEED_ALL_REGION_POLLS=100`
- `SEED_REGION_POLLS=200`
- `SEED_COMMENTS_PER_POLL=20`
- `SEED_PLANNER_COUNT=8`
- `SEED_CITIZENS_PER_REGION=5`

---

### 5. `cleanup.js` – Selective data deletion

**What it does**  
Deletes specific records from the database based on flags. Useful for resetting parts of your test data without wiping everything.

**Flags**  
| Flag | Description |
|------|-------------|
| `--citizens, -c` | Delete all citizen user accounts (role: citizen) |
| `--planners, -p` | Delete all planner user accounts (role: planner) |
| `--admins, -a` | Delete all admin user accounts (DANGEROUS) |
| `--app-votes` | Delete all app feedback (channel: app) – votes from citizens |
| `--sms-votes` | Delete all SMS feedback (channel: sms) – votes from anonymous SMS senders |
| `--feedback, -f` | Delete ALL feedback (both app and sms) |
| `--policies, -P` | Delete all policies |
| `--all` | Delete citizens, planners, policies, and ALL feedback (but NOT admins) |
| `--dry-run` | Preview deletions without actually deleting |
| `--help, -h` | Show help message |

**How to run**

```
cd backend

# Delete only SMS votes

node scripts/cleanup.js --sms-votes

# Delete citizens and their app votes

node scripts/cleanup.js --citizens --app-votes

# Delete everything except admins (full reset)

node scripts/cleanup.js --all

# Preview what would be deleted

node scripts/cleanup.js --all --dry-run
```

**Important notes**

- `--all` does **not** delete admin accounts – you must add `--admins` explicitly to delete admins.
- SMS "users" are not stored as user accounts; they only appear as `phoneHash` values in feedback. Use `--sms-votes` to delete their votes.
- Always use `--dry-run` first to verify the scope of deletion.

---

## Troubleshooting

- **`MongoServerError: E11000 duplicate key error`**  
  Run the script again – it drops indexes and cleans the database before inserting. If the error persists, ensure MongoDB is not being accessed concurrently.

- **Backend not reachable** (token generation skipped)  
  Start the backend (`npm run dev`) and re‑run the script. The script will still seed the database but will not generate tokens.

- **Admin script fails with `phoneHash` duplicate**  
  The script uses a dynamic dummy hash, so it should not happen. If it does, manually delete the existing admin in MongoDB and rerun.

---

## Important Notes

- **Never run these scripts in production** – they wipe non‑admin data.
- The scripts assume the backend uses the default port `5000` and the API prefix `/api`. If your setup differs, adjust `API_URL` in the scripts or set the `API_URL` environment variable.
- All scripts respect `MONGO_URI` from your `.env` file.
