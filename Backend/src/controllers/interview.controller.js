// Import from the lib path directly: importing the package root runs pdf-parse's
// debug harness (it tries to read a bundled test PDF) and crashes under ESM.
import pdfParse from "pdf-parse/lib/pdf-parse.js";
import mongoose from "mongoose";
import generateInterviewReport from "../services/ai.service.js";
import interviewReportModel from "../models/interviewReport.model.js";

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

/**
 * @name generateInterviewReportController
 * @description Parse the uploaded resume PDF, generate a structured interview
 *              report via the AI service, persist it, and return it.
 * @access private
 */
async function generateInterviewReportController(req, res) {
  try {
    const { selfDescription, jobDescription } = req.body;

    if (!jobDescription) {
      return res.status(400).json({
        message: "Job description is required"
      });
    }

    let resumeText = "";
    if (req.file?.buffer) {
      const data = await pdfParse(req.file.buffer);
      resumeText = data.text;
    }

    const reportByAi = await generateInterviewReport({
      resume: resumeText,
      selfDescription,
      jobDescription
    });

    const interviewReport = await interviewReportModel.create({
      user: req.user.id,
      title: createReportTitle(jobDescription),
      resume: resumeText,
      selfDescription,
      jobDescription,
      ...reportByAi
    });

    return res.status(201).json({
      message: "Interview report generated successfully",
      interviewReport
    });
  } catch (err) {
    console.error("generateInterviewReport failed:", err.message);
    return res.status(500).json({
      message: "Failed to generate interview report",
      error: err.message
    });
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
    planTaskCount: (report.preparationPlan || []).reduce((sum, day) => sum + (day.tasks?.length || 0), 0)
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

export default {
  generateInterviewReportController,
  getMyReportsController,
  getReportByIdController
};
