# API Documentation – Civic Engagement Platform

## 1. Overview

### 1.1 Base URLs

| Environment       | URL                                              |
| ----------------- | ------------------------------------------------ |
| Local development | `http://localhost:5000/api`                      |
| Production        | `https://your-domain.com/api` (to be configured) |

All endpoints are prefixed with /api. For example: http://localhost:5000/api/auth/login.

### 1.2 Authentication

Most endpoints require a Bearer token obtained after successful login or OTP verification.

Include the token in the Authorization header:

```http
    Authorization: Bearer <your-jwt-token>
```

**Token expiry depends on the user role**:

| Role    | Expiry time |
| ------- | ----------- |
| Citizen | 7 days      |
| Planner | 12 hours    |
| Admin   | 6 hours     |

After expiry, the user must log in again.

### 1.3. Uniform Response Format

Every JSON response follows this exact structure:

Success response:

```json
{
  "status": "success",
  "data": { ... },          // can be an object, array, or null
  "message": "Human-readable message",
  "timestamp": "2026-04-09T12:00:00Z"
}
```

Error response:

```json
{
  "status": "error",
  "error": {
    "code": "ERROR_CODE",
    "message": "Detailed description"
  },
  "timestamp": "..."
}
```

### 1.4 Common Error Codes

| Code                    | HTTP status | Meaning                                      |
| ----------------------- | ----------- | -------------------------------------------- |
| `VALIDATION_ERROR`      | 400         | Missing or invalid input fields              |
| `UNAUTHORIZED`          | 401         | Missing or invalid token                     |
| `FORBIDDEN`             | 403         | Insufficient permissions or account disabled |
| `NOT_FOUND`             | 404         | Resource does not exist                      |
| `DUPLICATE_ENTRY`       | 409         | Email or phone already registered            |
| `RATE_LIMIT_EXCEEDED`   | 429         | Too many requests from this IP/phone         |
| `ACCOUNT_DISABLED`      | 403         | User account deactivated by admin            |
| `NOT_VERIFIED`          | 403         | OTP verification not completed               |
| `VOTING_CLOSED`         | 400         | Policy voting period has ended               |
| `ALREADY_VOTED`         | 409         | User already voted on this policy            |
| `INTERNAL_SERVER_ERROR` | 500         | Server error – try again later               |

### 1.5 Rate Limiting

| Endpoint group                    | Limit        | Time window | Scope             |
| --------------------------------- | ------------ | ----------- | ----------------- |
| `/auth/login`, `/auth/verify-otp` | 10 requests  | 15 minutes  | Per IP            |
| `/auth/send-otp`                  | 3 requests   | 1 hour      | Per IP            |
| `/auth/forgot-password`           | 3 requests   | 1 hour      | Per IP            |
| `/auth/reset-password`            | 5 requests   | 15 minutes  | Per IP            |
| `/votes` (POST)                   | 30 requests  | 1 hour      | Per user (by JWT) |
| `/comments` (POST)                | 10 requests  | 1 minute    | Per user (by JWT) |
| `/planners/request`               | 1 request    | 24 hours    | Per user (by JWT) |
| All other `/api` endpoints        | 100 requests | 15 minutes  | Per IP            |
| `/sms/receive`                    | 3 votes      | 24 hours    | Per phone number  |

When a limit is exceeded, the API returns `429 RATE_LIMIT_EXCEEDED` with a human-readable message.

## 2. Authentication Endpoints

These endpoints are public (no token required).

### 2.1 Register a new citizen

**`POST /auth/register`**

Creates a new citizen account. An OTP is sent to the provided email address. The phone number is stored for channel exclusivity (to prevent app users from voting via SMS).

**Request body:**

```json
{
  "email": "user@example.com",
  "password": "strongPass123",
  "phone": "+251912345678",
  "region": "Addis Ababa",
  "ageRange": "25-34",
  "gender": "male",
  "occupation": "private-sector",
  "education": "bachelors"
}
```

| Field      | Type   | Required | Description                                                                                     |
| ---------- | ------ | -------- | ----------------------------------------------------------------------------------------------- |
| email      | string | yes      | Valid email address                                                                             |
| password   | string | yes      | Min 8 characters, at least one uppercase, one lowercase, one number, one special                |
| phone      | string | yes      | Ethiopian phone number, international format recommended (+2519...)                             |
| region     | string | yes      | City/region name (e.g., "Addis Ababa", "Oromia")                                                |
| ageRange   | string | yes      | One of: `18-24`, `25-34`, `35-44`, `45-54`, `55+`                                               |
| gender     | string | yes      | `male`, `female`, `non-binary`, `prefer-not-to-say`                                             |
| occupation | string | yes      | `student`, `farmer`, `merchant`, `government-employee`, `private-sector`, `unemployed`, `other` |
| education  | string | yes      | `no-formal`, `primary`, `secondary`, `diploma`, `bachelors`, `postgraduate`                     |

**CAPTCHA:**  
In production, the request must include a `captchaToken` field (obtained from Google reCAPTCHA v2).  
For local development, you can disable CAPTCHA by setting `DISABLE_CAPTCHA=true` in the environment.

**Input validation rules:**

- `email` – must be a valid email format (`name@domain.com`).
- `phone` – must be a valid Ethiopian phone number (e.g., `+251912345678`, `0912345678`, or `912345678`).
- `password` – at least 8 characters.

**Behaviour:**

- If the email is already registered and **verified**, the API returns `409 DUPLICATE_ENTRY`.
- If the email is already registered but **unverified** (the user never completed OTP verification), the system **resets the 24‑hour verification timer** and sends a fresh OTP to the email. The existing user record is reused, and the API returns `200 OK` with a message indicating a new OTP has been sent.
- New users have **24 hours** to verify their email. After 24 hours, unverified accounts are automatically deleted by a daily cleanup job (runs at 2 AM). This prevents email addresses from being held hostage.

**Response (201 Created) – for a completely new user:**

```json
{
  "status": "success",
  "data": { "userId": "67f1a2b3c4d5e6f7a8b9c0d1" },
  "message": "User registered successfully. A 6-digit OTP has been sent to your email for verification.",
  "timestamp": "2026-04-09T12:00:00Z"
}
```

**Response (200 OK) – for an existing unverified user (re‑registration):**

```json
{
  "status": "success",
  "data": { "userId": "67f1a2b3c4d5e6f7a8b9c0d1" },
  "message": "A new OTP has been sent to your email. Please verify within 5 minutes.",
  "timestamp": "..."
}
```

**Error responses:**

| Status | Code                    | Message                                                                                              |
| ------ | ----------------------- | ---------------------------------------------------------------------------------------------------- |
| 400    | `VALIDATION_ERROR`      | `"Missing required fields: email, password, phone, region, ageRange, gender, occupation, education"` |
| 400    | `VALIDATION_ERROR`      | `"Invalid email format"` or `"Invalid Ethiopian phone number format"`                                |
| 400    | `VALIDATION_ERROR`      | `"Password must be at least 8 characters long"`                                                      |
| 409    | `DUPLICATE_ENTRY`       | `"Email already registered. Please use a different email or log in."` (for verified emails)          |
| 409    | `DUPLICATE_ENTRY`       | `"Phone number already registered. Please use a different number."`                                  |
| 500    | `INTERNAL_SERVER_ERROR` | `"Unable to complete registration. Please try again later."`                                         |

### 2.2 Send OTP

**`POST /auth/send-otp`**

Sends a 6‑digit OTP to the user's registered email address.  
**Rate limit:** 3 requests per hour per IP. If the limit is exceeded, the API returns `429 RATE_LIMIT_EXCEEDED` with message `"Too many requests. Please wait 60 minutes."`
**Resend cooldown:** If an OTP already exists and has more than 30 seconds of life remaining (i.e., TTL > 270 seconds), the request is rejected with a `RATE_LIMIT_EXCEEDED` error. After 30 seconds, a new OTP can be sent (overwriting the previous one).

**Request body:**

```json
{
  "email": "user@example.com"
}
```

Response (200 OK):

```json
{
  "status": "success",
  "data": null,
  "message": "OTP sent successfully. It expires in 5 minutes.",
  "timestamp": "..."
}
```

**Error responses (new/updated):**

| Status | Code                  | Message                                                                                                                                     |
| ------ | --------------------- | ------------------------------------------------------------------------------------------------------------------------------------------- |
| 429    | `RATE_LIMIT_EXCEEDED` | `"An OTP has already been sent and is valid for X more seconds. Please use that code or wait for it to expire."` (when resending too early) |
| 429    | `RATE_LIMIT_EXCEEDED` | `"Too many OTP requests. Please wait 5 minutes."` (rate limit hit)                                                                          |

### 2.3 Verify OTP

**`POST /auth/verify-otp`**

Verifies the OTP and returns a JWT token. After successful verification, the user's verified flag becomes true, allowing login.

**Rate limit:** 5 requests per 15 minutes per IP. After 5 failed attempts, you must wait 15 minutes.

Request body:

```json
{
  "email": "user@example.com",
  "code": "123456"
}
```

Response (200 OK):

```json
{
  "status": "success",
  "data": {
    "token": "eyJhbGciOiJIUzI1NiIs...",
    "role": "citizen"
  },
  "message": "Email verified successfully. You can now log in.",
  "timestamp": "..."
}
```

Error responses:

| Status | Code                  | Message                                                    |
| ------ | --------------------- | ---------------------------------------------------------- |
| 400    | `VALIDATION_ERROR`    | `"Invalid or expired OTP. Please request a new one."`      |
| 429    | `RATE_LIMIT_EXCEEDED` | `"Too many verification attempts. Please wait 5 minutes."` |

### 2.4 Login

**`POST /auth/login`**

Authenticates a user with email and password. Returns a JWT token valid for 7 days (citizen), 12 hours (planner), or 6 hours (admin).

**CAPTCHA:**  
In production, the request must include a `captchaToken` field (obtained from Google reCAPTCHA v2).  
For local development, you can disable CAPTCHA by setting `DISABLE_CAPTCHA=true` in the environment.

**Request body:**

```json
{
  "email": "user@example.com",
  "password": "strongPass123",
  "captchaToken": "optional_in_development"
}
```

**Response (200 OK):**

```json
{
  "status": "success",
  "data": {
    "token": "eyJhbGciOiJIUzI1NiIs...",
    "role": "citizen",
    "userId": "67f1a2b3..."
  },
  "message": "Login successful.",
  "timestamp": "..."
}
```

**Error responses:**

| Status | Code                  | Message                                                                         |
| ------ | --------------------- | ------------------------------------------------------------------------------- |
| 400    | `VALIDATION_ERROR`    | `"Email and password are required"`                                             |
| 401    | `INVALID_CREDENTIALS` | `"Invalid email or password."`                                                  |
| 403    | `ACCOUNT_DISABLED`    | `"Your account has been deactivated. Please contact an administrator."`         |
| 403    | `NOT_VERIFIED`        | `"Your email address is not verified. Please complete OTP verification first."` |

### 2.5 Password Reset

### 2.5.1 Request password reset (user self‑service)

**`POST /auth/forgot-password`**

Sends a secure reset token to the user’s registered email address. The token is valid for 1 hour and can be used with `/auth/reset-password`.

**Rate limit:** 3 requests per hour per IP. This limit is enforced by the global rate limiter (see 1.5).

**Request body:**

```json
{
  "email": "user@example.com"
}
```

Response (200 OK):  
The same message is returned regardless of whether the email exists, to prevent user enumeration.

```json
{
  "status": "success",
  "data": null,
  "message": "If an account with that email exists, a password reset link has been sent.",
  "timestamp": "2026-04-28T12:00:00Z"
}
```

**Error responses:**

| Status | Code                    | Message                                                       |
| ------ | ----------------------- | ------------------------------------------------------------- |
| 400    | `VALIDATION_ERROR`      | `"Email is required"`                                         |
| 429    | `RATE_LIMIT_EXCEEDED`   | `"Too many password reset requests. Please try again later."` |
| 500    | `INTERNAL_SERVER_ERROR` | `"Failed to process password reset request"`                  |

---

### 2.5.2 Reset password using token

**`POST /auth/reset-password`**

**Request body:**

```json
{
  "token": "hex_token_from_email",
  "newPassword": "NewSecurePass123"
}
```

**Response (200 OK):**

```json
{
  "status": "success",
  "data": null,
  "message": "Password has been reset successfully. You can now log in with your new password.",
  "timestamp": "..."
}
```

**Error responses:**

| Status | Code                    | Message                                                           |
| ------ | ----------------------- | ----------------------------------------------------------------- |
| 400    | `VALIDATION_ERROR`      | `"Token and new password are required"`                           |
| 400    | `VALIDATION_ERROR`      | `"Password must be at least 8 characters long"`                   |
| 400    | `VALIDATION_ERROR`      | `"New password must be different from current password"`          |
| 400    | `VALIDATION_ERROR`      | `"Invalid or expired reset token. Please request a new one."`     |
| 404    | `NOT_FOUND`             | `"User not found"`                                                |
| 429    | `RATE_LIMIT_EXCEEDED`   | `"Too many password reset attempts. Please request a new token."` |
| 500    | `INTERNAL_SERVER_ERROR` | `"Failed to reset password"`                                      |

---

### 2.5.3 Admin‑initiated password reset

**`POST /admin/users/:id/initiate-password-reset`**

**Role required:** `admin`

Triggers a password reset email for the specified user (citizen or planner). The admin never sees or sets the password; the user receives a token and must use `/auth/reset-password` to choose a new password themselves.  
The admin cannot reset their own password through this endpoint – they must use the normal forgot‑password flow.

**Path parameter:**

| Parameter | Type   | Description                                        |
| --------- | ------ | -------------------------------------------------- |
| `id`      | string | User ID (MongoDB ObjectId) of a citizen or planner |

**Response (200 OK):**

```json
{
  "status": "success",
  "data": null,
  "message": "Password reset email sent to user@example.com. The user will receive a link to set a new password.",
  "timestamp": "..."
}
```

**Error responses:**

| Status | Code                    | Message                                                  |
| ------ | ----------------------- | -------------------------------------------------------- |
| 403    | `FORBIDDEN`             | `"Use /auth/forgot-password to reset your own password"` |
| 404    | `NOT_FOUND`             | `"User not found"`                                       |
| 500    | `INTERNAL_SERVER_ERROR` | `"Failed to initiate password reset"`                    |

## 3. Policy Endpoints

| Role    | View own draft/published? | View others' draft/published? | View others' active/paused/closed?      | Create / Update / Delete (own) | Publish / Unpublish (own) | Pause / Resume / Close / Extend (own)                 |
| ------- | ------------------------- | ----------------------------- | --------------------------------------- | ------------------------------ | ------------------------- | ----------------------------------------------------- |
| Citizen | No                        | No                            | Yes (`active` and `paused`, own region) | No                             | No                        | No                                                    |
| Planner | Yes (all statuses)        | **No (404)**                  | Yes                                     | Yes (draft/published only)     | Yes (draft → published)   | Yes (published → active, active/paused → close, etc.) |
| Admin   | Yes (all)                 | Yes (all)                     | Yes                                     | Yes (any policy)               | Yes (any policy)          | Yes (any policy)                                      |

**Important visibility rules:**

- **Citizens** can only see policies with status `active` or `paused` that target their region. Any other policy (different status, different region) returns **`404 Not Found`** when accessed directly – citizens are never told that such a policy exists.
- **Planners** see their own policies (any status). For other planners' policies, only `active`, `paused`, and `closed` are visible; **draft** and **published** policies of others return **`404 Not Found`** on any endpoint.
- **Admins** can see all policies.

**Notes on actions:**

- Delete allowed only for `draft` or `published` policies. Update only for `draft` policies.
- Extend works on `active` or `paused`. Pause works on `active`, Resume on `paused`. Close works on `active` or `paused`.
- Publish moves a `draft` policy to `published` (or directly to `active` if startDate already passed).
- Unpublish moves a `published` policy back to `draft`.

### 3.1 List policies

**`GET /policies`**

Query parameters (all optional):

| Parameter         | Type    | Default | Description                                                                                                                                                                                                                                                                                                                                                                                                  |
| ----------------- | ------- | ------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `status`          | string  | none    | Filter by `draft`, `published`, `active`, `paused`, `closed`, or `archived`. Citizens cannot see `draft`, `published`, `closed`, or `archived`; they see only `active` and `paused`.                                                                                                                                                                                                                         |
| `includeArchived` | boolean | false   | **For planners and admins only.** If `true`, archived policies are included in the results (unless a specific `status` filter excludes them). Default `false` (archived policies hidden from normal lists).                                                                                                                                                                                                  |
| `region`          | string  | none    | Filter by target region (planners/admins only).                                                                                                                                                                                                                                                                                                                                                              |
| `owner`           | string  | none    | **Planners only.** Use `owner=me` to see only policies owned by the logged‑in planner (any status). Without this, planners see their own policies (all statuses) **plus** other planners' `active`, `paused`, and `closed` policies. **Other planners' draft and published policies are excluded** – they do not appear in the list.                                                                         |
| `topic`           | string  | none    | Filter policies by a topic (e.g., `?topic=Agriculture`). Can be used multiple times (`?topic=Agriculture&topic=Health`) to return policies that match **any** of the given topics. Topics are stored in the policy's `topics` array (set during creation, optionally via AI suggestion). Works for all roles but respects visibility rules (e.g., citizens only see active/paused policies in their region). |
| `page`            | integer | 1       | Page number (1‑based).                                                                                                                                                                                                                                                                                                                                                                                       |
| `limit`           | integer | 20      | Items per page (max 100).                                                                                                                                                                                                                                                                                                                                                                                    |

**Archived policies** are hidden from `GET /policies` by default for all roles, including admin and policy owners. To include them, use `?includeArchived=true` or request `?status=archived`. Citizens never see archived policies.

**Topic filter** – The `topics` array is populated when the policy is created (planner can manually select topics or use the AI suggestion endpoint `/policies/suggest-topics`). The filter uses `$in` logic: if any of the requested topics matches a policy’s topic, the policy is included.

**Response (200 OK):**

```json
{
  "status": "success",
  "data": {
    "policies": [
      {
        "id": "67f1a2b3c4d5e6f7a8b9c0d1",
        "title": "Clean Water Initiative",
        "description": "Improving access to clean water in rural areas",
        "policyCode": "CLEAN123",
        "targetRegions": ["Addis Ababa", "Oromia"],
        "startDate": "2026-05-01T00:00:00Z",
        "endDate": "2026-06-30T23:59:59Z",
        "status": "active",
        "pollType": "rating",
        "averageRating": 0,
        "totalVotes": 0
      }
    ],
    "total": 10,
    "page": 1
  },
  "message": "Policies retrieved successfully",
  "timestamp": "2026-05-09T12:00:00Z"
}
```

### 3.2 Get single policy

**`GET /policies/:id`**

**Path parameter:**

| Parameter | Type   | Description                  |
| --------- | ------ | ---------------------------- |
| `id`      | string | Policy ID (MongoDB ObjectId) |

**Access rules:** Same as visibility table.

**Response (200 OK):**

```json
{
  "status": "success",
  "data": {
    "id": "67f1a2b3c4d5e6f7a8b9c0d1",
    "title": "Clean Water Initiative",
    "description": "Improving access to clean water in rural areas",
    "policyCode": "CLEAN123",
    "targetRegions": ["Addis Ababa", "Oromia"],
    "startDate": "2026-05-01T00:00:00Z",
    "endDate": "2026-06-30T23:59:59Z",
    "status": "active",
    "pollType": "multipleChoice",
    "pollOptions": [
      { "id": "edu", "text": "Education", "shortCode": "1" },
      { "id": "health", "text": "Healthcare", "shortCode": "2" }
    ],
    "maxSelections": 2,
    "likertLabels": [
      "Very Dissatisfied",
      "Dissatisfied",
      "Neutral",
      "Satisfied",
      "Very Satisfied"
    ],
    "rankedChoiceMaxRank": 3,
    "relevanceFactors": {
      "women": false,
      "youth": true,
      "farmers": false,
      "urban": false,
      "rural": false,
      "privateSector": false,
      "government": false
    },
    "citizenAnalyticsVisibility": {
      "showResults": true,
      "showBreakdown": false,
      "showComments": false,
      "showSentiment": false,
      "allowTimeFilter": false
    },
    "topics": ["Water", "Infrastructure"],
    "createdBy": "planner@example.com",
    "createdAt": "2026-05-01T10:00:00Z"
  },
  "message": "Policy retrieved successfully",
  "timestamp": "2026-05-09T12:00:00Z"
}
```

**Error responses (404):** Policy not found (or hidden due to visibility rules).

### 3.3 Create policy

**`POST /policies`**

**Roles:** planner, admin
**Request body:**

```json
{
  "title": "Binary Test 2026",
  "description": "Vote yes/no",
  "targetRegions": ["Addis Ababa"],
  "startDate": "2026-06-01T00:00:00Z",
  "endDate": "2026-12-31T23:59:59Z",
  "pollType": "binary", // one of: binary, multipleChoice, likert, approval, rating, rankedChoice
  "pollOptions": [
    // required for multipleChoice and rankedChoice
    { "id": "opt1", "text": "Option 1", "shortCode": "1" }
  ],
  "maxSelections": 1, // for multipleChoice
  "likertLabels": [
    // for likert, 5 strings
    "Very Dissatisfied",
    "Dissatisfied",
    "Neutral",
    "Satisfied",
    "Very Satisfied"
  ],
  "rankedChoiceMaxRank": 3, // for rankedChoice
  "relevanceFactors": {
    // all default false
    "women": false,
    "youth": true,
    "farmers": false,
    "urban": false,
    "rural": false,
    "privateSector": false,
    "government": false
  },
  "citizenAnalyticsVisibility": {
    "showResults": true,
    "showBreakdown": false,
    "showComments": false,
    "showSentiment": false,
    "allowTimeFilter": false
  },
  "topics": ["Agriculture", "Water"]
}
```

**Response (201 Created):**

```json
{
  "status": "success",
  "data": { "id": "67f1a2b3...", "policyCode": "CLEAN123" },
  "message": "Policy created as draft. You can edit it before activating.",
  "timestamp": "..."
}
```

**Error responses:**

| Status | Code               | Message                                                                            |
| ------ | ------------------ | ---------------------------------------------------------------------------------- |
| 400    | `VALIDATION_ERROR` | `"Missing required fields: title, description, targetRegions, startDate, endDate"` |
| 400    | `VALIDATION_ERROR` | `"Start date cannot be in the past."`                                              |
| 400    | `VALIDATION_ERROR` | `"Start date must be before end date"`                                             |
| 400    | `VALIDATION_ERROR` | `"multipleChoice requires pollOptions and maxSelections >=1"`                      |
| 400    | `VALIDATION_ERROR` | `"likertLabels must have exactly 5 strings"`                                       |
| 409    | `DUPLICATE_ENTRY`  | `"Policy code already exists"` (rare)                                              |
| 500    | `INTERNAL`         | `"Failed to create policy"`                                                        |

### 3.4 Update policy (draft only)

**`PUT /policies/:id`**

**Roles:** policy owner (planner) or admin  
**Condition:** Policy status must be `draft`.

**Request body:** same fields as create (all optional). Partial updates allowed.

**Response (200 OK):** returns the updated policy object (same shape as `GET /policies/:id`).

**Error responses:**

| Status | Code               | Message                                                  |
| ------ | ------------------ | -------------------------------------------------------- |
| 400    | `VALIDATION_ERROR` | `"Start date cannot be in the past."`                    |
| 400    | `VALIDATION_ERROR` | `"Start date must be before end date"`                   |
| 403    | `FORBIDDEN`        | `"Only draft policies can be edited."`                   |
| 403    | `FORBIDDEN`        | `"You do not have permission to edit this policy"`       |
| 404    | `NOT_FOUND`        | `"Policy not found"` (or hidden due to visibility rules) |

### 3.5 Publish policy (draft → published/active)

**`PATCH /policies/:id/publish`**

**Roles:** policy owner (planner) or admin  
**Condition:** Policy status must be `draft`.

**Behaviour:**

- If current date is within `startDate` and `endDate` → status becomes `active` immediately.
- If current date is before `startDate` → status becomes `published` (auto‑activation will happen later).
- If current date is after `endDate` → error (cannot publish ended policy).

**Response (200 OK):**

```json
{
  "status": "success",
  "data": { "id": "...", "status": "active" },
  "message": "Policy activated immediately because its start date has already passed.",
  "timestamp": "..."
}
```

**Error responses:**

| Status | Code               | Message                                                       |
| ------ | ------------------ | ------------------------------------------------------------- |
| 400    | `VALIDATION_ERROR` | `"Only draft policies can be published. Current status: ..."` |
| 400    | `VALIDATION_ERROR` | `"Cannot publish a policy that has already ended."`           |
| 403    | `FORBIDDEN`        | `"You do not have permission to publish this policy"`         |
| 404    | `NOT_FOUND`        | `"Policy not found"`                                          |

### 3.6 Unpublish policy (published → draft)

**`PATCH /policies/:id/unpublish`**

**Roles:** policy owner (planner) or admin  
**Condition:** Policy status must be `published`.

**Response (200 OK):**

```json
{
  "status": "success",
  "data": { "id": "...", "status": "draft" },
  "message": "Policy unpublished and moved back to draft.",
  "timestamp": "..."
}
```

### 3.7 Pause policy (active → paused)

**`PATCH /policies/:id/pause`**

**Roles:** policy owner (planner) or admin  
**Condition:** Policy status must be `active`.

**Response (200 OK):**

```json
{
  "status": "success",
  "data": { "id": "...", "status": "paused" },
  "message": "Policy paused. Voting temporarily disabled.",
  "timestamp": "..."
}
```

### 3.8 Resume policy (paused → active)

**`PATCH /policies/:id/resume`**

**Roles:** policy owner (planner) or admin  
**Condition:** Policy status must be `paused`. Current date must be within `startDate` and `endDate`.

**Response (200 OK):**

```json
{
  "status": "success",
  "data": { "id": "...", "status": "active" },
  "message": "Policy resumed. Voting enabled.",
  "timestamp": "..."
}
```

### 3.9 Close policy (active/paused → closed)

**`POST /policies/:id/close`**

**Roles:** policy owner (planner) or admin  
**Condition:** Policy status must be `active` or `paused`.

**Response (200 OK):**

```json
{
  "status": "success",
  "data": { "id": "...", "status": "closed" },
  "message": "Policy closed successfully. No more votes will be accepted.",
  "timestamp": "..."
}
```

### 3.10 Extend policy end date

**`PATCH /policies/:id/extend`**

**Roles:** policy owner (planner) or admin  
**Condition:** Policy status must be `active` or `paused`.

**Request body:**

```json
{ "newEndDate": "2026-07-31T23:59:59Z" }
```

**Response (200 OK):**

```json
{
  "status": "success",
  "data": { "id": "...", "endDate": "2026-07-31T23:59:59Z" },
  "message": "Policy end date updated successfully.",
  "timestamp": "..."
}
```

**Error responses:**

| Status | Code               | Message                                                |
| ------ | ------------------ | ------------------------------------------------------ |
| 400    | `VALIDATION_ERROR` | `"newEndDate must be after start date"`                |
| 400    | `VALIDATION_ERROR` | `"New end date cannot be in the past"`                 |
| 403    | `FORBIDDEN`        | `"Only active or paused policies can change end date"` |

### 3.11 Delete policy (draft or published only)

**`DELETE /policies/:id`**

**Roles:** policy owner (planner) or admin  
**Condition:** Policy status must be `draft` or `published` (not `active`, `paused`, or `closed`).

**Response (200 OK):**

```json
{
  "status": "success",
  "data": null,
  "message": "Policy deleted successfully",
  "timestamp": "..."
}
```

### 3.12 Clone policy

**`POST /policies/:id/clone`**

**Roles:** planner or admin (any policy they can view)

**Behaviour:**

- Creates a new draft policy as a copy of the original.
- Title becomes `original.title + " (Copy)"` (truncated to 200 chars).
- A fresh, unique policy code is generated.
- The logged‑in user becomes the `createdBy` owner.
- All fields (pollType, pollOptions, relevanceFactors, etc.) are copied.
- Status set to `draft`.

**Response (201 Created):**

```json
{
  "status": "success",
  "data": { "id": "...", "policyCode": "NEWCODE" },
  "message": "Policy cloned successfully. Edit the copy before activating.",
  "timestamp": "..."
}
```

### 3.13 Archive a policy (soft delete)

**`PATCH /policies/:id/archive`**

**Roles:** policy owner (planner) or admin  
**Condition:** Policy status must **not** be `draft` (draft policies cannot be archived – they can be deleted instead).  
**Behaviour:**

- Changes policy `status` to `archived`.
- Sets `archivedAt` to current time.
- Records `archivedBy` (user ID) and `archivedByRole` (`planner` or `admin`).
- Normal policy listings (`GET /policies`) exclude archived policies by default (for all roles, including owner and admin). Use `?includeArchived=true` or `?status=archived` to see them.
- No new votes or comments can be submitted (same as closed).
- The archived policy is **not deleted** – all votes, comments, and analytics remain accessible to authorised users for historical reporting.

**Response (200 OK):**

```json
{
  "status": "success",
  "data": { "id": "...", "status": "archived" },
  "message": "Policy archived successfully",
  "timestamp": "..."
}
```

**Error responses:**

| Status | Code               | Message                                                             |
| ------ | ------------------ | ------------------------------------------------------------------- |
| 400    | `VALIDATION_ERROR` | `"Draft policies cannot be archived. You can delete them instead."` |
| 400    | `VALIDATION_ERROR` | `"Policy is already archived"`                                      |
| 403    | `FORBIDDEN`        | `"You do not have permission to archive this policy"`               |
| 404    | `NOT_FOUND`        | `"Policy not found"`                                                |

### 3.14 Restore an archived policy

**`PATCH /policies/:id/restore`**

**Roles:**

- If archived by **admin** → only an admin can restore.
- If archived by **original owner** → the owner or an admin can restore.

**Behaviour:**

- Changes policy `status` back to `draft`.
- Clears `archivedAt`, `archivedBy`, `archivedByRole`.
- The policy becomes editable again (draft) and must be re‑published and activated to accept votes.

**Response (200 OK):**

```json
{
  "status": "success",
  "data": { "id": "...", "status": "draft" },
  "message": "Policy restored to draft",
  "timestamp": "..."
}
```

**Error responses:**

| Status | Code               | Message                                                                        |
| ------ | ------------------ | ------------------------------------------------------------------------------ |
| 400    | `VALIDATION_ERROR` | `"Only archived policies can be restored"`                                     |
| 403    | `FORBIDDEN`        | `"This policy was archived by an admin and can only be restored by an admin."` |
| 403    | `FORBIDDEN`        | `"You do not have permission to restore this policy"`                          |
| 404    | `NOT_FOUND`        | `"Policy not found"`                                                           |

### 3.15 Policy history

**`GET /policies/:id/history`**

**Roles:** policy owner (planner) or admin

**Response (200 OK):**

```json
{
  "status": "success",
  "data": {
    "events": [
      {
        "action": "CREATE_POLICY",
        "userId": "67f1a2b3...",
        "userRole": "planner",
        "details": {
          "title": "Clean Water Initiative",
          "policyCode": "CLEAN123"
        },
        "timestamp": "2026-05-01T10:00:00Z"
      },
      {
        "action": "ACTIVATE_POLICY",
        "userId": "67f1a2b3...",
        "userRole": "planner",
        "details": { "policyCode": "CLEAN123" },
        "timestamp": "2026-05-02T11:00:00Z"
      }
    ]
  },
  "message": "Policy history retrieved successfully",
  "timestamp": "..."
}
```

### 3.16 Suggest topics for a policy (AI‑assisted)

**`POST /policies/suggest-topics`**

**Roles:** planner, admin

**Request body:**

```json
{
  "text": "የጤና አገልግሎት ማሻሻል አስፈላጊ ነው"
}
```

| Field  | Type   | Required | Description                                             |
| ------ | ------ | -------- | ------------------------------------------------------- |
| `text` | string | yes      | Policy title + description (or any text, min 10 chars). |

**Response (200 OK):**

```json
{
  "status": "success",
  "data": {
    "topics": [
      { "topic": "Health", "confidence": 0.417 },
      { "topic": "Poverty Reduction", "confidence": 0.162 },
      { "topic": "Infrastructure", "confidence": 0.144 }
    ]
  },
  "message": "Topics suggested",
  "timestamp": "..."
}
```

**Behaviour:**

- Calls the AI service (`vicgalle/xlm-roberta-large-xnli-anli`) which understands Amharic, Oromo, Tigrinya, English.
- Returns up to 3 topic suggestions from a predefined list of 30+ policy‑oriented topics.
- Confidence scores range from 0 to 1 (higher = more confident).

**Error responses:**

| Status | Code                    | Message                                                     |
| ------ | ----------------------- | ----------------------------------------------------------- |
| 400    | `VALIDATION_ERROR`      | `"Text must be at least 10 characters"`                     |
| 503    | `AI_FAILED`             | `"AI service unavailable"` (returns fallback `["General"]`) |
| 500    | `INTERNAL_SERVER_ERROR` | `"Failed to get topic suggestions"`                         |

**Integration tip:** After receiving suggestions, the planner can accept/edit them and send the chosen topics via `PUT /policies/:id` (see 3.4). The `topics` array stored in the policy is then used for search (`?topic=Health`) and the personalised feed.

## 4. Voting & Comment Endpoints

All endpoints in this section require authentication with a valid JWT token (citizen, planner, or admin as noted).

### 4.1 Submit a vote (supports all poll types)

**`POST /votes`**

**Roles:** citizen  
**Rate limit:** 30 votes per hour per user (already in global table)

**Request body:**

```json
    {
      "policyId": "67f1a2b3c4d5e6f7a8b9c0d1",
      "value": ... ,   // format depends on pollType (see table below)
      "comment": "Optional comment (max 2000 characters)"
    }
```

**`value` formats per poll type**

| Poll Type        | `value` format                                                                  | Example                    |
| ---------------- | ------------------------------------------------------------------------------- | -------------------------- |
| `binary`         | `"yes"` or `"no"`                                                               | `"yes"`                    |
| `multipleChoice` | Array of option IDs (strings)                                                   | `["opt1", "opt3"]`         |
| `likert`         | Integer 1‑5                                                                     | `4`                        |
| `approval`       | `"approve"`, `"reject"`, or `"abstain"`                                         | `"approve"`                |
| `rating`         | Integer 1‑5                                                                     | `5`                        |
| `rankedChoice`   | Array of option IDs in order of preference (max length = `rankedChoiceMaxRank`) | `["opt2", "opt1", "opt3"]` |

**Note:** `policyId` must be a valid MongoDB ObjectId. Invalid IDs return `400 VALIDATION_ERROR`.

**Response (201 Created):**

```json
{
  "status": "success",
  "data": {
    "voteId": "67f1a2b3...",
    "commentId": "67f1a2b3...", // or null if no comment provided
    "value": "yes"
  },
  "message": "Vote recorded successfully",
  "timestamp": "..."
}
```

**Error responses:**

| Status | Code                    | Message                                                              |
| ------ | ----------------------- | -------------------------------------------------------------------- |
| 400    | `VALIDATION_ERROR`      | `"Invalid vote value for poll type binary"` (or other type mismatch) |
| 400    | `VALIDATION_ERROR`      | `"Comment too long (max 2000 characters)"`                           |
| 403    | `NOT_VERIFIED`          | `"Please verify your phone number first"`                            |
| 403    | `FORBIDDEN`             | `"Voting is temporarily paused for this policy"` (status = `paused`) |
| 403    | `FORBIDDEN`             | `"This policy is closed for voting"` (status = `closed`)             |
| 404    | `NOT_FOUND`             | `"Policy not found"` (or policy is not `active`/`paused`)            |
| 409    | `ALREADY_VOTED`         | `"You have already voted on this policy"`                            |
| 429    | `RATE_LIMIT_EXCEEDED`   | `"Too many votes. Please wait X minutes."`                           |
| 500    | `INTERNAL_SERVER_ERROR` | `"Failed to submit vote"`                                            |

---

### 4.2 Post a comment (top‑level or reply)

**`POST /comments`**

**Roles:** citizen, planner, admin  
**Rate limit:** 10 per minute per user

**Request body:**

```json
{
  "policyId": "67f1a2b3c4d5e6f7a8b9c0d1",
  "parentCommentId": null, // or an existing comment ID to reply to
  "text": "This is a comment (1‑2000 characters)"
}
```

**Behaviour:**

- Top‑level comments (`parentCommentId` = `null`):
  - Created with `visibility = "visible"`, `moderationStatus = "pending_ai"`, `moderationReason = "pending_ai"`.
  - AI worker processes sentiment and keywords asynchronously.
  - After AI: high confidence → `moderationStatus = "none"`; low confidence → `moderationStatus = "needs_review"`, `moderationReason = "low_confidence"`. Comment remains visible.
- Replies (`parentCommentId` provided):
  - Created with `visibility = "visible"`, `moderationStatus = "none"`, `moderationReason = null`. No AI processing.
  - Parent comment author receives in‑app notification (`type: "COMMENT_REPLY"`).
- Profanity filter: if blocked, `visibility = "hidden"`, `hiddenReason = "profanity"`, `moderationStatus = "needs_review"`, `moderationReason = "moderator_flag"`.

**Note:** `policyId` and `parentCommentId` (if provided) must be valid MongoDB ObjectIds. Invalid IDs return `400 VALIDATION_ERROR`.

**Response (201 Created):**

```json
{
  "status": "success",
  "data": { "commentId": "67f1a2b3..." },
  "message": "Comment posted",
  "timestamp": "..."
}
```

---

### 4.3 Get comments for a policy (public)

**`GET /comments/policy/:policyId`**

**Roles:** citizen, planner, admin (all authenticated)

Returns top‑level comments that are visible to citizens (i.e., `visibility = "visible"`). Includes the `isEdited` flag. Replies are not included; fetch them via the analytics endpoint if needed.

**Path parameter:**

| Parameter  | Type   | Description                |
| ---------- | ------ | -------------------------- |
| `policyId` | string | MongoDB ObjectId of policy |

**Query parameters (all optional):**

| Parameter | Type    | Default | Description              |
| --------- | ------- | ------- | ------------------------ |
| `page`    | integer | 1       | Page number (1‑based)    |
| `limit`   | integer | 20      | Items per page (max 100) |

**Response (200 OK):**

```json
{
  "status": "success",
  "data": {
    "comments": [
      {
        "id": "67f1a2b3...",
        "text": "Excellent policy!",
        "sentiment": "positive",
        "keywords": ["excellent"],
        "isOfficialReply": false,
        "createdAt": "2026-05-12T10:00:00Z",
        "userId": "67f1a2b3...",
        "isEdited": false
      }
    ],
    "total": 1,
    "page": 1
  },
  "message": "Comments retrieved",
  "timestamp": "..."
}
```

**Note:** Reported or hidden comments are excluded.

### 4.4 Get a single comment by ID

**`GET /comments/:id`**

**Roles:** citizen, planner, admin (all authenticated)

Returns a comment by its ID. Citizens can see only comments with `visibility = "visible"`. Planners and admins see all fields (including `reportCount`, `moderationStatus`, `moderationReason`).

**Path parameter:**

| Parameter | Type   | Description                 |
| --------- | ------ | --------------------------- |
| `id`      | string | MongoDB ObjectId of comment |

**Response (200 OK) – for citizen:**

```json
{
  "status": "success",
  "data": {
    "id": "67f1a2b3...",
    "text": "Great idea!",
    "sentiment": "positive",
    "keywords": ["great"],
    "isOfficialReply": false,
    "createdAt": "2026-05-12T10:00:00Z",
    "userId": "67f1a2b3...",
    "isEdited": false,
    "parentCommentId": null
  },
  "message": "Comment retrieved",
  "timestamp": "..."
}
```

**Response for planner/admin (additional fields):**

```json
    {
      "status": "success",
      "data": {
        ... (same citizen fields) ...
        "reportCount": 2,
        "moderationStatus": "needs_review",
        "moderationReason": "low_confidence",
        "parentCommentId": null
      },
      "message": "Comment retrieved",
      "timestamp": "..."
    }
```

**Error responses:**

| Status | Code        | Message                        |
| ------ | ----------- | ------------------------------ |
| 404    | `NOT_FOUND` | `"Comment not found"`          |
| 500    | `INTERNAL`  | `"Failed to retrieve comment"` |

---

### 4.4.1 Get replies for a comment

**`GET /comments/:commentId/replies`**

**Roles:** citizen, planner, admin (all authenticated)

Returns all replies to a specific comment. Only returns replies with `visibility = "visible"` for citizens. Supports pagination.

**Path parameter:**

| Parameter   | Type   | Description                        |
| ----------- | ------ | ---------------------------------- |
| `commentId` | string | MongoDB ObjectId of parent comment |

**Query parameters (all optional):**

| Parameter | Type    | Default | Description              |
| --------- | ------- | ------- | ------------------------ |
| `page`    | integer | 1       | Page number (1‑based)    |
| `limit`   | integer | 20      | Items per page (max 100) |

**Response (200 OK):**

```json
{
  "status": "success",
  "data": {
    "replies": [
      {
        "id": "67f1a2b3...",
        "text": "I agree with this comment!",
        "sentiment": "positive",
        "keywords": ["agree"],
        "isOfficialReply": false,
        "createdAt": "2026-05-12T11:00:00Z",
        "userId": "67f1a2b4...",
        "userEmail": "user@example.com",
        "isEdited": false,
        "parentCommentId": "67f1a2b3...",
        "policyId": "67f1a2b5...",
        "visibility": "visible",
        "moderationStatus": "none"
      }
    ],
    "total": 3,
    "page": 1
  },
  "message": "Replies retrieved",
  "timestamp": "..."
}
```

**Error responses:**

| Status | Code        | Message                        |
| ------ | ----------- | ------------------------------ |
| 404    | `NOT_FOUND` | `"Parent comment not found"`   |
| 500    | `INTERNAL`  | `"Failed to retrieve replies"` |

**Note:** Replies are returned in chronological order (oldest first). The `parentCommentId` field in each reply matches the requested `commentId`.

---

### 4.5 Report a comment

**`POST /comments/:commentId/report`**

**Roles:** any authenticated user  
**Rate limit:** 5 reports per minute per user

**Path parameter:** `commentId`

**Request body:**

    { "reason": "spam" } // one of: spam, hate speech, off‑topic, other

**Behaviour:**

- Increments `reportCount`.
- When `reportCount >= 3`:
  - `visibility = "hidden"`, `hiddenReason = "reports"`.
  - `moderationStatus = "needs_review"`, `moderationReason = "reports"`.
  - Takes a `flaggedSnapshot` (text, sentiment, keywords, timestamp, reportCountAtCapture) – immutable.
  - Notifies policy owner and associates with `moderate_comments` (`type: "COMMENT_FLAGGED"`).

**Response (200 OK):**

```json
{
  "status": "success",
  "data": null,
  "message": "Comment reported. Moderators will review.",
  "timestamp": "..."
}
```

---

### 4.6 Moderate a comment

**`PUT /comments/:commentId/moderate`**

**Roles:** policy owner, associate with `moderate_comments`, or admin  
**Rate limit:** 30 per minute per user

**Path parameter:** `commentId`

**Request body:**

```json
{
  "action": "approve", // or "delete", "retry"
  "sentiment": { "label": "positive", "confidence": 0.95 }, // optional
  "keywords": ["water", "access"] // optional
}
```

**Actions:**

- `approve`: sets `visibility = "visible"`, `hiddenReason = null`, `moderationStatus = "reviewed"`, `moderationReason = null`. If hidden due to reports, becomes visible again.
- `delete`: sets `visibility = "hidden"`, `hiddenReason = "moderator"`, `moderationStatus = "none"`, `moderationReason = null`. Text replaced with `"[deleted by moderator]"`.
- `retry`: sets `moderationStatus = "pending_ai"`, `moderationReason = "pending_ai"`, resets `retryCount` and `nextRetry`. Only for `needs_review` comments.

**Note:** Moderators cannot edit the original text – only the author (see 4.9).

**Response (200 OK):**

```json
{
  "status": "success",
  "data": { "commentId": "...", "action": "approved" },
  "message": "Comment approved.",
  "timestamp": "..."
}
```

### 4.7 Appeal a moderation decision (citizen)

**`POST /comments/:commentId/appeal`**

**Roles:** only the original author of the comment  
**Rate limit:** 3 appeals per day per user

**Path parameter:** `commentId`

**Request body:**

```json
{ "reason": "The comment was not offensive. Please reinstate." }
```

**Behaviour:**

- Allowed only for comments with `visibility = "hidden"` and `moderationStatus = "needs_review"`.
- Creates embedded `appeal` object with status `pending`.
- Notifies policy owner (`type: "COMMENT_APPEAL"`).

**Response (200 OK):**

```json
{
  "status": "success",
  "data": null,
  "message": "Appeal submitted. The policy maker will review.",
  "timestamp": "..."
}
```

### 4.8 Resolve an appeal

**`POST /comments/:commentId/resolve-appeal`**

**Roles:** policy owner (planner) or admin

**Path parameter:** `commentId`

**Request body:**

```json
{
  "decision": "approve", // or "reject"
  "note": "After review, the comment is acceptable."
}
```

**Behaviour:**

- If `approve`: `visibility = "visible"`, `hiddenReason = null`, `moderationStatus = "reviewed"`, `moderationReason = null`. `appeal.status = "resolved_approved"`.
- If `reject`: `visibility` stays `"hidden"`, `moderationStatus` stays `"needs_review"`. `appeal.status = "resolved_rejected"`.
- Notifies comment author (`type: "APPEAL_RESOLVED"`).

**Response (200 OK):**

```json
{
  "status": "success",
  "data": null,
  "message": "Appeal approved. Comment status updated.",
  "timestamp": "..."
}
```

### 4.9 Edit a comment (author only)

**`PUT /comments/:id`**

**Roles:** only the original author  
**Rate limit:** 10 per minute per user (same as posting)

**Path parameter:** `id`

**Request body:**

```json
{
  "text": "Updated comment text (1‑2000 characters)"
}
```

**Behaviour:**

- Saves previous version (text, sentiment, keywords, timestamp) into `editedHistory` (max 3 entries).
- For **top‑level comments**: sets `moderationStatus = "pending_ai"`, `moderationReason = "pending_ai"`, clears `sentiment` and `keywords`. AI worker re‑analyses.
- For **replies**: no change to `moderationStatus` (remains `"none"`).
- Updated text immediately visible.

**Response (200 OK):**

```json
{
  "status": "success",
  "data": { "commentId": "..." },
  "message": "Comment updated",
  "timestamp": "..."
}
```

### 4.10 Get comment edit history

**`GET /comments/:id/history`**

**Roles:** planner or admin only (citizens cannot access previous versions)  
**Rate limit:** same as global API limit (100 per 15 minutes per IP)

**Path parameter:**

| Parameter | Type   | Description |
| --------- | ------ | ----------- |
| `id`      | string | Comment ID  |

**Response (200 OK):**

```json
{
  "status": "success",
  "data": {
    "history": [
      {
        "text": "Original text",
        "sentiment": { "label": "neutral", "confidence": 0.98 },
        "keywords": ["original"],
        "editedAt": "2026-05-10T10:00:00Z"
      }
    ]
  },
  "message": "Edit history retrieved",
  "timestamp": "..."
}
```

**Error responses:**

| Status | Code        | Message                                        |
| ------ | ----------- | ---------------------------------------------- |
| 403    | `FORBIDDEN` | `"Only planners/admins can view edit history"` |
| 404    | `NOT_FOUND` | `"Comment not found"`                          |

## 5. Analytics Endpoints

**Roles required:** planner or admin (all endpoints in this section)

**Access rules for analytics endpoints (all endpoints under /analytics):**

- For **draft** or **published** policies:
  - The **policy owner** (planner who created it) can access analytics (but will receive a 400 error with message "Policy is not active yet (no analytics available)").
  - Any **other planner** receives a 404 Not Found (the policy is hidden).

- For **active**, **paused**, or **closed** policies:
  - The **policy owner** has full access.
  - Any **associate** (planner assigned via `/planners/policies/:policyId/associates`) with the `view_analytics` permission has access to all analytics endpoints (including export if `export_data` is also granted).
  - Any **other planner** (not owner, not associate) receives a 404 Not Found.

- **Admins** always have full access to all analytics, regardless of policy status or ownership.

**Note for associates:** To grant an associate access to a specific analytics endpoint, they must have the corresponding permission (`view_analytics` for viewing, `export_data` for CSV export). The permissions are checked by the middleware before the request is processed.

---

### 5.1 Policy analytics (summary)

**`GET /analytics/:policyId`**

Returns a snapshot of voting metrics for a single policy, including sentiment counts and top keywords from comments. Supports filtering by date range, demographics, and region.

**Query parameters (all optional):**

| Parameter    | Type   | Description                                                                                     |
| ------------ | ------ | ----------------------------------------------------------------------------------------------- |
| `startDate`  | string | ISO date (e.g., `2026-04-01`). Filters votes & comments created on or after this date.          |
| `endDate`    | string | ISO date. Filters votes & comments created on or before this date.                              |
| `gender`     | string | `male`, `female`, `non-binary`, `prefer-not-to-say`                                             |
| `ageRange`   | string | `18-24`, `25-34`, `35-44`, `45-54`, `55+`                                                       |
| `occupation` | string | `student`, `farmer`, `merchant`, `government-employee`, `private-sector`, `unemployed`, `other` |
| `education`  | string | `no-formal`, `primary`, `secondary`, `diploma`, `bachelors`, `postgraduate`                     |
| `region`     | string | Region name (e.g., `Addis Ababa`)                                                               |

**Response (200 OK) – example for `binary` policy:**

```json
{
  "status": "success",
  "data": {
    "policyId": "67f1a2b3c4d5e6f7a8b9c0d1",
    "title": "Binary Test 2026",
    "pollType": "binary",
    "totalVotes": 1,
    "yesCount": 1,
    "noCount": 0,
    "yesPercentage": "100.0",
    "noPercentage": "0.0",
    "sentimentCounts": { "positive": 0, "negative": 0, "neutral": 0 },
    "topKeywords": []
  },
  "message": "Analytics retrieved successfully",
  "timestamp": "..."
}
```

**Response for `multipleChoice` policy:**

```json
    {
      "status": "success",
      "data": {
        "policyId": "...",
        "title": "Sector Funding",
        "pollType": "multipleChoice",
        "totalVotes": 100,
        "results": [
          { "id": "edu", "text": "Education", "count": 45, "percentage": "45.0" },
          { "id": "health", "text": "Healthcare", "count": 30, "percentage": "30.0" }
        ],
        "sentimentCounts": { ... },
        "topKeywords": [...]
      }
    }
```

**Response for `likert`/`rating` policy:**

```json
{
  "data": {
    "pollType": "rating",
    "totalVotes": 120,
    "average": 4.2,
    "distribution": { "1": 5, "2": 10, "3": 20, "4": 35, "5": 50 }
  }
}
```

**Response for `approval` policy:**

```json
{
  "data": {
    "pollType": "approval",
    "totalVotes": 80,
    "approveCount": 40,
    "rejectCount": 25,
    "abstainCount": 15,
    "approvePercentage": "50.0",
    "rejectPercentage": "31.2",
    "abstainPercentage": "18.8",
    "netApproval": 15
  }
}
```

**Response for `rankedChoice` policy (simplified):**

```json
{
  "data": {
    "pollType": "rankedChoice",
    "totalVotes": 60,
    "firstChoiceResults": [
      {
        "id": "opt1",
        "text": "Roads",
        "firstChoiceCount": 20,
        "percentage": "33.3"
      }
    ]
  }
}
```

---

### 5.2 Export analytics as CSV

**`GET /analytics/:policyId/export`**

Downloads raw vote data as CSV with demographic columns. Supports same filters as 5.1.

**Query parameters:** same as 5.1 (`startDate`, `endDate`, `gender`, `ageRange`, `occupation`, `education`, `region`).

**Response:** `text/csv` file attachment. Example content:

| voteId      | channel | value      | region      | ageRange | gender | occupation     | education | createdAt                |
| ----------- | ------- | ---------- | ----------- | -------- | ------ | -------------- | --------- | ------------------------ |
| 67f1a2b3... | app     | opt1\|opt2 | Addis Ababa | 25-34    | male   | private-sector | bachelors | 2026-05-09T01:05:48.370Z |

---

### 5.3 Get paginated comments (with filters)

**`GET /analytics/:policyId/comments`**

**Roles:** planner, admin

**Query parameters (all optional):**

| Parameter          | Type    | Default | Description                                                 |
| ------------------ | ------- | ------- | ----------------------------------------------------------- |
| `page`             | integer | 1       | Page number (1‑based)                                       |
| `limit`            | integer | 20      | Items per page (max 100)                                    |
| `visibility`       | string  | none    | `visible` or `hidden`                                       |
| `moderationStatus` | string  | none    | `pending_ai`, `needs_review`, `reviewed`, `none`            |
| `moderationReason` | string  | none    | `pending_ai`, `low_confidence`, `reports`, `moderator_flag` |
| `sentiment`        | string  | none    | `positive`, `negative`, `neutral`                           |
| `language`         | string  | none    | `am`, `om`, `ti`, `en`                                      |
| `parentCommentId`  | string  | none    | Filter replies to a specific top‑level comment              |
| `startDate`        | string  | none    | ISO date                                                    |
| `endDate`          | string  | none    | ISO date                                                    |

**Response (200 OK):**

```json
{
  "status": "success",
  "data": {
    "comments": [
      {
        "id": "67f1a2b3...",
        "text": "This policy is excellent!",
        "visibility": "visible",
        "moderationStatus": "none",
        "moderationReason": null,
        "sentiment": { "label": "positive", "confidence": 0.95 },
        "keywords": ["excellent"],
        "isOfficialReply": false,
        "reportCount": 0,
        "createdAt": "2026-05-09T01:17:31Z",
        "userEmail": "citizen@example.com",
        "isEdited": true
      }
    ],
    "total": 50,
    "page": 1
  },
  "message": "Comments retrieved successfully",
  "timestamp": "..."
}
```

**Note on `isEdited`:** True if `editedHistory` is non‑empty. Planners/admins can retrieve full history via `GET /comments/:id/history` (see 4.8).

---

### 5.4 Heatmap – geographic + time (single policy)

**`GET /analytics/heatmap`**

Aggregates votes over time and region for a specific policy, and includes **average sentiment** and **top keywords** from comments per bucket.

**Roles:** planner, admin

**Query parameters (all optional, except `policyId`):**

| Parameter    | Type    | Default      | Description                                                                                                                                                  |
| ------------ | ------- | ------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `policyId`   | string  | **required** | MongoDB ObjectId of the policy. Heatmap is per‑policy only.                                                                                                  |
| `startDate`  | string  | none         | ISO date. Filters votes and comments created on or after this date.                                                                                          |
| `endDate`    | string  | none         | ISO date. Filters votes and comments created on or before this date.                                                                                         |
| `interval`   | string  | `week`       | Grouping interval: `day`, `week`, or `month`.                                                                                                                |
| `byRegion`   | boolean | `false`      | If `true`, the response is grouped by region within each time bucket (geographic heatmap). If `false`, the response is a simple time series (global totals). |
| `regions`    | string  | none         | Comma‑separated list of region names, e.g., `Addis Ababa,Oromia`. Only applicable when `byRegion=true`.                                                      |
| `gender`     | string  | none         | Filter votes/comments by gender.                                                                                                                             |
| `ageRange`   | string  | none         | Filter by age range.                                                                                                                                         |
| `occupation` | string  | none         | Filter by occupation.                                                                                                                                        |
| `education`  | string  | none         | Filter by education.                                                                                                                                         |

**Response when `byRegion=false` (global time series):**

```json
{
  "status": "success",
  "data": {
    "interval": "week",
    "data": [
      {
        "period": "2026-19",
        "totalVotes": 8,
        "averageRating": 4.1,
        "yesPercentage": "62.5",
        "averageSentiment": 0.45,
        "topKeywords": [{ "keyword": "water", "count": 3 }]
      }
    ]
  },
  "message": "Heatmap retrieved",
  "timestamp": "..."
}
```

**Response when `byRegion=true` (geographic heatmap):**

```json
{
  "status": "success",
  "data": {
    "interval": "week",
    "data": [
      {
        "period": "2026-19",
        "region": "Addis Ababa",
        "totalVotes": 6,
        "averageRating": "4.50",
        "yesPercentage": "16.7",
        "averageSentiment": 0.82,
        "topKeywords": [{ "keyword": "access", "count": 5 }]
      }
    ]
  },
  "message": "Heatmap retrieved",
  "timestamp": "..."
}
```

**Note:** The fields returned depend on the policy’s `pollType`. For binary, `yesPercentage`; for rating/likert, `averageRating`; for multipleChoice, `topOptionId` and `topOptionPercentage`; for approval, `approvePercentage` and `netApproval`. Sentiment fields (`averageSentiment`, `topKeywords`) are always included.

---

### 5.5 Timeseries – trend over time with sentiment

**`GET /analytics/:policyId/timeseries`**

Returns time‑bucketed data for a single policy: vote metrics per bucket, plus **average sentiment score** and **top keywords** from comments in that bucket. Supports demographics and region filters.

**Roles:** planner, admin

**Query parameters (all optional):**

| Parameter    | Type   | Default | Description                                       |
| ------------ | ------ | ------- | ------------------------------------------------- |
| `bucket`     | string | `day`   | `hour`, `day`, `week`, or `month`                 |
| `startDate`  | string | none    | ISO date                                          |
| `endDate`    | string | none    | ISO date                                          |
| `gender`     | string | none    | Filter votes/comments by gender (using snapshot). |
| `ageRange`   | string | none    | Filter by age range.                              |
| `occupation` | string | none    | Filter by occupation.                             |
| `education`  | string | none    | Filter by education.                              |
| `region`     | string | none    | Region name (e.g., `Addis Ababa`).                |

**Response (200 OK) – for binary policy:**

```json
{
  "status": "success",
  "data": {
    "bucket": "week",
    "data": [
      {
        "bucket": "2026-19",
        "totalVotes": 5,
        "yesCount": 3,
        "noCount": 2,
        "yesPercentage": "60.0",
        "averageSentiment": 0.25,
        "topKeywords": [{ "keyword": "funding", "count": 2 }]
      }
    ]
  },
  "message": "Timeseries retrieved",
  "timestamp": "..."
}
```

**Response for rating/likert policy:**

```json
{
  "status": "success",
  "data": {
    "bucket": "week",
    "data": [
      {
        "bucket": "2026-19",
        "totalVotes": 10,
        "averageRating": 4.2,
        "averageSentiment": 0.75,
        "topKeywords": [{ "keyword": "good", "count": 4 }]
      }
    ]
  },
  "message": "Timeseries retrieved",
  "timestamp": "..."
}
```

**Response for multipleChoice policy (shows top option count per bucket):**

```json
{
  "status": "success",
  "data": {
    "bucket": "week",
    "data": [
      {
        "bucket": "2026-19",
        "totalVotes": 20,
        "options": [
          { "option": "opt1", "count": 12 },
          { "option": "opt2", "count": 8 }
        ],
        "averageSentiment": 0.12,
        "topKeywords": [{ "keyword": "roads", "count": 5 }]
      }
    ]
  },
  "message": "Timeseries retrieved",
  "timestamp": "..."
}
```

**Note:** For multipleChoice, the full option distribution is returned (`options` array). For approval, fields like `approveCount`, `rejectCount`, `abstainCount`, `approvePercentage` are included (not shown).

---

### 5.6 Correlation (for multipleChoice policies only)

**`GET /analytics/:policyId/correlation`**

**Roles:** planner, admin

**Query parameters:**

| Parameter    | Type    | Default | Description                            |
| ------------ | ------- | ------- | -------------------------------------- |
| `minSupport` | integer | 10      | Minimum co‑occurrence count to include |

**Response (200 OK):**

```json
{
  "status": "success",
  "data": {
    "correlations": [
      {
        "optionA": "edu",
        "optionB": "health",
        "coOccurrenceCount": 15,
        "percentage": "25.0"
      }
    ],
    "totalVotes": 100
  },
  "message": "Correlation matrix retrieved",
  "timestamp": "..."
}
```

---

### 5.7 Demographic breakdown – with sentiment

**`GET /analytics/:policyId/demographics`**

Returns a static comparison of a demographic dimension (age, gender, occupation, education, region) for a single policy, including vote metrics and **average sentiment** + **top keywords** for each group.

**Roles:** planner, admin

**Query parameters:**

| Parameter   | Type   | Required | Description (one of)                                      |
| ----------- | ------ | -------- | --------------------------------------------------------- |
| `dimension` | string | yes      | `ageRange`, `gender`, `occupation`, `education`, `region` |
| `startDate` | string | no       | ISO date                                                  |
| `endDate`   | string | no       | ISO date                                                  |

**Response (200 OK):**

```json
{
  "status": "success",
  "data": {
    "dimension": "ageRange",
    "data": [
      {
        "ageRange": "25-34",
        "totalVotes": 20,
        "averageRating": 4.2,
        "averageSentiment": 0.65,
        "topKeywords": [{ "keyword": "good", "count": 4 }]
      },
      {
        "ageRange": "35-44",
        "totalVotes": 12,
        "averageRating": 3.8,
        "averageSentiment": -0.1,
        "topKeywords": [{ "keyword": "expensive", "count": 2 }]
      }
    ]
  },
  "message": "Demographic breakdown retrieved",
  "timestamp": "..."
}
```

**Note:** For binary policies, the metric is `yesPercentage`; for multipleChoice, `topOptionId` and `topOptionPercentage`; for approval, `approvePercentage` and `netApproval`. Sentiment fields are always present.

---

### 5.8 Cross‑policy analytics (shared metrics)

**`GET /analytics/cross`**

Aggregates shared metrics (total votes, comments, sentiment counts, top keywords) across **multiple policies** filtered by topics, region, demographics, and date range. Does **not** include poll‑type‑specific metrics.

**Roles:** planner, admin

**Query parameters (all optional):**

| Parameter    | Type   | Description                                                                                                          |
| ------------ | ------ | -------------------------------------------------------------------------------------------------------------------- |
| `topics`     | string | Comma‑separated list of policy topics (e.g., `Agriculture,Health`). Policies must have at least one of these topics. |
| `region`     | string | Target region (e.g., `Addis Ababa`). Policies that target this region are included.                                  |
| `gender`     | string | Filter votes/comments by gender.                                                                                     |
| `ageRange`   | string | Filter by age range.                                                                                                 |
| `occupation` | string | Filter by occupation.                                                                                                |
| `education`  | string | Filter by education.                                                                                                 |
| `startDate`  | string | ISO date. Filters votes & comments created on or after this date.                                                    |
| `endDate`    | string | ISO date. Filters votes & comments created on or before this date.                                                   |

**Response (200 OK):**

```json
{
  "status": "success",
  "data": {
    "totalVotes": 1230,
    "totalComments": 340,
    "sentimentCounts": { "positive": 180, "negative": 90, "neutral": 70 },
    "topKeywords": [
      { "keyword": "education", "count": 45 },
      { "keyword": "funding", "count": 30 }
    ]
  },
  "message": "Cross‑policy analytics retrieved",
  "timestamp": "..."
}
```

**Error examples:**

| Status | Code                    | Message                                                        |
| ------ | ----------------------- | -------------------------------------------------------------- |
| 403    | `FORBIDDEN`             | `"Only planners and admins can access cross‑policy analytics"` |
| 500    | `INTERNAL_SERVER_ERROR` | `"Failed to retrieve cross‑policy analytics"`                  |

### 6.3 Comment Moderation

All endpoints in this section require the **Admin** role.

#### 6.3.1 Get comments needing review

**`GET /admin/comments/pending`**

Returns all comments where `moderationStatus = "needs_review"` (regardless of the reason: low confidence, reports, or manual flag).

**Query parameters:** none (pagination not needed for admin review, but you may add later).

**Response (200 OK):**

```json
{
  "status": "success",
  "data": {
    "comments": [
      {
        "_id": "67f1a2b3c4d5e6f7a8b9c0d1",
        "policyId": {
          "_id": "...",
          "title": "Clean Water Initiative"
        },
        "userId": {
          "_id": "...",
          "email": "citizen@example.com"
        },
        "text": "I think this policy needs more funding.",
        "visibility": "visible",
        "hiddenReason": null,
        "moderationStatus": "needs_review",
        "moderationReason": "low_confidence",
        "reportCount": 0,
        "flaggedSnapshot": null,
        "createdAt": "2026-05-09T10:00:00Z"
      }
    ]
  },
  "message": "Pending comments retrieved successfully",
  "timestamp": "..."
}
```

**Error responses:**

| Status | Code                    | Message                                      |
| ------ | ----------------------- | -------------------------------------------- |
| 403    | `FORBIDDEN`             | `"Access denied. Insufficient permissions."` |
| 500    | `INTERNAL_SERVER_ERROR` | `"Failed to retrieve pending comments"`      |

---

#### 6.3.2 Get comments flagged by reports

**`GET /admin/comments/flagged`**

Returns comments where `moderationReason = "reports"` and `moderationStatus = "needs_review"` (i.e., comments hidden because they reached the report threshold).

**Response:** Same shape as 6.3.1, but only comments with `moderationReason = "reports"`.

**Error responses:** same as 6.3.1.

---

#### 6.3.3 Update comment (manual override)

**`PUT /admin/comments/:id`**

Manually updates sentiment, keywords, or moderation flags of a comment. Cannot change the comment text or visibility – those are handled by moderation actions (approve/delete/retry) or by the author.

**Path parameter:**

| Parameter | Type   | Description |
| --------- | ------ | ----------- |
| `id`      | string | Comment ID  |

**Request body (fields optional):**

```json
{
  "sentiment": { "label": "positive", "confidence": 0.95 },
  "keywords": ["water", "access"],
  "moderationStatus": "reviewed",
  "moderationReason": null
}
```

**Valid values:**

- `sentiment.label`: `"positive"`, `"negative"`, `"neutral"`
- `sentiment.confidence`: number between 0 and 1
- `keywords`: array of strings
- `moderationStatus`: `"none"`, `"needs_review"`, `"reviewed"`
- `moderationReason`: `null`, `"low_confidence"`, `"reports"`, `"moderator_flag"`

**Response (200 OK):** returns the updated comment object (same structure as 6.3.1).

**Error responses:**

| Status | Code                    | Message                      |
| ------ | ----------------------- | ---------------------------- |
| 400    | `VALIDATION_ERROR`      | `"Invalid field value"`      |
| 404    | `NOT_FOUND`             | `"Comment not found"`        |
| 403    | `FORBIDDEN`             | `"Access denied"`            |
| 500    | `INTERNAL_SERVER_ERROR` | `"Failed to update comment"` |

---

#### 6.3.4 Retry a single comment (strict)

**`POST /admin/comments/:id/retry`**

Resets a comment to `pending_ai` status so the AI worker will re‑process it.  
**Eligibility:** Only comments that are `low_confidence`, `visible`, and `needs_review`.

**Path parameter:** `id` – Comment ID

**Behaviour:**

- Sets `moderationStatus = "pending_ai"`
- Sets `moderationReason = "pending_ai"`
- Resets `retryCount = 0` and `nextRetry = null`
- Sets `lastRetryTriggeredBy = "admin:<adminId>"`
- No change to `visibility` or `hiddenReason`.

**Response (200 OK):**

```json
{
  "status": "success",
  "data": { "commentId": "67f1a2b3..." },
  "message": "Comment queued for retry. AI worker will process it shortly.",
  "timestamp": "..."
}
```

**Error responses:**

| Status | Code                    | Message                                                              |
| ------ | ----------------------- | -------------------------------------------------------------------- |
| 400    | `VALIDATION_ERROR`      | `"Only comments in needs_review can be retried. Current: ..."`       |
| 400    | `VALIDATION_ERROR`      | `"Only low‑confidence comments can be retried. Current reason: ..."` |
| 400    | `VALIDATION_ERROR`      | `"Only visible comments can be retried."`                            |
| 404    | `NOT_FOUND`             | `"Comment not found"`                                                |
| 403    | `FORBIDDEN`             | `"Access denied"`                                                    |
| 500    | `INTERNAL_SERVER_ERROR` | `"Failed to queue comment for retry"`                                |

---

#### 6.3.5 Force retry a comment (any comment)

**`POST /admin/comments/:id/force-retry`**

Forces a comment to be re‑processed by the AI worker regardless of its current state (even if it is hidden or already approved).  
**No eligibility checks.** Use with caution.

**Path parameter:** `id` – Comment ID

**Behaviour:**

- Sets `moderationStatus = "pending_ai"`
- Sets `moderationReason = "pending_ai"`
- Resets `retryCount = 0` and `nextRetry = null`
- Sets `lastRetryTriggeredBy = "admin:<adminId>:force"` (suffix `:force` indicates forced retry)
- Does **not** change `visibility`, `hiddenReason`, or any other fields.

**Response (200 OK):**

```json
{
  "status": "success",
  "data": { "commentId": "..." },
  "message": "Comment force‑queued for AI reprocessing.",
  "timestamp": "..."
}
```

**Error responses:**

| Status | Code                    | Message                           |
| ------ | ----------------------- | --------------------------------- |
| 404    | `NOT_FOUND`             | `"Comment not found"`             |
| 403    | `FORBIDDEN`             | `"Access denied"`                 |
| 500    | `INTERNAL_SERVER_ERROR` | `"Failed to force‑retry comment"` |

---

#### 6.3.6 Bulk retry comments by IDs

**`POST /admin/comments/bulk/retry-by-ids`**

Retries multiple comments at once. Only comments that are `low_confidence`, `visible`, and `needs_review` will be retried; others are reported as failed.

**Rate limit:** 10 requests per minute per admin (limited by `bulkAdmin` rate limiter).

**Query parameter:** `?dryRun=true` – returns count of eligible comments without making changes.

**Request body:**

```json
    {
      "commentIds": ["67f1a2b3...", "67f1a2b4...", ...]
    }
```

**Response (200 OK):**

```json
{
  "status": "success",
  "data": {
    "succeeded": ["id2"],
    "failed": [
      {
        "id": "id1",
        "reason": "Comment not found or not eligible (must be visible, low‑confidence needs_review)"
      }
    ]
  },
  "message": "Bulk retry completed: 1 succeeded, 1 failed.",
  "timestamp": "..."
}
```

**Dry run response:**

```json
    {
      "status": "success",
      "data": {
        "totalMatched": 1,
        "failed": [ ... ]
      },
      "message": "Dry run: 1 comments would be retried.",
      "timestamp": "..."
    }
```

**Error responses:**

| Status | Code                    | Message                                    |
| ------ | ----------------------- | ------------------------------------------ |
| 400    | `VALIDATION_ERROR`      | `"commentIds array is required"`           |
| 400    | `VALIDATION_ERROR`      | `"At least one valid comment ID required"` |
| 429    | `RATE_LIMIT_EXCEEDED`   | `"Too many bulk requests. Please wait."`   |
| 500    | `INTERNAL_SERVER_ERROR` | `"Failed to process bulk retry"`           |

### 6.4 Admin Dashboard & Monitoring

#### 6.4.1 Dashboard statistics

**`GET /admin/dashboard/stats`**

Returns platform‑wide counts and AI health.

**Response (200 OK):**

```json
{
  "status": "success",
  "data": {
    "users": { "total": 22, "active": 22, "verified": 22 },
    "planners": { "total": 2, "active": 2 },
    "policies": { "total": 6, "draft": 0, "active": 5, "closed": 1 },
    "votes": { "total": 123, "app": 98, "sms": 25, "averageRating": 4.2 },
    "comments": { "total": 80, "pendingReview": 3, "processed": 77 },
    "aiHealth": { "status": "ok", "pendingComments": 3, "failedComments": 0 }
  },
  "message": "Dashboard statistics retrieved successfully",
  "timestamp": "..."
}
```

**Notes:**

- `comments.total` – total number of comments (including soft‑deleted).
- `comments.pendingReview` – number of comments with `moderationStatus = "needs_review"` (awaiting moderator attention).
- `comments.processed` – number of comments with `moderationStatus` in `["none", "reviewed"]` (already handled or needing no action).
- `aiHealth.status` – `"ok"` when AI service is reachable, otherwise `"unreachable"`.
- `aiHealth.pendingComments` – same as `comments.pendingReview` (cached from database).
- `aiHealth.failedComments` – number of `needs_review` comments that have failed AI retries more than 5 times.

#### 6.4.2 Platform trends

**`GET /admin/trends`**

Query parameters (all optional):

| Parameter  | Type    | Default | Description                         |
| ---------- | ------- | ------- | ----------------------------------- |
| `interval` | string  | `day`   | Grouping: `day`, `week`, or `month` |
| `days`     | integer | 30      | Number of days to look back         |

**Response (200 OK):**

```json
{
  "status": "success",
  "data": {
    "interval": "day",
    "data": [
      { "date": "2026-04-27", "votes": 1, "avgRating": 4.0, "newUsers": 22 }
    ]
  },
  "message": "Trends retrieved successfully",
  "timestamp": "..."
}
```

`date` format depends on `interval`:

- `day`: `YYYY-MM-DD`
- `week`: `YYYY-Www` (e.g., `2026-W17`)
- `month`: `YYYY-MM`

#### 6.4.3 View audit logs

**`GET /admin/audit-logs`**

Query parameters (all optional):

| Parameter   | Type    | Description                                        |
| ----------- | ------- | -------------------------------------------------- |
| `page`      | integer | Page number (default 1)                            |
| `limit`     | integer | Items per page (default 20, max 100)               |
| `action`    | string  | Filter by action (e.g., `LOGIN`, `CREATE_PLANNER`) |
| `userId`    | string  | Filter by user ID (MongoDB ObjectId)               |
| `startDate` | string  | ISO date (e.g., `2026-04-01T00:00:00Z`)            |
| `endDate`   | string  | ISO date                                           |

**Response (200 OK):**

```json
{
  "status": "success",
  "data": {
    "logs": [
      {
        "_id": "...",
        "userId": { "_id": "...", "email": "admin@...", "role": "admin" },
        "userRole": "admin",
        "action": "CREATE_PLANNER",
        "targetType": "User",
        "targetId": "...",
        "details": { "email": "planner@..." },
        "ipAddress": "::1",
        "userAgent": "PostmanRuntime/...",
        "timestamp": "..."
      }
    ],
    "total": 110,
    "page": 1,
    "pages": 11
  },
  "message": "Audit logs retrieved successfully",
  "timestamp": "..."
}
```

#### 6.4.4 Export audit logs (CSV)

**`GET /admin/audit-logs/export`**

Same query parameters as `GET /admin/audit-logs` (page/limit ignored – exports all matching logs).

**Response (200 OK):**

- Content‑Type: `text/csv`
- Content‑Disposition: `attachment; filename="audit-logs-<timestamp>.csv"`

#### 6.4.5 AI service health

**`GET /admin/ai/health`**

Returns the health status of the AI service plus comment queue statistics.

**Response (200 OK):**

```json
{
  "status": "success",
  "data": {
    "status": "ok", // or "unreachable"
    "pendingComments": 3,
    "failedComments": 0
  },
  "message": "AI service health retrieved",
  "timestamp": "..."
}
```

If the AI service is unreachable, `status` is `"unreachable"` and an `error` field may be present (e.g., `"Request failed with status code 404"`).

### 6.5 Password Reset (Admin) – Admin‑initiated

#### 6.5.1 Initiate password reset for a user

**`POST /admin/users/:id/initiate-password-reset`**

**Role required:** `admin`

Sends a password reset email to the target user (citizen or planner). The email contains a secure token that the user can use with `POST /auth/reset-password` to set a new password. The admin never sees the password.

**Path parameter:**

| Parameter | Type   | Description                  |
| --------- | ------ | ---------------------------- |
| `id`      | string | User ID (citizen or planner) |

**Response (200 OK):**

```json
{
  "status": "success",
  "data": null,
  "message": "Password reset email sent to user@example.com. The user will receive a link to set a new password.",
  "timestamp": "..."
}
```

**Error responses:**

| Status | Code                    | Message                                                  |
| ------ | ----------------------- | -------------------------------------------------------- |
| 403    | `FORBIDDEN`             | `"Use /auth/forgot-password to reset your own password"` |
| 404    | `NOT_FOUND`             | `"User not found"`                                       |
| 500    | `INTERNAL_SERVER_ERROR` | `"Failed to initiate password reset"`                    |

**Note:** This endpoint does not return a token to the admin. The reset link is sent directly to the user’s email.

## 7. User Profile Endpoints

Role required: authenticated (citizen, planner, or admin) – all endpoints in this section

### 7.1 Get own profile

**`GET /users/me`**

Response (200 OK):

```json
{
  "status": "success",
  "data": {
    "_id": "...",
    "email": "user@example.com",
    "region": "Addis Ababa",
    "preferredLanguage": "en",
    "role": "citizen",
    "verified": true,
    "active": true,
    "createdAt": "..."
  },
  "message": "User profile retrieved successfully",
  "timestamp": "..."
}
```

**Notes:**

- `passwordHash` and `phoneHash` are never returned.
- `verified` indicates if OTP verification is complete.
- `active` indicates if account is enabled (deactivated users cannot log in).
- `preferredLanguage` is the user's chosen language for automatic translation (default `"en"`).

**Error responses:**

| Status | Code                    | Message                               |
| ------ | ----------------------- | ------------------------------------- |
| 401    | `UNAUTHORIZED`          | `"Access denied. No token provided."` |
| 404    | `NOT_FOUND`             | `"User not found"`                    |
| 500    | `INTERNAL_SERVER_ERROR` | `"Failed to retrieve user profile"`   |

### 7.2 Update profile

**`PUT /users/me`**

**Request body** (only `region` and `preferredLanguage` are allowed):

```json
{
  "region": "Oromia",
  "preferredLanguage": "am"
}
```

- `region` – string, any region name.
- `preferredLanguage` – one of `"am"`, `"om"`, `"ti"`, `"en"` (default `"en"`).

**Response (200 OK):** returns the updated user object (same shape as `GET /users/me`).

**Error if an invalid field (e.g., `email`) is provided:**

```json
{
  "status": "error",
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "No valid fields provided for update (only region and preferredLanguage are allowed)"
  },
  "timestamp": "..."
}
```

**Error responses:**

| Status | Code                    | Message                                 |
| ------ | ----------------------- | --------------------------------------- |
| 400    | `VALIDATION_ERROR`      | `"No valid fields provided for update"` |
| 404    | `NOT_FOUND`             | `"User not found"`                      |
| 500    | `INTERNAL_SERVER_ERROR` | `"Failed to update user profile"`       |

### 7.3 Change password

**`PUT /users/me/password`**

Request body:

| Field           | Type   | Required | Description                     |
| --------------- | ------ | -------- | ------------------------------- |
| currentPassword | string | yes      | User's current password         |
| newPassword     | string | yes      | New password (min 6 characters) |

Response (200 OK):

```json
{
  "status": "success",
  "data": null,
  "message": "Password changed successfully",
  "timestamp": "..."
}
```

Error responses:

| Status | Code                  | Message                                          |
| ------ | --------------------- | ------------------------------------------------ |
| 400    | VALIDATION_ERROR      | "Current password and new password are required" |
| 401    | INVALID_CREDENTIALS   | "Current password is incorrect"                  |
| 404    | NOT_FOUND             | "User not found"                                 |
| 500    | INTERNAL_SERVER_ERROR | "Failed to change password"                      |

### 7.4 Get user history (votes and comments)

**`GET /users/me/history`**

Returns all votes cast by the authenticated user. For each vote, if a comment was added (either immediately or later), the comment text and AI sentiment analysis are included.

**Response (200 OK):**

```json
{
  "status": "success",
  "data": {
    "history": [
      {
        "id": "67f1a2b3c4d5e6f7a8b9c0d1",
        "policy": {
          "id": "67f1a2b3c4d5e6f7a8b9c0d2",
          "title": "Clean Water Initiative",
          "policyCode": "CLEAN123"
        },
        "rating": 5,
        "comment": "Great policy!",
        "channel": "app",
        "sentiment": "positive",
        "createdAt": "2026-04-01T10:00:00Z"
      }
    ]
  },
  "message": "User history retrieved successfully",
  "timestamp": "..."
}
```

**Notes:**

- `sentiment` may be `null` if AI processing hasn't completed or if the vote has no comment.
- `policy` may be `null` if the policy was deleted (the vote remains for analytics).
- `comment` is `null` for votes that never received a comment.

**Error responses:**

| Status | Code                    | Message                        |
| ------ | ----------------------- | ------------------------------ |
| 500    | `INTERNAL_SERVER_ERROR` | `"Failed to retrieve history"` |

### 7.5 Delete account (anonymise)

**`DELETE /users/me`**

Permanently anonymises and deactivates the user account. The user cannot log in again. All feedback submissions remain (for analytics) but are disassociated from the user (userId is removed).

Response (200 OK):

```json
{
  "status": "success",
  "data": null,
  "message": "Account deleted successfully. Your data has been anonymized.",
  "timestamp": "..."
}
```

Error responses:

| Status | Code                  | Message                    |
| ------ | --------------------- | -------------------------- |
| 404    | NOT_FOUND             | "User not found"           |
| 500    | INTERNAL_SERVER_ERROR | "Failed to delete account" |

### 7.6 Export user data (GDPR)

**`GET /users/me/export`**

**Authentication required** (citizen, planner, admin).

Downloads a JSON file containing all personal data associated with the user, including profile, votes, comments, notifications, messages, and planner requests.

**Query parameters (all optional):**

| Parameter   | Type   | Description                                                                                                        |
| ----------- | ------ | ------------------------------------------------------------------------------------------------------------------ |
| `startDate` | string | ISO date (e.g., `2026-05-01`). Filters votes, comments, notifications, and messages created on or after this date. |
| `endDate`   | string | ISO date. Filters votes, comments, notifications, and messages created on or before this date.                     |

**Note:** The export includes only data that belongs to the user. Planner requests are included regardless of date filters.

If `startDate` and `endDate` are omitted, all data is exported.

**Response (200 OK):**

- Content‑Type: `application/json`
- Content‑Disposition: `attachment; filename="user-data-<timestamp>.json"`

The JSON structure is as follows:

```json
{
  "profile": {
    "email": "user@example.com",
    "region": "Addis Ababa",
    "ageRange": "25-34",
    "gender": "male",
    "occupation": "private-sector",
    "education": "bachelors",
    "createdAt": "2026-05-13T16:02:56.587Z"
  },
  "votes": [
    {
      "policyId": "67f1a2b3...",
      "policyTitle": "Clean Water Initiative",
      "policyCode": "CLEAN123",
      "value": "yes",
      "channel": "app",
      "createdAt": "2026-05-13T10:00:00Z"
    }
  ],
  "comments": [
    {
      "text": "Great policy!",
      "sentiment": { "label": "positive", "confidence": 0.95 },
      "keywords": ["great"],
      "createdAt": "2026-05-13T11:00:00Z"
    }
  ],
  "notifications": [
    {
      "type": "POLICY_CLOSED",
      "title": "Policy closed: Clean Water Initiative",
      "message": "The policy has closed.",
      "read": true,
      "createdAt": "2026-05-13T12:00:00Z"
    }
  ],
  "messages": [
    {
      "direction": "sent",
      "subject": "Collaboration request",
      "body": "Can you help?",
      "read": true,
      "createdAt": "2026-05-13T13:00:00Z"
    }
  ],
  "plannerRequests": [
    {
      "organization": "Ministry of Education",
      "reason": "I want to create policies about school funding.",
      "status": "pending",
      "createdAt": "2026-05-01T00:00:00Z",
      "reviewedAt": null,
      "rejectionReason": null
    }
  ]
}
```

**Error responses:**

| Status | Code                    | Message                            |
| ------ | ----------------------- | ---------------------------------- |
| 400    | `VALIDATION_ERROR`      | "startDate must be before endDate" |
| 404    | `NOT_FOUND`             | "User not found"                   |
| 500    | `INTERNAL_SERVER_ERROR` | "Failed to export user data"       |

### 7.7 Request email change

**`POST /users/me/email/request`**

**Authentication required (citizen, planner, admin).**  
Sends an OTP to the **new email address** to verify ownership. The old email remains unchanged until the OTP is verified.  
**Rate limit:** 3 requests per hour per user.

**Request body:**

```json
{
  "newEmail": "newaddress@example.com"
}
```

Response (200 OK):

```json
{
  "status": "success",
  "data": null,
  "message": "Verification code sent to the new email address. It expires in 5 minutes.",
  "timestamp": "..."
}
```

**Error responses:**

| Status | Code                | Message                                                   |
| ------ | ------------------- | --------------------------------------------------------- |
| 400    | VALIDATION_ERROR    | "New email is required"                                   |
| 409    | DUPLICATE_ENTRY     | "Email already in use by another account"                 |
| 429    | RATE_LIMIT_EXCEEDED | "Too many email change requests. Please try again later." |

### 7.8 Verify email change

**`POST /users/me/email/verify`**

**Authentication required.**  
Verifies the OTP sent to the new email and updates the user's email address permanently.

**Request body:**

```json
{
  "code": "123456"
}
```

Response (200 OK):

```json
{
  "status": "success",
  "data": null,
  "message": "Email address updated successfully.",
  "timestamp": "..."
}
```

**Error responses:**
| Status | Code | Message |
|--------|------|---------|
| 400 | `VALIDATION_ERROR` | `"Verification code is required"` |
| 400 | `VALIDATION_ERROR` | `"No pending email change request or code expired. Please request a new one."` |
| 400 | `VALIDATION_ERROR` | `"Invalid verification code"` |
| 429 | `RATE_LIMIT_EXCEEDED` | `"Too many verification attempts. Please request a new code."` |

### 7.9 Request phone number change

**`POST /users/me/phone/request`**

**Authentication required** (citizen, planner, admin).  
Sends an OTP to the **new phone number** to verify ownership. The old phone number remains unchanged until the OTP is verified.  
**Rate limit:** 3 requests per hour per user (enforced by the rate limiter with key `rl:phone:request`).

**Request body:**

```json
{
  "newPhone": "+251912345678"
}
```

**Response (200 OK):**

```json
{
  "status": "success",
  "data": null,
  "message": "OTP sent to the new phone number. It expires in 5 minutes.",
  "timestamp": "2026-05-09T12:00:00Z"
}
```

**Error responses:**

| Status | Code                    | Message                                                     |
| ------ | ----------------------- | ----------------------------------------------------------- |
| 400    | `VALIDATION_ERROR`      | `"New phone number required"`                               |
| 409    | `DUPLICATE_ENTRY`       | `"Phone number already in use by another account"`          |
| 429    | `RATE_LIMIT_EXCEEDED`   | `"Too many phone change requests. Please try again later."` |
| 500    | `INTERNAL_SERVER_ERROR` | `"Failed to request phone change"`                          |

**Note:** The OTP is sent via a mock SMS in the current demo (printed to the console). In production, a real SMS gateway would be used.

---

### 7.10 Verify phone number change

**`POST /users/me/phone/verify`**

**Authentication required.**  
Verifies the OTP sent to the new phone number and updates the user’s phone hash permanently.
**Request body:**

```json
{
  "newPhone": "+251912345678",
  "code": "123456"
}
```

**Response (200 OK):**

```json
{
  "status": "success",
  "data": null,
  "message": "Phone number updated successfully.",
  "timestamp": "2026-05-09T12:00:00Z"
}
```

**Error responses:**

| Status | Code                    | Message                                                        |
| ------ | ----------------------- | -------------------------------------------------------------- |
| 400    | `VALIDATION_ERROR`      | `"New phone and OTP are required"`                             |
| 400    | `VALIDATION_ERROR`      | `"Invalid or expired OTP. Please request a new code."`         |
| 404    | `NOT_FOUND`             | `"User not found"`                                             |
| 429    | `RATE_LIMIT_EXCEEDED`   | `"Too many verification attempts. Please request a new code."` |
| 500    | `INTERNAL_SERVER_ERROR` | `"Failed to verify phone change"`                              |

**Behaviour:**

- On success, the user’s `phoneHash` is updated to the hash of the new phone number.
- The `tokenVersion` is incremented, invalidating any existing JWT tokens (the user must log in again).
- An audit log entry (`PHONE_CHANGE`) is recorded.

### 7.11 Get notifications

**`GET /users/me/notifications`**

**Authentication required** (citizen, planner, admin).

Query parameters (all optional):

| Parameter    | Type    | Default | Description                                |
| ------------ | ------- | ------- | ------------------------------------------ |
| `page`       | integer | 1       | Page number (1‑based)                      |
| `limit`      | integer | 20      | Items per page (max 100)                   |
| `unreadOnly` | boolean | false   | If true, returns only unread notifications |

**Response (200 OK):**

```json
{
  "status": "success",
  "data": {
    "notifications": [
      {
        "_id": "67f1a2b3...",
        "type": "POLICY_CLOSED",
        "title": "Policy closed: Clean Water Initiative",
        "message": "The policy \"Clean Water Initiative\" has closed. Final average rating: 4.2 stars (87 votes).",
        "data": { "policyId": "...", "avgRating": 4.2, "totalVotes": 87 },
        "read": false,
        "createdAt": "2026-04-29T12:00:00Z"
      }
    ],
    "total": 1,
    "page": 1
  },
  "message": "Notifications retrieved successfully",
  "timestamp": "..."
}
```

**Error responses:**
| Status | Code | Message |
| ------ | ----------------------- | ------------------------------- |
| 401 | `UNAUTHORIZED` | Missing or invalid token |
| 500 | `INTERNAL_SERVER_ERROR` | `"Failed to retrieve notifications"` |

### 7.12 Mark a single notification as read

**`PATCH /users/me/notifications/:id/read`**

**Authentication required.**

**Path parameter:**

| Parameter | Type   | Description     |
| --------- | ------ | --------------- |
| `id`      | string | Notification ID |

**Response (200 OK):** returns the updated notification object with `"read": true`.

**Error responses:**

| Status | Code        | Message                                 |
| ------ | ----------- | --------------------------------------- |
| 404    | `NOT_FOUND` | `"Notification not found"`              |
| 500    | `INTERNAL`  | `"Failed to mark notification as read"` |

### 7.13 Mark all notifications as read

**`PATCH /users/me/notifications/read-all`**

**Authentication required.**

**Response (200 OK):**

```json
{
  "status": "success",
  "data": { "modifiedCount": 5 },
  "message": "All notifications marked as read",
  "timestamp": "..."
}
```

**Error responses:**

| Status | Code       | Message                                  |
| ------ | ---------- | ---------------------------------------- |
| 500    | `INTERNAL` | `"Failed to mark notifications as read"` |

## 8. SMS Simulation (Public)

These endpoints simulate an SMS gateway. They return plain text, not JSON.

- **Rate limiting:** Only the `RATE` command is limited to 3 votes per 24 hours per phone number(using Redis).
- All other commands (`HELP`, `SUBSCRIBE`, `STOP`, `POLICIES`, `STATUS`, `MYVOTES`, `RESULTS`) are not subject to the daily vote limit, but are still protected by the global IP rate limit (100 requests per 15 minutes).

**Subscription required** for most commands.  
A user must first send `SUBSCRIBE` to register their phone number. Once subscribed, they can use all commands.  
Unsubscribed users who send any command other than `SUBSCRIBE` or `STOP` receive a reminder to subscribe.

### 8.1 Send SMS command

**`POST /sms/receive`**

**Request body** (JSON or form‑encoded):

| Field     | Type   | Required | Description                        |
| --------- | ------ | -------- | ---------------------------------- |
| `phone`   | string | yes      | Phone number (e.g., +251912345678) |
| `message` | string | yes      | Command (case‑insensitive)         |

**Supported commands (for subscribed users):**

| Command    | Format              | Description                                        |
| ---------- | ------------------- | -------------------------------------------------- |
| `RATE`     | `RATE <code> <1-5>` | Vote on an active policy (max 3 votes/day)         |
| `STATUS`   | `STATUS <code>`     | Get current average rating of an active policy     |
| `POLICIES` | `POLICIES`          | List all currently active policies (code + title)  |
| `MYVOTES`  | `MYVOTES`           | Show policies you have voted on, with their status |
| `RESULTS`  | `RESULTS <code>`    | Get final results of a closed policy               |
| `HELP`     | `HELP`              | Show this help message                             |

**SMS vote limitations by poll type:**

| Poll Type        | SMS support | Behaviour                                                                           |
| ---------------- | ----------- | ----------------------------------------------------------------------------------- |
| `binary`         | Yes         | `RATE CODE YES` or `RATE CODE NO`                                                   |
| `multipleChoice` | **No**      | `"This policy requires multiple choice voting. Please use the mobile app to vote."` |
| `likert`         | Yes         | `RATE CODE 1` to `5`                                                                |
| `approval`       | Yes         | `RATE CODE APPROVE`, `REJECT`, or `ABSTAIN`                                         |
| `rating`         | Yes         | `RATE CODE 1` to `5`                                                                |
| `rankedChoice`   | **No**      | `"This policy requires ranked choice voting. Please use the mobile app to vote."`   |

**Subscription commands (always allowed, even for unsubscribed numbers):**

| Command     | Description                                       |
| ----------- | ------------------------------------------------- |
| `SUBSCRIBE` | Register for the service (creates a subscription) |
| `STOP`      | Unsubscribe (no further commands allowed)         |

---

### 8.2 Example interactions

**Unsubscribed user sends `POLICIES`:**

You are not subscribed to this service. Send SUBSCRIBE to register for SMS voting.

**Subscribe:**
SUBSCRIBE
< Welcome to the Civic Engagement SMS service.
You can now vote on policies, check status, and receive closure notifications.
Send HELP for available commands.

**After subscription – `POLICIES`:**
Active policies:
CLEAN123 - Clean Water Initiative
RURAL456 - Rural Road Development

**`RATE` (first vote):**
RATE CLEAN123 4
< You voted 4 stars for "Clean Water Initiative".
Current average: 4.00 stars (1 votes).
2 vote(s) left today.

**`MYVOTES` (after voting on one policy):**
Policies you voted on:
CLEAN123 (Clean Water Initiative): Active - voting open

**`STATUS`:**
Policy: Clean Water Initiative
Average rating: 3.33 stars (3 votes)

**`RESULTS` (after policy is closed):**
Policy: Clean Water Initiative
Final average rating: 3.80 stars (150 votes)

**`STOP` (unsubscribe):**
You have unsubscribed from SMS voting. You will no longer receive notifications or be able to vote. Send SUBSCRIBE to rejoin.

**`HELP` (subscribed user):**
Commands:
SUBSCRIBE - Register for SMS voting
STOP - Unsubscribe
POLICIES - List active policies
STATUS <code> - Current average rating
RATE <code> <1-5> - Vote (max 3 per day)
MYVOTES - Policies you voted on
RESULTS <code> - Final results (closed policy)
HELP - This message

### 8.3 Error responses (plain text)

| Status  | Text                                                                                   |
| ------- | -------------------------------------------------------------------------------------- |
| 400     | `"Phone and message are required"`                                                     |
| 400     | `"Invalid format. Use: RATE code rating (e.g., RATE POL123 4)"`                        |
| 400     | `"Unknown command. Send HELP for available commands."`                                 |
| 403     | `"This number is registered with the app. Please use the app to vote."`                |
| 404     | `"Policy not found or not active."`                                                    |
| 409     | `"You have already voted on this policy via SMS."`                                     |
| 429     | `"Daily limit of 3 votes reached. Try again in X hour(s)."`                            |
| (other) | `"You are not subscribed to this service. Send SUBSCRIBE to register for SMS voting."` |

### 8.4 Get results (alternative)

**`GET /sms/results`**  
Works exactly as before (no subscription required, but only for closed policies).  
Query parameters: `code` (required), `phone` (optional, for logging). Returns plain text with final results.

## 9. Health Check

### 9.1 Backend health

**`GET /health (public)`**

Response (200 OK):

```json
{
  "status": "ok",
  "timestamp": "2026-04-09T12:00:00Z"
}
```

## 10. Planner Onboarding

These endpoints allow citizens to request planner status, admins to review and approve/reject, and new planners to complete mandatory training.

### 10.1 Citizen requests to become planner

`POST /planners/request`

**Roles:** citizen (authenticated)  
**Rate limit:** 1 request per 24 hours per user (returns 429 if exceeded).

**Request body:**

```json
{
  "organization": "Ministry of Education",
  "reason": "I have been working in education policy for 5 years and want to create policies about school funding. This is a long enough reason to exceed the 50 character minimum requirement.",
  "proofFile": null
}
```

| Field        | Type   | Required | Description                                                       |
| ------------ | ------ | -------- | ----------------------------------------------------------------- |
| organization | string | no       | Name of affiliated organization (if any)                          |
| reason       | string | yes      | Min 50 characters, explains why the user needs planner privileges |
| proofFile    | string | no       | Base64 encoded document (PDF/image) for verification (future use) |

**Response (201 Created):**

```json
{
  "status": "success",
  "data": { "requestId": "67f1a2b3c4d5e6f7a8b9c0d2" },
  "message": "Your request has been submitted. Admins will review it.",
  "timestamp": "2026-05-09T12:00:00Z"
}
```

**Error responses:**

| Status | Code                  | Message                                                               |
| ------ | --------------------- | --------------------------------------------------------------------- |
| 400    | `VALIDATION_ERROR`    | `"Reason must be at least 50 characters."`                            |
| 409    | `DUPLICATE_ENTRY`     | `"You already have a pending request. Please wait for admin review."` |
| 429    | `RATE_LIMIT_EXCEEDED` | `"Too many requests. You can only submit one request per day."`       |

### 10.2 Planner completes mandatory training

`POST /planners/training/complete`

**Roles:** planner (authenticated, must have role `planner` but training not yet completed)  
**Behaviour:** Marks the planner as having completed the required training. After this, they can create policies.

**Request body:** none

**Response (200 OK):**

```json
{
  "status": "success",
  "data": null,
  "message": "Training completed. You can now create policies.",
  "timestamp": "2026-05-09T12:00:00Z"
}
```

**Error responses:**

| Status | Code               | Message                                  |
| ------ | ------------------ | ---------------------------------------- |
| 403    | `FORBIDDEN`        | `"Only planners can complete training."` |
| 400    | `VALIDATION_ERROR` | `"Training already completed."`          |

### 10.3 Admin lists pending planner requests

`GET /planners/requests/pending`

**Roles:** admin

**Query parameters:** none

**Response (200 OK):**

```json
{
  "status": "success",
  "data": [
    {
      "_id": "67f1a2b3c4d5e6f7a8b9c0d2",
      "userId": {
        "_id": "67f1a2b3c4d5e6f7a8b9c0d1",
        "email": "citizen@example.com",
        "region": "Addis Ababa",
        "ageRange": "25-34",
        "gender": "male",
        "occupation": "private-sector",
        "education": "bachelors",
        "createdAt": "2026-05-01T00:00:00Z"
      },
      "organization": "Ministry of Education",
      "reason": "I have been working in education policy for 5 years...",
      "status": "pending",
      "createdAt": "2026-05-09T00:00:00Z"
    }
  ],
  "message": "Pending requests retrieved successfully",
  "timestamp": "2026-05-09T12:00:00Z"
}
```

**Error responses:**

| Status | Code                    | Message                                      |
| ------ | ----------------------- | -------------------------------------------- |
| 403    | `FORBIDDEN`             | `"Access denied. Insufficient permissions."` |
| 500    | `INTERNAL_SERVER_ERROR` | `"Failed to fetch requests"`                 |

### 10.4 Admin approves a planner request

`POST /planners/requests/:id/approve`

**Roles:** admin

**Path parameter:**

| Parameter | Type   | Description                   |
| --------- | ------ | ----------------------------- |
| `id`      | string | Planner request ID (ObjectId) |

**Request body:** none

**Response (200 OK):**

```json
{
  "status": "success",
  "data": null,
  "message": "Planner request approved. User role updated.",
  "timestamp": "2026-05-09T12:00:00Z"
}
```

**What happens:**

- The user's role changes from `citizen` to `planner`.
- The user's `tokenVersion` increments (invalidates old JWTs).
- An email is sent to the user (or mock in development).
- The request status becomes `approved`.

**Error responses:**

| Status | Code               | Message                                    |
| ------ | ------------------ | ------------------------------------------ |
| 404    | `NOT_FOUND`        | `"Request not found"`                      |
| 400    | `VALIDATION_ERROR` | `"Request already approved"` (or rejected) |

### 10.5 Admin rejects a planner request

`POST /planners/requests/:id/reject`

**Roles:** admin

**Path parameter:** same as approval.

**Request body:**

```json
{
  "rejectionReason": "Your organization could not be verified. Please provide a valid letter of appointment."
}
```

| Field           | Type   | Required | Description                              |
| --------------- | ------ | -------- | ---------------------------------------- |
| rejectionReason | string | yes      | Min 10 characters, explains why rejected |

**Response (200 OK):**

```json
{
  "status": "success",
  "data": null,
  "message": "Request rejected.",
  "timestamp": "2026-05-09T12:00:00Z"
}
```

**Error responses:**

| Status | Code               | Message                                              |
| ------ | ------------------ | ---------------------------------------------------- |
| 404    | `NOT_FOUND`        | `"Request not found"`                                |
| 400    | `VALIDATION_ERROR` | `"Rejection reason must be at least 10 characters."` |

## 11. Delegation & Internal Messaging

These endpoints allow planners to collaborate by assigning associates to policies, searching for collaborators by language, and sending internal messages.

**Roles required:** planner or admin (except where noted).

All endpoints in this section require authentication with a planner or admin token.

---

### 11.1 Search planners by spoken language

**GET /planners/search**

**Query parameter:**

- `language` (required) – one of: `am` (Amharic), `om` (Oromo), `ti` (Tigrinya), `en` (English)

**Response (200 OK):**

```json
{
  "status": "success",
  "data": [
    {
      "\_id": "67f1a2b3c4d5e6f7a8b9c0d1",
      "email": "planner@example.com",
      "region": "Addis Ababa",
      "languagesSpoken": ["am", "en"],
      "trainingCompletedAt": "2026-05-01T00:00:00Z"
    }
  ],
  "message": "Planners found",
  "timestamp": "2026-05-09T12:00:00Z"
}
```

**Error responses:**

| Status | Code             | Message                                             |
| ------ | ---------------- | --------------------------------------------------- |
| 400    | VALIDATION_ERROR | "Valid language code required (am, om, ti, en)"     |
| 403    | FORBIDDEN        | "Access denied. Only planners can search planners." |

---

### 11.2 Add an associate to a policy

**POST /planners/policies/:policyId/associates**

**Roles:** policy owner (planner) or admin

**Path parameter:**

- `policyId` – MongoDB ObjectId of the policy

**Request body:**

```json
{
  "plannerEmail": "collaborator@example.com",
  "permissions": [
    "view_analytics",
    "moderate_comments",
    "reply_official",
    "export_data"
  ]
}
```

**Permissions array options:**

| Permission          | Description                                                         |
| ------------------- | ------------------------------------------------------------------- |
| `view_analytics`    | Access analytics for the policy (timeseries, export, heatmap, etc.) |
| `moderate_comments` | Edit, delete, approve, flag comments; retry AI processing           |
| `reply_official`    | Post official replies (marked with a badge)                         |
| `export_data`       | Download CSV exports of votes and comments                          |

**Response (201 Created):**

```json
{
  "status": "success",
  "data": {
    "\_id": "67f1a2b3c4d5e6f7a8b9c0d2",
    "policyId": "67f1a2b3c4d5e6f7a8b9c0d1",
    "plannerId": "67f1a2b3c4d5e6f7a8b9c0d3",
    "permissions": ["view_analytics", "moderate_comments"],
    "assignedBy": "67f1a2b3c4d5e6f7a8b9c0d0",
    "revokedAt": null,
    "assignedAt": "2026-05-09T12:00:00Z"
  },
  "message": "Associate added successfully",
  "timestamp": "2026-05-09T12:00:00Z"
}
```

**Error responses:**

| Status | Code             | Message                                                                      |
| ------ | ---------------- | ---------------------------------------------------------------------------- |
| 400    | VALIDATION_ERROR | "plannerEmail and permissions array required"                                |
| 403    | FORBIDDEN        | "Only policy owner can add associates"                                       |
| 404    | NOT_FOUND        | "Policy not found" or "Planner not found with that email"                    |
| 409    | DUPLICATE_ENTRY  | "This planner is already an associate (active). Update permissions instead." |

---

### 11.3 List associates of a policy

**GET /planners/policies/:policyId/associates**

**Roles:** policy owner (planner) or admin

**Path parameter:**

- `policyId` – Policy ID

**Response (200 OK):**

```json
{
  "status": "success",
  "data": [
    {
      "\_id": "67f1a2b3c4d5e6f7a8b9c0d2",
      "policyId": "67f1a2b3c4d5e6f7a8b9c0d1",
      "plannerId": {
        "\_id": "...",
        "email": "associate@example.com",
        "region": "Addis Ababa",
        "languagesSpoken": ["en"]
      },
      "permissions": ["view_analytics"],
      "assignedBy": {
        "\_id": "...",
        "email": "owner@example.com"
      },
      "revokedAt": null,
      "assignedAt": "2026-05-09T12:00:00Z"
    }
  ],
  "message": "Associates retrieved",
  "timestamp": "2026-05-09T12:00:00Z"
}
```

**Error responses:**

| Status | Code      | Message                                 |
| ------ | --------- | --------------------------------------- |
| 403    | FORBIDDEN | "Only policy owner can view associates" |
| 404    | NOT_FOUND | "Policy not found"                      |

---

### 11.4 Update associate permissions

**PATCH /planners/policies/:policyId/associates/:associateId**

**Roles:** policy owner (planner) or admin

**Path parameters:**

- `policyId` – Policy ID
- `associateId` – Associate record ID (not planner ID)

**Request body:**

```json
{
  "permissions": ["view_analytics"]
}
```

| Permission          | Description                                    |
| ------------------- | ---------------------------------------------- |
| `view_analytics`    | View all analytics for the policy              |
| `moderate_comments` | Edit, delete, approve, flag comments; retry AI |
| `reply_official`    | Post replies marked as official responses      |
| `export_data`       | Download CSV exports of votes and comments     |

**Note:** The `permissions` array replaces the existing permissions entirely. To add a permission, include all existing ones plus the new one.

**Response (200 OK):** returns the updated associate object (same shape as POST response).

**Error responses:**

| Status | Code             | Message                                            |
| ------ | ---------------- | -------------------------------------------------- |
| 400    | VALIDATION_ERROR | "permissions array required"                       |
| 403    | FORBIDDEN        | "Only policy owner can update permissions"         |
| 404    | NOT_FOUND        | "Policy not found" or "Active associate not found" |

---

### 11.5 Revoke an associate

**DELETE /planners/policies/:policyId/associates/:associateId**

**Roles:** policy owner (planner) or admin

**Path parameters:** same as 11.4

**Response (200 OK):**

```json
{
  "status": "success",
  "data": null,
  "message": "Associate revoked",
  "timestamp": "..."
}
```

**Error responses:**

| Status | Code      | Message                                            |
| ------ | --------- | -------------------------------------------------- |
| 403    | FORBIDDEN | "Only policy owner can revoke associates"          |
| 404    | NOT_FOUND | "Policy not found" or "Active associate not found" |

---

### 11.6 Send a message

**POST /api/messages**

**Roles:** planner or admin

**Rate limit:** 10 messages per minute per user (shared with comment limit).

**Request body:**

```json
{
  "recipientId": "67f1a2b3c4d5e6f7a8b9c0d3",
  "subject": "Policy collaboration request",
  "body": "I would like your help moderating comments on the Clean Water policy."
}
```

**Response (201 Created):**

```json
{
  "status": "success",
  "data": { "messageId": "67f1a2b3c4d5e6f7a8b9c0d4" },
  "message": "Message sent",
  "timestamp": "..."
}
```

**Error responses:**

| Status | Code                | Message                                      |
| ------ | ------------------- | -------------------------------------------- |
| 400    | VALIDATION_ERROR    | "recipientId, subject, body required"        |
| 404    | NOT_FOUND           | "Recipient not found or not a planner/admin" |
| 429    | RATE_LIMIT_EXCEEDED | "Too many messages. Please wait a moment."   |

---

### 11.7 Get my inbox

**GET /api/messages/inbox**

**Roles:** planner or admin

**Query parameters:**

- `page` – page number (default 1)
- `limit` – items per page (default 20, max 100)

**Response (200 OK):**

```json
{
  "status": "success",
  "data": {
    "messages": [
      {
        "_id": "67f1a2b3c4d5e6f7a8b9c0d4",
        "senderId": { "_id": "...", "email": "plannerA@example.com" },
        "recipientId": "67f1a2b3c4d5e6f7a8b9c0d3",
        "subject": "Policy collaboration request",
        "body": "I would like your help...",
        "read": false,
        "replyToId": null,
        "createdAt": "2026-05-09T12:00:00Z"
      }
    ],
    "total": 5,
    "page": 1
  },
  "message": "Inbox retrieved",
  "timestamp": "..."
}
```

---

### 11.8 Get a single message (and mark as read)

**GET /api/messages/:messageId**

**Roles:** sender or recipient (planner/admin)

**Behaviour:** Automatically marks the message as read if the recipient views it. If the authenticated user is neither the sender nor the recipient, the API returns `404 Not Found` to avoid revealing the existence of the message.

**Error responses:**

| Status | Code        | Message                        |
| ------ | ----------- | ------------------------------ |
| 404    | `NOT_FOUND` | `"Message not found"`          |
| 500    | `INTERNAL`  | `"Failed to retrieve message"` |

---

### 11.9 Reply to a message

**POST /api/messages/:messageId/reply**

**Roles:** must be sender or recipient of the original message

**Path parameter:**

- `messageId` – Original message ID

**Request body:**

```json
{
  "body": "Sure, I can help. Let me review the policy first."
}
```

**Response (201 Created):**

```json
{
  "status": "success",
  "data": { "messageId": "67f1a2b3c4d5e6f7a8b9c0d5" },
  "message": "Reply sent",
  "timestamp": "..."
}
```

**Error responses:**

| Status | Code                    | Message                        |
| ------ | ----------------------- | ------------------------------ |
| 400    | `VALIDATION_ERROR`      | `"body required"`              |
| 404    | `NOT_FOUND`             | `"Original message not found"` |
| 500    | `INTERNAL_SERVER_ERROR` | `"Failed to send reply"`       |

## 12. Notifications & Smart Alerts (Real‑time)

### 12.1 Overview

The platform generates in‑app notifications for important events: policy closures, comment replies, appeal resolutions, associate assignments, messages, and **smart alerts** (vote surges, rating drops, emerging topics).
All notifications are stored in the database and can be retrieved via the endpoints described in section 7.8–7.10.

In addition, the backend uses **Socket.IO** to push notifications instantly to connected front‑end clients (web or mobile). No polling is required.

### 12.2 WebSocket Connection

**Endpoint:** `ws://your-domain.com` (or `http://localhost:5000` for local development)
Use the Socket.IO client library in your frontend.

**Authentication:**
Pass the user’s JWT token as an `auth` object during connection:

```javascript
const socket = io("http://localhost:5000", {
  auth: { userId: "your_user_id" }, // userId is the MongoDB ObjectId
});
```

**Note:** The backend expects `userId` in the handshake. It then joins a room named `user:<userId>` and sends all notifications for that user to that room only.

**Events:**

| Event name       | Payload                                | Description                                                         |
| ---------------- | -------------------------------------- | ------------------------------------------------------------------- |
| `notification`   | A full `Notification` object (JSON)    | Sent whenever a new notification is created for the connected user. |
| (future) `alert` | Custom alert object (to be documented) | Reserved for future critical real‑time alerts.                      |

**Example front‑end listener (Socket.IO v4):**

```javascript
socket.on("notification", (notification) => {
  console.log("New notification:", notification);
  // display in UI, update badge, etc.
});
```

### 12.3 Notification Types (enum)

The `type` field of a notification can be one of the following values:

| Type                 | Trigger                                                                                           | Severity  |
| -------------------- | ------------------------------------------------------------------------------------------------- | --------- |
| `POLICY_ACTIVATED`   | Policy becomes active (auto‑activation or manual).                                                | `info`    |
| `POLICY_CLOSED`      | Policy ends (auto‑closure or manual).                                                             | `info`    |
| `POLICY_EXTENDED`    | End date of a policy is extended.                                                                 | `info`    |
| `ASSOCIATE_ASSIGNED` | A planner is assigned as associate to another planner’s policy.                                   | `info`    |
| `MESSAGE_RECEIVED`   | A new internal message is received.                                                               | `info`    |
| `COMMENT_REPLY`      | Someone replies to a comment you wrote.                                                           | `info`    |
| `COMMENT_FLAGGED`    | A comment reaches 3 reports and is flagged for moderation.                                        | `warning` |
| `COMMENT_APPEAL`     | A citizen appeals a moderation decision.                                                          | `info`    |
| `APPEAL_RESOLVED`    | A planner resolves an appeal.                                                                     | `info`    |
| `VOTE_SURGE`         | Real‑time anomaly: vote rate exceeds 3× the baseline (last 6h).                                   | `warning` |
| `RATING_DROP`        | Real‑time anomaly: average rating drops by more than 1.0 point within an hour.                    | `warning` |
| `EMERGING_TOPIC`     | A keyword’s frequency increases >200% compared to the 7‑day baseline and appears >5 times in 24h. | `info`    |

### 12.4 Notification Fields

Each notification document returned by the API (section 7.8) contains the following fields:

| Field       | Type    | Description                                                           |
| ----------- | ------- | --------------------------------------------------------------------- |
| `_id`       | string  | Unique notification ID.                                               |
| `userId`    | string  | User for whom the notification is intended.                           |
| `userRole`  | string  | `citizen`, `planner`, or `admin` (denormalised for easier filtering). |
| `type`      | string  | One of the enum values above.                                         |
| `title`     | string  | Short headline.                                                       |
| `message`   | string  | Detailed text.                                                        |
| `data`      | object  | Optional additional data (e.g., `{ policyId, commentId }`).           |
| `read`      | boolean | `true` if the user has viewed the notification.                       |
| `severity`  | string  | `info`, `warning`, or `critical`. Smart alerts are usually `warning`. |
| `source`    | string  | `system` (regular user‑triggered) or `alert` (automated anomaly).     |
| `createdAt` | string  | ISO timestamp.                                                        |

### 12.5 Smart Alerts (Automated Anomaly Detection)

The system continuously monitors voting activity in real time (after each vote) and runs a background cron job every 6 hours for emerging topics.

#### 12.5.1 Vote Surge

- **Detection:** After each vote, the backend counts the number of votes cast in the last hour and compares it to the average of the previous 6 hours (excluding the last hour).
- **Threshold:** Surge = `current_hour_votes > 3 * baseline_hourly_rate`.
- **Notification:** Sent to the policy owner and all associates with `view_analytics` permission.
- **Example message:** _Policy “Clean Water Initiative” received 45 votes in the last hour (5× normal)._

#### 12.5.2 Rating Drop

- **Detection:** Only for numeric poll types (`rating`, `likert`). Compares the average rating of the last hour with the average of the previous 6 hours (excluding last hour).
- **Threshold:** `baseline_avg - last_hour_avg > 1.0`.
- **Notification:** Sent to the policy owner and all associates (same as surge).
- **Example message:** _Policy “Clean Water Initiative” average rating dropped from 4.2 to 2.9 in the last hour._

#### 12.5.3 Emerging Topics

- **Detection:** Every 6 hours, the cron job analyses keywords from all approved comments of the last 24 hours.
  Keywords are extracted from the AI analysis of top‑level comments.
  It compares frequencies with a rolling 7‑day baseline stored in Redis.
- **Threshold:** Keyword count > 5 and increase > 200% relative to baseline.
- **Notification:** Sent to **all planners** (all planners receive a single notification about the emerging topic).
- **Example message:** _New trending topic: “drought” (12 mentions, +300%)._

### 12.6 Notification Endpoints (Already Documented)

- `GET /users/me/notifications` – list notifications (7.8)
- `PATCH /users/me/notifications/:id/read` – mark single as read (7.9)
- `PATCH /users/me/notifications/read-all` – mark all as read (7.10)

These endpoints work for all notification types, including smart alerts.

## 13. Personalized Feed (for Citizens)

These endpoints provide a personalized list of active policies for a citizen, ordered by relevance. Relevance is calculated using:

- Demographic boost – matches the citizen's gender, age, occupation, and region with policy relevanceFactors (e.g., women: true, youth: true).
- Content‑based boost – matches policy topics with topics from policies the citizen has previously interacted with (views, votes, comments).

All feed endpoints require the citizen role.

### 13.1 Get personalized feed

GET /api/feed

Authentication required: citizen

Response (200 OK):

```json
{
  "status": "success",
  "data": [
    {
      "id": "67f1a2b3c4d5e6f7a8b9c0d1",
      "title": "Women Entrepreneurship Support",
      "description": "Policy to support women‑led businesses.",
      "policyCode": "WOMENXSTCF",
      "pollType": "rating",
      "startDate": "2026-06-01T00:00:00Z",
      "endDate": "2026-12-31T00:00:00Z",
      "targetRegions": ["Addis Ababa"],
      "relevanceScore": "6.50"
    },
    {
      "id": "67f1a2b3...",
      "title": "Youth Digital Skills",
      "relevanceScore": "3.00"
    }
  ],
  "message": "Personalized feed",
  "timestamp": "2026-05-09T12:00:00Z"
}
```

Behaviour:

- Only policies with status "active" and targetRegions matching the citizen's region are returned.
- Policies are sorted by relevanceScore descending (higher = more relevant).
- Results are cached in Redis for 1 hour. The cache is invalidated automatically when the citizen records a new interaction (POST /api/feed/interact).

Error responses:

| Status | Code                  | Message                   |
| ------ | --------------------- | ------------------------- |
| 403    | FORBIDDEN             | "Feed only for citizens"  |
| 500    | INTERNAL_SERVER_ERROR | "Failed to generate feed" |

### 13.2 Record a user interaction (view, vote, comment)

POST /api/feed/interact

Records that a citizen has interacted with a specific policy. This affects the content‑based relevance score for future feed requests.

Authentication required: citizen

Request body:

```json
{
  "policyId": "67f1a2b3c4d5e6f7a8b9c0d1",
  "type": "view"
}
```

type can be one of: "view", "vote", "comment".

Response (200 OK):

```json
{
  "status": "success",
  "data": null,
  "message": "Interaction recorded",
  "timestamp": "..."
}
```

Behaviour:

- Interactions are stored in the UserInteraction collection.
- After recording, the feed cache for that citizen is immediately deleted, so the next feed call reflects the updated content profile.
- Duplicate interactions of the same type for the same policy are ignored (no error, just no change).

Error responses:

| Status | Code                  | Message                            |
| ------ | --------------------- | ---------------------------------- |
| 400    | VALIDATION_ERROR      | "policyId and valid type required" |
| 403    | FORBIDDEN             | "Feed only for citizens"           |
| 500    | INTERNAL_SERVER_ERROR | "Failed to record interaction"     |

## 14. Translation (On‑Demand)

These endpoints allow authenticated users (citizens, planners, admins) to translate text between Amharic, Oromo, Tigrinya, and English. Translations are cached in Redis for 24 hours to improve performance.

### 14.1 Translate text

**`POST /api/translate`**

**Authentication required:** yes (any role: citizen, planner, admin)  
**Rate limit:** 30 requests per minute per user (shared with analytics read limit)

**Request body:**

```json
{
  "text": "ሰላም ውድ",
  "sourceLang": "am", // optional – auto‑detected if omitted
  "targetLang": "en" // optional, defaults to "en"
}
```

**Supported language codes:** `am` (Amharic), `om` (Oromo), `ti` (Tigrinya), `en` (English).

**Behaviour:**

- If `sourceLang` is omitted, the backend calls the AI service to detect the language automatically.
- The translated text is cached in Redis for 24 hours. Subsequent identical requests return the cached result.
- The endpoint uses a remote Hugging Face Space running the `facebook/nllb-200-distilled-1.3B` model.

**Response (200 OK):**

```json
{
  "status": "success",
  "data": {
    "translatedText": "Hello dear"
  },
  "message": "Translation successful",
  "timestamp": "..."
}
```

**Error responses:**

| Status | Code                    | Message                                                      |
| ------ | ----------------------- | ------------------------------------------------------------ |
| 400    | `VALIDATION_ERROR`      | `"text is required"` or `"Invalid language code"`            |
| 503    | `INTERNAL_SERVER_ERROR` | `"Translation service unavailable. Please try again later."` |
| 429    | `RATE_LIMIT_EXCEEDED`   | `"Too many requests. Please wait a moment."`                 |

## Appendix: Rate Limiting Summary

| Endpoint group                               | Limit        | Time window | Scope                  |
| -------------------------------------------- | ------------ | ----------- | ---------------------- |
| `/auth/login`, `/auth/verify-otp`            | 10 requests  | 15 minutes  | Per IP                 |
| `/auth/send-otp`                             | 3 requests   | 1 hour      | Per IP                 |
| `/auth/forgot-password`                      | 3 requests   | 1 hour      | Per IP                 |
| `/auth/reset-password`                       | 5 requests   | 15 minutes  | Per IP                 |
| `/votes` (POST)                              | 30 requests  | 1 hour      | Per user (by JWT)      |
| `/comments` (POST)                           | 10 requests  | 1 minute    | Per user (by JWT)      |
| `POST /comments/:commentId/report`           | 5 requests   | 1 minute    | Per user (by JWT)      |
| `POST /comments/:commentId/appeal`           | 3 requests   | 24 hours    | Per user (by JWT)      |
| `PUT /comments/:commentId/moderate`          | 30 requests  | 1 minute    | Per user (by JWT)      |
| `GET /analytics/*` (all analytics endpoints) | 30 requests  | 1 minute    | Per user (by JWT)      |
| `POST /api/translate`                        | 30 requests  | 1 minute    | Per user (by JWT)      |
| `POST /admin/comments/bulk/retry-by-ids`     | 10 requests  | 1 minute    | Per admin (by user ID) |
| All other `/api` endpoints                   | 100 requests | 15 minutes  | Per IP                 |
| `/sms/receive`                               | 3 votes      | 24 hours    | Per phone number       |
