// Import from the lib path directly: importing the package root runs pdf-parse's
// debug harness (it tries to read a bundled test PDF) and crashes under ESM.
import pdfParse from "pdf-parse/lib/pdf-parse.js";
import mongoose from "mongoose";
import { randomBytes } from "node:crypto";
import generateInterviewReport from "../services/ai.service.js";
import interviewReportModel from "../models/interviewReport.model.js";
import practiceAttemptModel from "../models/practiceAttempt.model.js";
import { getUsage, refundGeneration, reserveGeneration } from "../services/aiQuota.service.js";
import { AiCapacityError } from "../services/aiCapacity.service.js";

function createReportTitle(jobDescription) {
  const normalizedDescription = jobDescription
    .replace(/\s+/g, " ")
    .trim();

  const roleMatch = normalizedDescription.match(
    /(?:role|position|job title|title)\s*[:\-]\s*([a-z0-9 .,+#/()-]{2,60})/i
  );

  const titleSource = roleMatch?.[1] || normalizedDescription;
  const cleanTitle = titleSource
    .replace(/[^a-z0-9 .,+#/()-]/gi, "")
    .split(" ")
    .filter(Boolean)
    .slice(0, 6)
    .join(" ");

  return cleanTitle
    ? `Interview Report - ${cleanTitle}`
    : "Interview Report";
}

// Input caps keep a single request from sending a huge prompt to the AI.
const MAX_JOB_DESCRIPTION = 15000;
const MAX_SELF_DESCRIPTION = 5000;
const MAX_RESUME_TEXT = 20000;

// Users with a generation in progress. One at a time per user, so parallel
// requests can't race the daily allowance or double the AI cost.
const generating = new Set();

/**
 * Server-sent events on an already-open response. Proxies may close a quiet
 * connection, so a comment line goes out every 15 seconds while waiting.
 */
function openEventStream(res) {
  res.writeHead(200, {
    "Content-Type": "text/event-stream; charset=utf-8",
    "Cache-Control": "no-cache, no-transform",
    Connection: "keep-alive",
    "X-Accel-Buffering": "no" // ask nginx-style proxies not to buffer
  });
  res.flushHeaders?.();
  const heartbeat = setInterval(() => res.write(": keep-alive\n\n"), 15000);
  return {
    send(event, data) {
      if (!res.writableEnded) res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
    },
    end() {
      clearInterval(heartbeat);
      if (!res.writableEnded) res.end();
    }
  };
}

/**
 * @name generateInterviewReportController
 * @description Parse the uploaded resume PDF, generate a structured interview
 *              report via the AI service, persist it, and return it.
 *              Each successful generation uses one of the user's daily allowance.
 *              With "Accept: text/event-stream" the answer is a stream of
 *              events instead: start, section (each finished part, as a
 *              preview), retry, then done { interviewReport, usage } or
 *              error { status, message, ... }. Problems found before the AI
 *              starts (bad input, limits) are plain JSON errors either way.
 * @access private
 */
async function generateInterviewReportController(req, res) {
  const userId = req.user.id;
  const jobDescription = typeof req.body?.jobDescription === "string" ? req.body.jobDescription.trim() : "";
  const selfDescription = typeof req.body?.selfDescription === "string" ? req.body.selfDescription.trim() : "";

  if (!jobDescription) {
    return res.status(400).json({ message: "Job description is required" });
  }
  if (jobDescription.length > MAX_JOB_DESCRIPTION) {
    return res.status(400).json({
      message: `Job description is too long (max ${MAX_JOB_DESCRIPTION.toLocaleString("en-US")} characters).`
    });
  }
  if (selfDescription.length > MAX_SELF_DESCRIPTION) {
    return res.status(400).json({
      message: `Profile is too long (max ${MAX_SELF_DESCRIPTION.toLocaleString("en-US")} characters).`
    });
  }

  if (generating.has(userId)) {
    return res.status(429).json({
      message: "A report is already being generated for your account. Wait for it to finish."
    });
  }

  generating.add(userId);
  let reservation = null;
  let stream = null;

  try {
    reservation = await reserveGeneration(userId);

    if (!reservation) {
      const usage = await getUsage(userId);
      return res.status(429).json({
        code: "DAILY_LIMIT",
        message: `You've used all ${usage.limit} reports for today.`,
        usage
      });
    }

    let resumeText = "";
    if (req.file?.buffer) {
      const data = await pdfParse(req.file.buffer);
      resumeText = data.text.slice(0, MAX_RESUME_TEXT);
    }

    // From here on, a streaming client hears about progress as it happens.
    // If the client goes away, the report is still finished and saved.
    if (req.get("accept")?.includes("text/event-stream")) {
      stream = openEventStream(res);
      stream.send("start", { usage: reservation.usage });
    }
    const onProgress = stream
      ? (event) =>
          event.type === "attempt"
            ? event.attempt > 1 && stream.send("retry", { attempt: event.attempt })
            : stream.send("section", { key: event.key, value: event.value })
      : undefined;

    const reportByAi = await generateInterviewReport({
      resume: resumeText,
      selfDescription,
      jobDescription,
      onProgress
    });

    const interviewReport = await interviewReportModel.create({
      user: userId,
      title: createReportTitle(jobDescription),
      // resumeText is deliberately not saved: it's only needed for the AI call
      selfDescription,
      jobDescription,
      ...reportByAi
    });

    const body = { message: "Interview report generated successfully", interviewReport, usage: reservation.usage };
    if (stream) {
      stream.send("done", body);
      return;
    }
    return res.status(201).json(body);
  } catch (err) {
    // A failed generation shouldn't cost the user a report
    if (reservation) {
      await refundGeneration(userId, reservation.day).catch((refundErr) =>
        console.error("refundGeneration failed:", refundErr.message)
      );
    }
    let status = 500;
    let body = { message: "Failed to generate interview report", error: err.message };
    if (err instanceof AiCapacityError) {
      status = 503;
      body = { code: err.code, message: err.message, retryAfterSeconds: err.retryAfterSeconds };
    } else {
      console.error("generateInterviewReport failed:", err.message);
    }

    // the stream is already open with 200, so the error travels as an event
    if (stream) {
      stream.send("error", { status, ...body });
      return;
    }
    if (status === 503) res.set("Retry-After", String(body.retryAfterSeconds));
    return res.status(status).json(body);
  } finally {
    generating.delete(userId);
    stream?.end();
  }
}

/**
 * @name getUsageController
 * @description How many AI reports the user has left today.
 * @access private
 */
async function getUsageController(req, res) {
  try {
    const [usage, reviewUsage] = await Promise.all([
      getUsage(req.user.id, "report"),
      getUsage(req.user.id, "review")
    ]);
    return res.status(200).json({ usage, reviewUsage });
  } catch (err) {
    console.error("getUsage failed:", err.message);
    return res.status(500).json({ message: "Failed to fetch usage", error: err.message });
  }
}

// ---------------------------------------------------------------------------
// Report history: one page of summaries, filtered, searched and sorted on the
// server, plus stats over all of the user's reports. One aggregation.

const PAGE_SIZE = 20;
const MAX_PAGE_SIZE = 50;
const MAX_QUERY = 100;
const SORTS = {
  newest: { createdAt: -1, _id: -1 },
  oldest: { createdAt: 1, _id: 1 },
  high: { matchScore: -1, createdAt: -1, _id: -1 },
  low: { matchScore: 1, createdAt: -1, _id: -1 }
};
const STATUSES = new Set(["not-started", "in-progress", "done"]);

const escapeRegex = (text) => text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
const sizeOf = (path) => ({ $size: { $ifNull: [path, []] } });
const toInt = (value, fallback, min, max) => {
  const n = Number.parseInt(value, 10);
  return Number.isNaN(n) ? fallback : Math.min(max, Math.max(min, n));
};

// The list only needs enough to draw a row, not every question and answer.
const SUMMARY = {
  title: 1,
  createdAt: 1,
  matchScore: 1,
  // first part only: the row shows one line, and search runs on the server
  jobDescription: { $substrCP: [{ $ifNull: ["$jobDescription", ""] }, 0, 300] },
  skillGaps: { $ifNull: ["$skillGaps", []] },
  technicalCount: sizeOf("$technicalQuestions"),
  behavioralCount: sizeOf("$behavioralQuestions"),
  planDays: sizeOf("$preparationPlan"),
  planTaskCount: {
    $sum: { $map: { input: { $ifNull: ["$preparationPlan", []] }, as: "day", in: sizeOf("$$day.tasks") } }
  },
  // null = report predates saved progress (ticks may still be only in the browser)
  completedCount: { $cond: [{ $isArray: "$completedTasks" }, { $size: "$completedTasks" }, null] }
};

const STATUS = {
  $switch: {
    branches: [
      {
        case: { $and: [{ $gt: ["$planTaskCount", 0] }, { $gte: [{ $ifNull: ["$completedCount", 0] }, "$planTaskCount"] }] },
        then: "done"
      },
      { case: { $gt: [{ $ifNull: ["$completedCount", 0] }, 0] }, then: "in-progress" }
    ],
    default: "not-started"
  }
};

/**
 * @name getMyReportsController
 * @description One page of the logged-in user's report summaries.
 *   Query: page (1-based), limit (max 50), sort (newest|oldest|high|low),
 *          q (search in title and job description), status (not-started|in-progress|done).
 *   Returns { reports, page, pageSize, total, hasMore, stats: { count, average, best } };
 *   total counts the filtered reports, stats cover all of them.
 * @access private
 */
async function getMyReportsController(req, res) {
  try {
    const page = toInt(req.query.page, 1, 1, 10000);
    const pageSize = toInt(req.query.limit, PAGE_SIZE, 1, MAX_PAGE_SIZE);
    const sort = SORTS[req.query.sort] || SORTS.newest;
    const q = typeof req.query.q === "string" ? req.query.q.trim().slice(0, MAX_QUERY) : "";
    const status = STATUSES.has(req.query.status) ? req.query.status : null;

    const filters = {};
    if (q) {
      const re = new RegExp(escapeRegex(q), "i");
      filters.$or = [{ title: re }, { jobDescription: re }];
    }

    // The filtered rows, shared by the "total" and "page" branches below.
    // Search runs on the full job description, before it's trimmed.
    const filtered = [
      ...(q ? [{ $match: { $or: filters.$or } }] : []),
      { $project: SUMMARY },
      { $addFields: { status: STATUS } },
      ...(status ? [{ $match: { status } }] : [])
    ];

    const [result] = await interviewReportModel.aggregate([
      { $match: { user: new mongoose.Types.ObjectId(req.user.id) } },
      {
        $facet: {
          stats: [
            {
              $group: {
                _id: null,
                count: { $sum: 1 },
                average: { $avg: "$matchScore" },
                best: { $max: "$matchScore" }
              }
            }
          ],
          total: [...filtered, { $count: "n" }],
          page: [...filtered, { $sort: sort }, { $skip: (page - 1) * pageSize }, { $limit: pageSize }]
        }
      }
    ]);

    const total = result.total[0]?.n || 0;
    const stats = result.stats[0];

    return res.status(200).json({
      message: "Interview reports fetched successfully",
      reports: result.page,
      page,
      pageSize,
      total,
      hasMore: page * pageSize < total,
      stats: {
        count: stats?.count || 0,
        average: typeof stats?.average === "number" ? Math.round(stats.average) : null,
        best: typeof stats?.best === "number" ? stats.best : null
      }
    });
  } catch (err) {
    console.error("getMyReports failed:", err.message);
    return res.status(500).json({
      message: "Failed to fetch interview reports",
      error: err.message
    });
  }
}

/**
 * @name getReportByIdController
 * @description Fetch one of the logged-in user's reports in full.
 * @access private
 */
async function getReportByIdController(req, res) {
  try {
    const { id } = req.params;

    if (!mongoose.isValidObjectId(id)) {
      return res.status(404).json({ message: "Report not found" });
    }

    const interviewReport = await interviewReportModel
      .findOne({ _id: id, user: req.user.id })
      .select("-resume")
      .lean();

    if (!interviewReport) {
      return res.status(404).json({ message: "Report not found" });
    }

    return res.status(200).json({
      message: "Interview report fetched successfully",
      interviewReport
    });
  } catch (err) {
    console.error("getReportById failed:", err.message);
    return res.status(500).json({
      message: "Failed to fetch interview report",
      error: err.message
    });
  }
}

const TASK_ID = /^\d{1,3}-\d{1,3}$/;

/**
 * @name updateProgressController
 * @description Save which preparation-plan tasks the user has ticked.
 *              Expects { completedTasks: ["0-0", "1-2", ...] } (dayIndex-taskIndex).
 * @access private
 */
async function updateProgressController(req, res) {
  try {
    const { id } = req.params;
    const { completedTasks } = req.body || {};

    if (!mongoose.isValidObjectId(id)) {
      return res.status(404).json({ message: "Report not found" });
    }

    if (
      !Array.isArray(completedTasks) ||
      completedTasks.length > 500 ||
      !completedTasks.every((task) => typeof task === "string" && TASK_ID.test(task))
    ) {
      return res.status(400).json({
        message: 'completedTasks must be a list of task ids like "0-1"'
      });
    }

    const report = await interviewReportModel
      .findOne({ _id: id, user: req.user.id })
      .select("preparationPlan")
      .lean();

    if (!report) {
      return res.status(404).json({ message: "Report not found" });
    }

    // Keep only ids that point at a real task in this report's plan
    const valid = [...new Set(completedTasks)].filter((task) => {
      const [day, index] = task.split("-").map(Number);
      return index < (report.preparationPlan?.[day]?.tasks?.length || 0);
    });

    await interviewReportModel.updateOne(
      { _id: id, user: req.user.id },
      { $set: { completedTasks: valid } }
    );

    return res.status(200).json({
      message: "Progress saved",
      completedTasks: valid
    });
  } catch (err) {
    console.error("updateProgress failed:", err.message);
    return res.status(500).json({
      message: "Failed to save progress",
      error: err.message
    });
  }
}

/**
 * @name deleteReportController
 * @description Delete one of the logged-in user's reports and its practice attempts.
 * @access private
 */
async function deleteReportController(req, res) {
  try {
    const { id } = req.params;

    if (!mongoose.isValidObjectId(id)) {
      return res.status(404).json({ message: "Report not found" });
    }

    // Owner check is part of the query, so another user's id is just "not found"
    const { deletedCount } = await interviewReportModel.deleteOne({ _id: id, user: req.user.id });
    if (!deletedCount) {
      return res.status(404).json({ message: "Report not found" });
    }

    await practiceAttemptModel.deleteMany({ report: id, user: req.user.id });

    return res.status(200).json({ message: "Report deleted" });
  } catch (err) {
    console.error("deleteReport failed:", err.message);
    return res.status(500).json({
      message: "Failed to delete report",
      error: err.message
    });
  }
}

/**
 * @name shareReportController
 * @description Turn on the read-only share link for one of the user's reports.
 *              Reuses the existing token if the report is already shared.
 * @access private
 */
async function shareReportController(req, res) {
  try {
    const { id } = req.params;
    if (!mongoose.isValidObjectId(id)) {
      return res.status(404).json({ message: "Report not found" });
    }

    // 24 random bytes = 192 bits: not guessable, and URL-safe as base64url
    const report = await interviewReportModel
      .findOneAndUpdate(
        { _id: id, user: req.user.id, shareToken: { $exists: false } },
        { $set: { shareToken: randomBytes(24).toString("base64url") } },
        { new: true }
      )
      .select("shareToken")
      .lean() ||
      (await interviewReportModel.findOne({ _id: id, user: req.user.id }).select("shareToken").lean());

    if (!report) {
      return res.status(404).json({ message: "Report not found" });
    }

    return res.status(200).json({ message: "Share link is on", shareToken: report.shareToken });
  } catch (err) {
    console.error("shareReport failed:", err.message);
    return res.status(500).json({ message: "Failed to share report", error: err.message });
  }
}

/**
 * @name unshareReportController
 * @description Turn the share link off: the old link stops working at once.
 * @access private
 */
async function unshareReportController(req, res) {
  try {
    const { id } = req.params;
    if (!mongoose.isValidObjectId(id)) {
      return res.status(404).json({ message: "Report not found" });
    }

    const { matchedCount } = await interviewReportModel.updateOne(
      { _id: id, user: req.user.id },
      { $unset: { shareToken: "" } }
    );
    if (!matchedCount) {
      return res.status(404).json({ message: "Report not found" });
    }

    return res.status(200).json({ message: "Share link is off" });
  } catch (err) {
    console.error("unshareReport failed:", err.message);
    return res.status(500).json({ message: "Failed to stop sharing", error: err.message });
  }
}

// What a shared link shows: the prep itself, never the owner, their profile
// text or their plan progress.
const SHARED_FIELDS =
  "title jobDescription matchScore technicalQuestions behavioralQuestions skillGaps preparationPlan createdAt";
const SHARE_TOKEN = /^[A-Za-z0-9_-]{32}$/;

/**
 * @name getSharedReportController
 * @description A report opened through its share link (no sign-in needed).
 * @access public
 */
async function getSharedReportController(req, res) {
  try {
    const { token } = req.params;

    // Not indexed by search engines, not kept by shared caches
    res.set("X-Robots-Tag", "noindex, nofollow");
    res.set("Cache-Control", "no-store");

    if (!SHARE_TOKEN.test(token)) {
      return res.status(404).json({ message: "This link doesn't work any more." });
    }

    const report = await interviewReportModel.findOne({ shareToken: token }).select(SHARED_FIELDS).lean();
    if (!report) {
      return res.status(404).json({ message: "This link doesn't work any more." });
    }

    const { _id, ...shared } = report;
    return res.status(200).json({ report: shared });
  } catch (err) {
    console.error("getSharedReport failed:", err.message);
    return res.status(500).json({ message: "Failed to load shared report", error: err.message });
  }
}

export default {
  shareReportController,
  unshareReportController,
  getSharedReportController,
  generateInterviewReportController,
  getUsageController,
  getMyReportsController,
  getReportByIdController,
  updateProgressController,
  deleteReportController
};
