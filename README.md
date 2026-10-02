# AI-Powered Interview Preparation Platform (MERN + Gemini)

## Overview

This is a full-stack web application built with the MERN stack and Gemini API to help users prepare for interviews in a focused, role-specific way.

Users can register or log in, upload an optional resume PDF, enter a self description and job description, and generate a structured interview preparation report.

## Problem Statement

- Interview preparation is often too generic.
- Candidates may not know which questions match a specific job description.
- There is no simple structured workflow for practicing against real roles.

## Solution

The platform takes:

- Resume PDF text, if uploaded
- User self description
- Job description

Then Gemini generates:

- Match score
- Technical interview questions
- Behavioral interview questions
- Suggested answers
- Skill gaps
- Five-day preparation plan

Reports are saved in MongoDB for the logged-in user.

## Features

- User registration, login, logout, and protected routes
- JWT cookie based authentication
- Optional PDF resume upload
- Job description and self-description input
- Gemini-powered structured interview report generation
- Match score, questions, answers, skill gaps, and preparation plan
- MongoDB persistence for interview reports
- React + Vite frontend
- Express REST API backend

## How It Works

1. User registers or logs in.
2. User opens the interview report page.
3. User uploads a resume PDF, optionally enters self description, and pastes the job description.
4. Frontend sends multipart form data to the backend.
5. Backend authenticates the user through the JWT cookie.
6. Backend extracts resume text from the PDF.
7. Backend calls Gemini API for a structured JSON report.
8. Backend saves the report in MongoDB with a readable title.
9. Frontend displays the generated report.

## Project Structure

```text
AI_POWERED_INTERVIEW_PLATFORM/
├── Backend/
│   ├── src/
│   │   ├── config/
│   │   ├── controllers/
│   │   ├── middlewares/
│   │   ├── models/
│   │   ├── routes/
│   │   └── services/
│   ├── package.json
│   └── server.js
├── Frontend/
│   ├── src/
│   │   ├── features/
│   │   ├── app.router.jsx
│   │   └── main.jsx
│   ├── package.json
│   └── vite.config.js
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

### AI Integration

- Groq (`groq-sdk`, default model `openai/gpt-oss-120b`) when `GROQ_API_KEY` is set
- Otherwise Gemini through `@google/genai` (default model `gemini-2.5-flash`)
- Responses are validated against a Zod schema and retried up to 3 times

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

Create a `.env` file inside `Backend`:

```env
PORT=3000
MONGO_URI=your_mongodb_connection_string
JWT_SECRET=your_jwt_secret
GROQ_API_KEY=your_groq_api_key
```

To use Gemini instead, leave `GROQ_API_KEY` out and set `GOOGLE_GENAI_API_KEY`.

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

## Deployment

The recommended setup is the **backend on Render** (a normal long-running Node server, so slow Gemini calls aren't cut off) and the **frontend on Vercel**. Vercel forwards `/api/*` to Render, so the browser only ever talks to your Vercel domain and the login cookie stays first-party.

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

4. Deploy, then open `https://<your-service>.onrender.com/api/health`. It should return `{"status":"ok"}`.

On Render's free plan the service sleeps when idle, so the first request after a quiet period can take up to a minute.

### 2. Point the frontend at the backend

In `Frontend/vercel.json`, replace `YOUR-BACKEND.onrender.com` with your Render URL, then commit and push.

### 3. Frontend on Vercel

1. Import the repository on Vercel.
2. Set **Root Directory** to `Frontend`. Do not use the "Services" preset.
3. The **Application Preset** should become **Vite** (build `npm run build`, output `dist`).
4. Deploy. No environment variables are needed for this setup.

`vercel.json` also sends every non-API route to `index.html`, so refreshing `/dashboard` or `/interview` works.

### Calling the backend directly instead (optional)

If you'd rather not proxy through Vercel, set `VITE_API_URL=https://<your-service>.onrender.com` on Vercel, and on Render set `CLIENT_URL=https://<your-app>.vercel.app` and `COOKIE_SAMESITE=none`. Some browsers block cross-site cookies, which is why the proxy setup is recommended.

## API Flow

| Step | Action |
| ---- | ------ |
| 1 | User logs in or registers |
| 2 | User submits resume, self description, and job description |
| 3 | Frontend sends multipart form data |
| 4 | Backend authenticates user and parses resume |
| 5 | Gemini generates structured report |
| 6 | Backend saves report in MongoDB |
| 7 | Data is returned to the UI |

## Main API Routes

### Auth

```text
POST /api/auth/register
POST /api/auth/login
GET  /api/auth/logout
GET  /api/auth/get-me
```

### Health

```text
GET  /api/health
```

### Interview Reports

```text
POST /api/interview/
GET  /api/interview/
```

## Future Improvements

- Report history page in the frontend
- Mock interview mode, question by question
- AI-based answer evaluation
- Voice-based interview practice
- Performance scoring dashboard
- Difficulty levels: easy, medium, hard

## Interview Explanation

I built an AI-powered interview preparation platform using the MERN stack and Gemini API. Users can log in, upload a resume, add their profile and job description, and generate a structured interview report with questions, answers, skill gaps, match score, and a preparation plan.

## What This Project Shows

- Full-stack development with MERN
- Authentication with JWT cookies
- File upload and PDF parsing
- LLM integration in a real-world workflow
- REST API design
- MongoDB data persistence
- Frontend-backend integration
