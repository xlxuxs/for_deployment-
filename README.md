# AI-Powered Public Opinion Platform

A multi‑channel platform for Ethiopian citizens to provide feedback on government policies via a mobile app and simulated SMS, with AI‑powered sentiment analysis and keyword extraction for policymakers.

## Architecture Overview

| Component  | Technology                        | Description                                                                  |
| ---------- | --------------------------------- | ---------------------------------------------------------------------------- |
| Backend    | Node.js + Express, MongoDB, Redis | User auth, policy management, feedback collection, analytics, SMS simulation |
| AI Service | Python FastAPI, Transformers      | Sentiment analysis, keyword extraction, language detection (fastText)        |

## Features

### For Citizens (Mobile App)

- Registration with email & phone (OTP via email)
- GPS-based policy feed (active policies in user’s region)
- Rate policies (1–5 stars) – optionally add a comment (can be added later via separate endpoint)
- Add a comment to an existing vote (via `/api/comments/:voteId`)
- Anonymous feedback (identity not exposed)
- Self‑service password reset (via email token)
- **In-app notifications** – planners receive notifications when their policies are activated

### For Basic Phone Users (Simulated SMS)

- **Subscription required** – first send `SUBSCRIBE` to register.
- Vote: `RATE <code> <rating>` (max 3 votes per day)
- Check active policies: `POLICIES`, current status: `STATUS <code>`
- View your votes: `MYVOTES`, get final results: `RESULTS <code>`
- Unsubscribe: `STOP`
- Closure notifications are sent only to subscribed voters.

### For Planners & Admins (Web Dashboard)

- Create, edit (draft), **publish**, **unpublish**, close, pause, resume policies
- **Auto‑activation**: published policies become active on their start date
- **Auto‑closure**: active/paused policies close when end date passes
- **In‑app notifications**: planners receive alerts when their policies are activated; **voters receive notifications** when a policy closes (with final results)
- Unified heatmap endpoint – visualise voting patterns over time (global time series or geographic heatmap with region breakdown)
- View analytics: average rating, sentiment counts, top keywords, geographic breakdown, trends
- Export data as CSV
- Manage planner accounts (admin only)
- Moderate pending AI comments (admin only)
- Admin dashboard (statistics, trends, audit logs, AI health) and admin‑initiated password reset
- Clone any existing policy (creates a new draft owned by the cloner)
- View policy history (audit trail of status changes: creation, activation, pause, resume, close, clone)
- Export audit logs as CSV (admin only)
- Comment moderation (admin only) – view pending AI comments, manually set sentiment/keywords, retry failed comments, delete inappropriate comments

### Policy Lifecycle

- **`draft`** – editable, not visible to citizens
- **`published`** – ready for auto‑activation, invisible to citizens, can be unpublished or deleted
- **`active`** – visible, voting open (subject to date range), can be paused or closed
- **`paused`** – temporarily suspended, can be resumed or closed
- **`closed`** – final, no voting, visible only for results

Auto‑activation and auto‑close workers run every minute (using `node-cron`) to transition `published → active` on start date and `active/paused → closed` on end date. Planners receive in‑app notifications when their policies are activated; voters receive notifications when a policy closes (with final average rating and vote count).

### AI Service (Background)

- Multilingual sentiment analysis (Amharic, Oromo, Tigrinya, English)
- Keyword extraction with stopwords
- Automatic language detection (fastText)
- Exponential backoff and retry for failed comments

## Tech Stack

**Backend**

- Node.js 18+, Express 4.x
- MongoDB (Mongoose)
- Redis
- JWT authentication, bcrypt, nanoid
- Winston logging, custom audit trails

**AI Service**

- Python 3.10+, FastAPI
- Transformers, PyTorch
- KeyBERT, sentence‑transformers
- fastText (language detection)

## Documentation

Detailed API documentation is available inside each component:

- **Backend API** – [`backend/API_DOCS.md`](backend/API_DOCS.md) (all REST endpoints, authentication, roles)
- **AI Service API** – [`ai-service/API_DOCS.md`](ai-service/API.md) (sentiment, keywords, benchmarking)

For setup and environment variables, continue reading below.

## Prerequisites

### Local Development

- Node.js 18+ and npm
- Python 3.10+ (with `venv`)
- MongoDB (running locally or via cloud)
- Redis
- Git

### On Arch Linux

```bash
sudo pacman -S base-devel nodejs npm mongodb redis git
sudo systemctl enable mongodb --now
```

### On Ubuntu/Debian:

```bash
sudo apt update
sudo apt install nodejs npm mongodb redis-server git build-essential
sudo systemctl enable mongodb --now
```

## Backend Setup

1. **Clone and enter directory**

   ```bash
   git clone https://github.com/abyayel/finalproject.git
   cd finalproject/backend
   ```

2. **Install dependencies**

   ```bash
   npm install
   ```

3. **Configure environment**

   ```bash
   cp .env.example .env
   ```

   Edit `.env` with your values (see [Environment Variables](#environment-variables)).

4. **Create an admin user (one‑time)**

   ```bash
   node -e "
   const mongoose = require('mongoose');
   const bcrypt = require('bcryptjs');
   require('dotenv').config();
   mongoose.connect(process.env.MONGO_URI).then(async () => {
     const User = require('./src/models/User');
     const email = 'admin@example.com';
     const password = 'temp123';
     const hash = await bcrypt.hash(password, 10);
     await User.updateOne({ email }, { email, passwordHash: hash, phoneHash: null, region: '', role: 'admin', verified: true, active: true }, { upsert: true });
     console.log('Admin created');
     process.exit();
   });
   "
   ```

5. **Start backend**

   ```bash
   npm run dev
   ```

   Backend runs on `http://localhost:5000`

## AI Service Setup

1. **Move to AI service directory**

   ```bash
   cd ../ai-service
   ```

2. **Set up Python 3.12 (recommended with pyenv)**

   ```bash
   # Install pyenv (if not already)
   git clone https://github.com/pyenv/pyenv.git ~/.pyenv
   export PYENV_ROOT="$HOME/.pyenv"
   export PATH="$PYENV_ROOT/bin:$PATH"
   eval "$(pyenv init --path)"
   pyenv install 3.12.4
   pyenv local 3.12.4
   ```

3. **Create virtual environment**

   ```bash
   python -m venv venv
   source venv/bin/activate   # Linux/macOS
   # .\venv\Scripts\activate on Windows
   ```

4. **Install dependencies**

   ```bash
   pip install --upgrade pip setuptools wheel
   pip install -r requirements.txt
   ```

   > **Note:** On Linux with Python 3.12, `fasttext-wheel` will download a pre‑compiled wheel. No compilation needed.

5. **(Optional) Configure environment**

   ```bash
   cp .env.example .env   # only if you need to override fastText model path
   ```

6. **Start AI service**

   ```bash
   uvicorn app.main:app --reload --port 8000
   ```

   AI service runs on `http://localhost:8000`

## Running the Services

Open two terminals:

**Terminal 1 – Backend**

```bash
cd finalproject/backend
npm run dev
```

**Terminal 2 – AI Service**

```bash
cd finalproject/ai-service
source venv/bin/activate
uvicorn app.main:app --reload --port 8000
```

## Environment Variables

### Backend (`.env` in `backend/`)

| Variable           | Description                              | Default                                      |
| ------------------ | ---------------------------------------- | -------------------------------------------- |
| `PORT`             | Backend port                             | `5000`                                       |
| `MONGO_URI`        | MongoDB connection string                | `mongodb://localhost:27017/communityinsight` |
| `JWT_SECRET`       | Secret for signing tokens                | `change this`                                |
| `REDIS_URL`        | Redis connection URL                     | `redis://localhost:6379`                     |
| `AI_SERVICE_URL`   | URL of AI service                        | `http://localhost:8000`                      |
| `EMAIL_HOST`       | SMTP server for OTP                      | `smtp.gmail.com`                             |
| `EMAIL_PORT`       | SMTP port                                | `587`                                        |
| `EMAIL_USER`       | Email account for sending OTP            | –                                            |
| `EMAIL_PASS`       | App password or SMTP password            | –                                            |
| `INTERNAL_API_KEY` | Secret key for AI service authentication | – (required)                                 |

### AI Service (`.env` in `ai-service/`)

| Variable              | Description                                        | Default      |
| --------------------- | -------------------------------------------------- | ------------ |
| `FASTTEXT_MODEL_PATH` | Path to `lid.176.bin` (auto‑downloaded if not set) | –            |
| `INTERNAL_API_KEY`    | Secret key for AI service authentication           | – (required) |
