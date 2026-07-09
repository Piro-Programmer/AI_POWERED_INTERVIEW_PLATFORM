// Import from the lib path directly: importing the package root runs pdf-parse's
// debug harness (it tries to read a bundled test PDF) and crashes under ESM.
import pdfParse from "pdf-parse/lib/pdf-parse.js";
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

/**
 * @name getMyReportsController
 * @description List the logged-in user's interview reports (newest first).
 * @access private
 */
async function getMyReportsController(req, res) {
  try {
    const reports = await interviewReportModel
      .find({ user: req.user.id })
      .sort({ createdAt: -1 });

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

export default {
  generateInterviewReportController,
  getMyReportsController
};
