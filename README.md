# Interview Lab: AI-Powered Interview Preparation (MERN + Groq)

[![CI/CD](https://github.com/Piro-Programmer/AI_POWERED_INTERVIEW_PLATFORM/actions/workflows/ci-cd.yml/badge.svg)](https://github.com/Piro-Programmer/AI_POWERED_INTERVIEW_PLATFORM/actions/workflows/ci-cd.yml)

**Live demo:** https://ai-powered-interview-platform-hywork.vercel.app/

[![Interview Lab landing page](docs/screenshots/01-landing.png)](https://ai-powered-interview-platform-hywork.vercel.app/)

## Overview

Interview Lab is a full-stack web application built with the MERN stack and the Groq API. It helps candidates prepare for interviews in a focused, role-specific way.

Paste a job description, optionally upload your resume, and get a structured report: a match score, the questions you're likely to be asked (with the intent behind each and how to answer), your skill gaps, and a five-day preparation plan. Then practise each answer out loud and get AI feedback. A Free plan covers occasional use; Pro and Premium are monthly subscriptions paid through Razorpay.

## Problem Statement

- Interview preparation is often too generic.
- Candidates may not know which questions match a specific job description.
- There is no simple structured workflow for practicing against real roles.

## Solution

The platform takes:

- Resume PDF text, if uploaded
- User self description
- Job description

Then the AI model (Groq) generates:

- Match score
- Technical interview questions
- Behavioral interview questions
- Suggested answers and the intent behind each question
- Skill gaps with severity
- Five-day preparation plan

Every response is validated against a strict schema before it reaches the user, and reports are saved in MongoDB for the logged-in user.

## Features

**Public landing page**
- Live, in-browser job description markup demo, with no account needed: skills are highlighted, people skills underlined and recruiter phrases circled, each with a margin note
- Paste your own job description, or select any phrase to mark it yourself

**Report**
- Match score that counts up inside a hand-drawn ring that closes only as far as the score
- Skill gaps highlighted inside your own job description, each linked to the plan day that covers it
- Questions fold away until opened, so you can answer out loud first
- Five-day plan as a checklist with progress, saved to your account so it follows you across devices
- While the report generates, your job description is shown being read, with an elapsed timer

**Practice mode**
- Answer each question by typing or speaking (browser speech-to-text in Chrome/Edge), with a two-minute interview clock
- AI feedback on every answer: a 0-10 score, four criteria (structure, specificity, relevance, clarity), what worked, what to fix, and a stronger version of your answer
- Behavioral answers are judged with STAR in mind; attempts to game the grader score 0-1
- Question chips show your best score; re-drill mode brings back only the weak ones
- Every attempt is saved, so you can see last and best scores per question

**Report history**
- Every saved report in one ledger: match score, date, top gaps and plan progress
- Search, sort by date or score, and filter by plan progress
- Open any report again, or practise the same role with the job description pre-filled

**Plans and payments (Razorpay)**
- Three plans: **Free**, **Pro** (₹299/month) and **Premium** (₹699/month), each with a daily cap and a monthly allowance for reports and answer reviews
- `/pricing` page with checkout through Razorpay (UPI, cards, e-mandate). Card details go straight to Razorpay and never reach our servers
- Monthly auto-renewing subscriptions. Paid allowances renew on the day the user is charged, not on the 1st
- `/billing` page: current plan and usage, cancel (the plan stays until the period ends), resume, upgrade now or downgrade at period end, and payment history
- Checkout and webhook signatures checked with HMAC-SHA256 and a timing-safe comparison; webhooks are deduplicated, out-of-order events are ignored, and a missed webhook is reconciled from Razorpay
- 3-day grace period when a renewal fails; deleting an account cancels its subscription at once

**Platform**
- Registration, login, logout and protected routes
- JWT authentication in an HTTP-only cookie
- Optional PDF resume upload with text extraction
- AI report generation with Groq (Gemini supported as a fallback)
- MongoDB persistence for interview reports
- React + Vite frontend, Express REST API backend
- Deployed with the frontend on Vercel and the backend on Render

**Limits and security**
- Daily and monthly AI allowances per user from their plan, shown in the UI (Free: 2 reports a day and 5 a month by default)
- The allowance is reserved atomically in MongoDB, so parallel requests can't overshoot it, and a failed AI call gives it back
- Site-wide caps on AI provider usage, in requests **and tokens** per minute and per day (retries included), keep the whole site under the provider's rate limits; over a cap, or if the provider answers 429, users get "busy, try again" and their allowance back
- One report generation at a time per user, plus a short burst limit
- Failed sign-ins are rate limited per account and per network; sign-ups per network
- Input caps (job description, profile, resume text, request size) and PDF-only uploads up to 3 MB
- Security headers via Helmet, and every error returned as JSON the UI can show

## Screenshots

Public pages are from the [live site](https://ai-powered-interview-platform-hywork.vercel.app/). Signed-in pages use a demo account with sample data.

### Landing page

The hero is a live demo: a real job description, marked up as you watch. Skills are highlighted, people skills underlined and recruiter phrases circled, each with a margin note.

![Live job description markup demo](docs/screenshots/02-landing-demo.png)

![What a report looks like, on the landing page](docs/screenshots/03-landing-report-preview.png)

### Sign in and your desk

| Sign in | Dashboard |
|---|---|
| ![Sign in page](docs/screenshots/04-login.png) | ![Dashboard](docs/screenshots/05-dashboard.png) |

### New report and history

| New report (with today's allowance) | Report history (search, sort, filter, plan progress) |
|---|---|
| ![New report form](docs/screenshots/06-new-report.png) | ![Report history](docs/screenshots/07-history.png) |

### The report

Match score, then your skill gaps marked on the posting itself, each linked to the plan day that covers it.

![Report: match score and skill gaps on the job description](docs/screenshots/08-report.png)

| Questions fold until you open them | Five-day plan, saved to your account |
|---|---|
| ![Technical questions](docs/screenshots/09-report-questions.png) | ![Preparation plan checklist](docs/screenshots/10-report-plan.png) |

### Practice mode

Answer each question by typing or speaking, then get AI feedback: a score, four criteria, what worked, what to fix, and a stronger version of your answer. Chips show your best score per question; re-drill brings back the weak ones.

![Practice mode: question chips and answer card](docs/screenshots/11-practice.png)

![Practice mode: AI feedback on an answer](docs/screenshots/12-practice-feedback.png)

### On a phone

| Landing | Practice |
|---|---|
| <img src="docs/screenshots/13-mobile-landing.png" alt="Landing page on a phone" width="320"> | <img src="docs/screenshots/14-mobile-practice.png" alt="Practice mode on a phone" width="320"> |

## How It Works

1. User registers or logs in.
2. User opens the new report page.
3. User uploads a resume PDF, optionally enters a self description, and pastes the job description.
4. Frontend sends multipart form data to the backend.
5. Backend authenticates the user through the JWT cookie.
6. Backend extracts resume text from the PDF.
7. Backend asks Groq for a JSON report that follows the report schema.
8. Backend validates the response with Zod, retrying up to 3 times if it doesn't match.
9. Backend saves the report in MongoDB with a readable title.
10. Frontend displays the generated report.

### Paying for a plan

1. On `/pricing` the user picks Pro or Premium; the backend creates a Razorpay subscription for them.
2. Razorpay Checkout opens in the browser and takes the first payment.
3. The backend checks Razorpay's signature and switches the user to the paid plan.
4. Razorpay's webhooks (`subscription.charged`, `cancelled`, `halted`, ...) keep the plan, billing period and payment history up to date every month.

## Project Structure

```text
AI_POWERED_INTERVIEW_PLATFORM/
├── Backend/
│   ├── src/
│   ├── scripts/             # one-off: create the Razorpay plans
│   ├── src/
│   │   ├── config/          # MongoDB connection, plan catalogue (prices, limits)
│   │   ├── controllers/     # auth, interview, practice, admin, billing handlers
│   │   ├── middlewares/     # auth check, file upload, rate limits
│   │   ├── models/          # user, report, subscription, payment, webhook event, ...
│   │   ├── routes/
│   │   ├── services/        # AI (Groq / Gemini), quotas, entitlements, Razorpay
│   │   └── app.js           # Express app, CORS, health check, Razorpay webhook
│   ├── test/
│   ├── .env.example
│   ├── package.json
│   └── server.js
├── Frontend/
│   ├── src/
│   │   ├── components/      # shared UI (marked-up job description sheet, wordmark)
│   │   ├── features/
│   │   │   ├── ai/          # new report page and report components
│   │   │   ├── auth/        # login, register, auth state
│   │   │   ├── billing/     # pricing, checkout, billing page
│   │   │   └── landing/     # landing page demo
│   │   ├── lib/             # shared API client
│   │   ├── pages/           # landing page, dashboard
│   │   ├── app.router.jsx
│   │   └── main.jsx
│   ├── .env.example
│   ├── package.json
│   ├── vercel.json          # /api proxy to the backend + client-side routing
│   └── vite.config.js       # /api proxy in development
├── .gitignore
└── README.md
```

## Tech Stack

### Frontend

- React
- Vite
- React Router
- Axios
- Sass

### Backend

- Node.js
- Express.js
- MongoDB
- Mongoose
- JWT
- Multer
- pdf-parse
- Zod
- Razorpay (`razorpay` SDK) for subscriptions

### AI Integration

- Groq through `groq-sdk` (default model `openai/gpt-oss-120b`), used when `GROQ_API_KEY` is set
- Gemini through `@google/genai` (default model `gemini-2.5-flash`), used only when `GROQ_API_KEY` is not set
- Responses are validated against a Zod schema and retried up to 3 times

### Hosting

- Frontend: Vercel
- Backend: Render
- Database: MongoDB Atlas

## Installation & Setup

### 1. Clone Repository

```bash
git clone https://github.com/Piro-Programmer/AI_POWERED_INTERVIEW_PLATFORM.git
cd AI_POWERED_INTERVIEW_PLATFORM
```

### 2. Setup Backend

```bash
cd Backend
npm install
```

Create a `.env` file inside `Backend` (see `Backend/.env.example` for every option):

```env
PORT=3000
MONGO_URI=your_mongodb_connection_string
JWT_SECRET=your_jwt_secret
GROQ_API_KEY=your_groq_api_key
```

Get a Groq API key at https://console.groq.com/keys. To use a different Groq model, set `GROQ_MODEL`.

To use Gemini instead, leave `GROQ_API_KEY` out and set `GOOGLE_GENAI_API_KEY` (optionally `GEMINI_MODEL`).

Payments are optional. Without Razorpay keys the app runs on the Free plan, paid plans show as not available, and the billing endpoints answer `503 BILLING_DISABLED`. To turn them on, see [Payments (Razorpay)](#payments-razorpay).

Run backend:

```bash
npm start
```

For development with automatic restart:

```bash
npm run dev
```

Backend runs on:

```text
http://localhost:3000
```

### 3. Setup Frontend

```bash
cd ../Frontend
npm install
npm run dev
```

Frontend runs on:

```text
http://localhost:5173
```

In development, Vite proxies `/api` requests to `http://localhost:3000` (see `Frontend/vite.config.js`), so the frontend and backend share one origin and the auth cookie just works.

## CI/CD pipeline

Every change goes through [GitHub Actions](.github/workflows/ci-cd.yml) before it can reach production:

```text
pull request ─► detect changes ─► backend tests ┐
                                 frontend lint, │
                                 tests, build   │─► required checks ─► merge to main
                                 end-to-end     ┘
                                 (Playwright)

push to main ─► detect changes ─► tests (as above) ─► deploy backend (Render) ─► deploy frontend (Vercel)
                                                      exact tested commit,       after the API is live,
                                                      waits for /api/health      waits for the new build,
                                                      to report that commit      smoke-tests the live site
```

- **Only what changed runs:** backend changes test and deploy the backend; frontend changes the frontend; README-only changes skip both.
- **Nothing deploys untested:** Render and Vercel auto-deploys are off; the pipeline triggers them through deploy hooks only after every test job passes.
- **Exact commit, verified:** Render deploys the tested commit (`?ref=<sha>`). The pipeline then waits until `/api/health` reports it and the page's `app-version` meta tag shows it on Vercel.
- **Safe ordering:** the API deploys first, so a new UI never talks to an old API.
- **Smoke tests after deploy:** the live page loads, `/api/health` works through the Vercel proxy, and deep links like `/reports` load.
- **Fast:** jobs run in parallel with npm and MongoDB-binary caches. Newer PR pushes cancel older runs; runs on `main` never cancel mid-deploy.
- **Manual redeploy:** Actions → CI/CD → **Run workflow** re-tests and redeploys everything.

### Tests

**Backend** (Vitest + Supertest + an in-memory MongoDB via `mongodb-memory-server`). The AI is mocked, so tests never call Groq:

- auth: register/login validation, NoSQL-injection inputs rejected, per-account lockout after 10 failed sign-ins, logout blacklisting
- reports: generation, input caps, PDF type/size, summaries without resume text, one generation at a time, **another user's report is always a 404**
- quota: **20 parallel reservations against real MongoDB never exceed a limit of 10**, refunds, separate report/review allowances, burst limit
- site-wide caps: with a limit of 2 requests a minute, **exactly 2 of 5 simultaneous calls get through**; a second report doesn't fit in 7,000 tokens/min; real token counts replace estimates; retries count and stop at the cap; a provider 429 stops retries at once; 503 + Retry-After with the user's allowance refunded
- practice: answer review, validation, ownership, refunds, daily limit, best/last score summaries
- billing: plan limits and billing periods, which subscription states give access (grace period, cancel at period end), plan catalogue with no secrets
- Razorpay (SDK mocked): valid and forged checkout and webhook signatures, duplicate and out-of-order webhooks, a charge recording the payment and switching the plan, cancel keeping access until the period ends, upgrade/downgrade, reconciliation, `BILLING_DISABLED` without keys
- app-wide: JSON 404/400/413 errors, security headers, CORS

**Frontend** (Vitest + Testing Library + jsdom): the job-description markup engines, gap matching, practice ordering, plan-progress saving (batched, retried, old browser ticks uploaded), login errors, history search/sort/filter, and the practice answer and feedback components.

```bash
cd Backend && npm test
```

```bash
cd Frontend && npm test
```

**End-to-end** (Playwright, Chromium): a real browser against the production frontend build, which proxies `/api` to the real backend running on an in-memory MongoDB. Only the AI is replaced, by a fixed fake loaded through a Node module hook ([e2e/server](e2e/server)), so the backend code itself is unchanged and no Groq quota is used.

- sign-up refuses a weak password, then signs in; signed-out users are sent to sign in; sign out, wrong password, sign back in
- generate a report → practise a question and get feedback → find it in your reports → delete it
- a report link opened from another account shows "not found"

```bash
cd e2e && npm ci && npx playwright install chromium
```

```bash
npm test
```

It needs `npm ci` in Backend and Frontend first. On failure, `npm run report` opens the HTML report with traces and screenshots; in CI it's uploaded as the `playwright-report` artifact.

The first backend run downloads a MongoDB binary (about 100 MB) once; it's cached after that.

## Deployment

The project runs with the **backend on Render** (a normal long-running Node server, so AI calls aren't cut off by serverless time limits) and the **frontend on Vercel**. Vercel forwards `/api/*` to Render, so the browser only ever talks to the Vercel domain and the login cookie stays first-party.

### 1. Backend on Render

1. In MongoDB Atlas, open **Network Access** and allow `0.0.0.0/0` (Render has no fixed IP).
2. On Render, create a **Web Service** from this repository:
   - Root Directory: `Backend`
   - Build Command: `npm install`
   - Start Command: `npm start`
   - Health Check Path: `/api/health`
3. Add environment variables:

   ```env
   MONGO_URI=your_mongodb_connection_string
   JWT_SECRET=a_long_random_string
   GROQ_API_KEY=your_groq_api_key
   NODE_ENV=production
   ```

4. Deploy, then open `https://<your-service>.onrender.com/api/health`. It should return `{"status":"ok", ...}`.
5. In **Settings → Build & Deploy**, set **Auto-Deploy** to **Off** (the CI/CD pipeline deploys instead), and copy the **Deploy Hook** URL.

On Render's free plan the service sleeps when idle, so the first request after a quiet period can take up to a minute.

### 2. Point the frontend at the backend

`Frontend/vercel.json` forwards `/api/(.*)` to this project's Render service. If you deploy your own copy, replace the Render URL there with yours, then commit and push.

### 3. Frontend on Vercel

1. Import the repository on Vercel.
2. Set **Root Directory** to `Frontend`. Do not use the "Services" preset.
3. The **Application Preset** should become **Vite** (build `npm run build`, output `dist`).
4. Deploy. No environment variables are needed for this setup.
5. In **Settings → Git → Deploy Hooks**, create a hook for the `main` branch and copy its URL. `vercel.json` already turns off Vercel's own automatic deploys of `main` (PR preview deployments still work).

### 4. Connect the pipeline

In the GitHub repo, open **Settings → Secrets and variables → Actions** and add two repository secrets:

| Secret | Value |
|---|---|
| `RENDER_DEPLOY_HOOK_URL` | the Render deploy hook URL |
| `VERCEL_DEPLOY_HOOK_URL` | the Vercel deploy hook URL |

Deploy hooks are secret URLs: anyone holding one can trigger a deploy, so keep them only in GitHub secrets. From then on, every merge to `main` is tested and deployed by the pipeline.

`vercel.json` also sends every non-API route to `index.html`, so refreshing `/dashboard` or `/interview` works.

### Payments (Razorpay)

1. In the Razorpay dashboard (start in **Test Mode**), open **Account & Settings → API Keys** and generate a key. Copy the Key Id and Secret together; the secret is shown only once.
2. Turn on **Subscriptions**, then under **Subscriptions → Plans** add two monthly plans: `Pro` ₹299 and `Premium` ₹699. Or run `node scripts/createRazorpayPlans.js` in `Backend` with the keys in `.env`; it prints the plan ids.
3. Under **Webhooks**, add `https://<your-service>.onrender.com/api/billing/webhook` (the Render URL, not the Vercel proxy) with a random secret. Select the 8 `subscription.*` events and `payment.failed`.
4. On Render, add:

   ```env
   RAZORPAY_KEY_ID=rzp_test_...
   RAZORPAY_KEY_SECRET=...
   RAZORPAY_WEBHOOK_SECRET=...
   RAZORPAY_PLAN_PRO=plan_...
   RAZORPAY_PLAN_PREMIUM=plan_...
   ```

5. Redeploy. `GET /api/billing/plans` should now show Pro and Premium as `"purchasable": true`.

Test with UPI `success@razorpay`. Subscriptions need a payment method that allows recurring payments, so ordinary test cards are declined. To go live, activate the account, then repeat steps 1–4 in **Live Mode** (keys, plans and webhooks don't carry over) and replace the five values on Render.

### Calling the backend directly instead (optional)

If you'd rather not proxy through Vercel, set `VITE_API_URL=https://<your-service>.onrender.com` on Vercel, and on Render set `CLIENT_URL=https://<your-app>.vercel.app` and `COOKIE_SAMESITE=none`. Some browsers block cross-site cookies, which is why the proxy setup is recommended.

## API Flow

| Step | Action |
| ---- | ------ |
| 1 | User logs in or registers |
| 2 | User submits resume, self description, and job description |
| 3 | Frontend sends multipart form data |
| 4 | Backend authenticates user and parses resume |
| 5 | Groq generates the structured report |
| 6 | Backend validates it and saves it in MongoDB |
| 7 | Data is returned to the UI |

## Main API Routes

### Auth

```text
POST /api/auth/register
POST /api/auth/login
GET  /api/auth/logout
GET  /api/auth/get-me
PATCH  /api/auth/password   # { currentPassword, newPassword }; signs out other sessions
DELETE /api/auth/account    # { password }; deletes the account and all its data
POST   /api/auth/forgot-password  # { email }; emails a one-time reset link (same answer whether or not the account exists)
POST   /api/auth/reset-password   # { token, password }; sets the new password and signs out every session
```

### Interview Reports

```text
POST /api/interview        # generate a report; with Accept: text/event-stream it streams start, section (each finished part), retry, then done or error
GET  /api/interview        # one page of your report summaries: ?page, limit (max 50), sort (newest|oldest|high|low), q, status
GET  /api/interview/usage  # today's allowances: { usage, reviewUsage }, each { limit, used, remaining, resetsAt }
GET  /api/interview/:id    # one report in full
DELETE /api/interview/:id  # delete a report and its practice attempts
POST   /api/interview/:id/share  # turn on the read-only share link, returns { shareToken }
DELETE /api/interview/:id/share  # turn the share link off
GET    /api/shared/:token         # public: a shared report (no owner data)
PATCH /api/interview/:id/progress   # save ticked plan tasks, body: { "completedTasks": ["0-1", "2-0"] }
POST /api/interview/:id/practice    # review one answer, body: { kind, index, answer, durationSeconds, inputMode }
GET  /api/interview/:id/practice    # per-question attempts, best/last score and latest feedback
GET  /api/interview/:id/practice/progress  # averages (overall, per kind, per criterion), weakest area, 30-day trend
```

### Billing

```text
GET  /api/billing/plans        # public: Free / Pro / Premium with prices (paise), limits, features, purchasable
GET  /api/billing/me           # your plan, subscription status, billing period, usage, scheduled downgrade
POST /api/billing/subscribe    # { planId } → { subscriptionId, keyId } for Razorpay Checkout
POST /api/billing/verify       # Checkout's { razorpay_payment_id, razorpay_subscription_id, razorpay_signature }
POST /api/billing/cancel       # cancel at the end of the paid period
POST /api/billing/resume       # undo a pending cancellation
POST /api/billing/change-plan  # { planId }: upgrade now, downgrade at period end
GET  /api/billing/invoices     # your payments
POST /api/billing/webhook      # Razorpay only, signed (raw body)
```

### Admin (role "admin" only)

```text
GET    /api/admin/stats      # totals, last 7 days, today's site-wide AI usage
GET    /api/admin/users      # users with report/practice counts: ?page, q
DELETE /api/admin/users/:id  # delete a user and all their data (not yourself, not an admin); audited
GET    /api/admin/audit      # latest admin actions
```

Nobody can become admin through the app. Set it once in MongoDB (Atlas → Browse Collections → `users`, or `mongosh`):

```js
db.users.updateOne({ email: "you@example.com" }, { $set: { role: "admin" } })
```

The role is read from the database on every request, so it applies to an existing session immediately; an **Admin** link then appears in the sidebar.

### Health

```text
GET  /api/health
```

## Future Improvements

- Performance scoring dashboard
- Difficulty levels: easy, medium, hard

## Interview Explanation

I built Interview Lab, an AI-powered interview preparation platform using the MERN stack and the Groq API. Users paste a job description, optionally upload a resume, and get a structured report: match score, likely technical and behavioral questions with the intent behind each, skill gaps highlighted inside the job description, and a five-day plan they can tick off. Free, Pro and Premium plans are sold as monthly Razorpay subscriptions, with signed webhooks keeping each user's plan and allowances in step with their payments. The AI output is validated against a Zod schema before it's saved, and the app is deployed with the frontend on Vercel proxying to an Express backend on Render.

## What This Project Shows

- Full-stack development with MERN
- Authentication with HTTP-only JWT cookies
- File upload and PDF parsing
- LLM integration with schema-validated, retried structured output
- REST API design
- Payment integration: Razorpay subscriptions, signature verification, idempotent and order-safe webhooks
- MongoDB data persistence, including atomic per-user daily and monthly quotas
- Production hardening: rate limiting, input limits, security headers
- Automated tests against a real in-memory database, and a CI/CD pipeline that deploys only tested, verified commits
- Production deployment across Vercel and Render with a same-origin API proxy
- A distinctive, interactive UI built without a component library
