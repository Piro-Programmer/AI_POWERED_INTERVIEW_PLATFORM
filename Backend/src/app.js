import express from "express";
import helmet from "helmet";
import multer from "multer";
import authRouter from "./routes/auth.routes.js";
import interviewRouter from "./routes/interview.routes.js";
import cookieParser from "cookie-parser";
import cors from "cors";
import { apiLimiter } from "./middlewares/rateLimit.middleware.js";
import { isDBConnected } from "./config/database.js";

const app = express();

// Requests reach Express through proxies (Vercel's /api rewrite, then
// Render's load balancer). Trusting that many hops lets req.ip be the real
// client for the per-IP limits. Set TRUST_PROXY_HOPS=0 when running bare.
app.set("trust proxy", Number.parseInt(process.env.TRUST_PROXY_HOPS ?? "2", 10));

app.use(helmet({
  // allow the optional direct-call setup (VITE_API_URL) to read responses
  crossOriginResourcePolicy: { policy: "cross-origin" }
}));
app.use(express.json({ limit: "100kb" }));
app.use(cookieParser());

// Comma-separated list of frontend origins allowed to call the API directly,
// e.g. "https://your-app.vercel.app,http://localhost:5173".
const allowedOrigins = (process.env.CLIENT_URL || "http://localhost:5173")
  .split(",")
  .map((origin) => origin.trim().replace(/\/$/, ""))
  .filter(Boolean);

app.use(cors({
  origin: allowedOrigins,
  credentials: true
}));

// Lightweight check for hosting platforms (e.g. Render's health check path).
// Declared before the limiter so frequent health checks never count.
// `commit` lets the CD pipeline confirm the tested commit is the one running
// (Render sets RENDER_GIT_COMMIT for every deploy). Answers 503 while the
// database is unreachable, so the platform and the pipeline see the outage.
app.get("/api/health", (req, res) => {
  const dbUp = isDBConnected();
  res.status(dbUp ? 200 : 503).json({
    status: dbUp ? "ok" : "degraded",
    db: dbUp ? "up" : "down",
    commit: process.env.RENDER_GIT_COMMIT || null
  });
});

app.use("/api", apiLimiter);
app.use("/api/auth", authRouter);
app.use("/api/interview", interviewRouter);

app.use("/api", (req, res) => {
  res.status(404).json({ message: "Not found" });
});

// Turn upload, body-size and validation errors into JSON the frontend can show
// eslint-disable-next-line no-unused-vars
app.use((err, req, res, next) => {
  if (err instanceof multer.MulterError) {
    const tooBig = err.code === "LIMIT_FILE_SIZE";
    return res.status(tooBig ? 413 : 400).json({
      message: tooBig ? "Resume PDF must be 3 MB or smaller." : "Only one resume file can be uploaded."
    });
  }
  if (err.type === "entity.too.large") {
    return res.status(413).json({ message: "Request is too large." });
  }
  if (err.type === "entity.parse.failed") {
    return res.status(400).json({ message: "Request body isn't valid JSON." });
  }
  if (err.status >= 400 && err.status < 500) {
    return res.status(err.status).json({ message: err.message });
  }

  console.error("Unhandled error:", err);
  return res.status(500).json({ message: "Something went wrong." });
});

export default app;



// Server Initiated here and instance creation
// middlewares aur jo bhi ham routes create krte h un sabko use krna

// const express = require("express");
// const authRouter = require("./routes/auth.routes")
// const interviewRouter = require("./routes/interview.routes")
// const cookieParser = require("cookie-parser")
// const cors = require("cors")

// const app = express();
// app.use(express.json())
// app.use(cookieParser())

// app.use(cors({
//   origin: "http://localhost:5173",
//   credentials: true
// }))


// app.use("/api/auth",authRouter)
// app.use("/api/interview", interviewRouter)


// export default app;
