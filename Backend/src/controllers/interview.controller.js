const pdfParse = require('pdf-parse')
const {generateInterviewReport} = require("../services/ai.service")
const interviewReportModel = require("../models/interviewReport.model")

async function generateInterViewReportController(req,res){

const data = await pdfParse(req.file.buffer);
const resumeText = data.text;

 const {selfDescription, jobDescription } = req.body

 const InterviewReportByAi = await generateInterviewReport({
  resume: resumeText,
  selfDescription,
  jobDescription
 })

 const interviewReport = await interviewReportModel.create({
  user: req.user.id,
  resume: resumeText,
  selfDescription,
  jobDescription,
  ...InterviewReportByAi
 })

 res.status(201).json({
  message: "Interview report successfully",
  interviewReport
 })
}

module.exports = {generateInterViewReportController}
