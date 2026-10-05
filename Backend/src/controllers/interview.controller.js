// Import from the lib path directly: importing the package root runs pdf-parse's
// debug harness (it tries to read a bundled test PDF) and crashes under ESM.
import pdfParse from "pdf-parse/lib/pdf-parse.js";
import mongoose from "mongoose";
import generateInterviewReport from "../services/ai.service.js";
import interviewReportModel from "../models/interviewReport.model.js";
import { getUsage, refundGeneration, reserveGeneration } from "../services/aiQuota.service.js";

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
 * @name generateInterviewReportController
 * @description Parse the uploaded resume PDF, generate a structured interview
 *              report via the AI service, persist it, and return it.
 *              Each successful generation uses one of the user's daily allowance.
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

    const reportByAi = await generateInterviewReport({
      resume: resumeText,
      selfDescription,
      jobDescription
    });

    const interviewReport = await interviewReportModel.create({
      user: userId,
      title: createReportTitle(jobDescription),
      resume: resumeText,
      selfDescription,
      jobDescription,
      ...reportByAi
    });

    return res.status(201).json({
      message: "Interview report generated successfully",
      interviewReport,
      usage: reservation.usage
    });
  } catch (err) {
    // A failed generation shouldn't cost the user a report
    if (reservation) {
      await refundGeneration(userId, reservation.day).catch((refundErr) =>
        console.error("refundGeneration failed:", refundErr.message)
      );
    }
    console.error("generateInterviewReport failed:", err.message);
    return res.status(500).json({
      message: "Failed to generate interview report",
      error: err.message
    });
  } finally {
    generating.delete(userId);
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

// The list only needs enough to draw a row, not every question and answer.
function toReportSummary(report) {
  return {
    _id: report._id,
    title: report.title,
    createdAt: report.createdAt,
    matchScore: report.matchScore,
    jobDescription: report.jobDescription,
    skillGaps: report.skillGaps || [],
    technicalCount: report.technicalQuestions?.length || 0,
    behavioralCount: report.behavioralQuestions?.length || 0,
    planDays: report.preparationPlan?.length || 0,
    planTaskCount: (report.preparationPlan || []).reduce((sum, day) => sum + (day.tasks?.length || 0), 0),
    // null = report predates saved progress (ticks may still be only in the browser)
    completedCount: Array.isArray(report.completedTasks) ? report.completedTasks.length : null
  };
}

/**
 * @name getMyReportsController
 * @description List the logged-in user's interview reports (newest first) as summaries.
 * @access private
 */
async function getMyReportsController(req, res) {
  try {
    const reports = (await interviewReportModel
      .find({ user: req.user.id })
      .select("-resume -selfDescription")
      .sort({ createdAt: -1 })
      .lean()).map(toReportSummary);

    return res.status(200).json({
      message: "Interview reports fetched successfully",
      reports
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

export default {
  generateInterviewReportController,
  getUsageController,
  getMyReportsController,
  getReportByIdController,
  updateProgressController
};
