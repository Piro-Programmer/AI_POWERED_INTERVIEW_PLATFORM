import mongoose from "mongoose";
import interviewReportModel from "../models/interviewReport.model.js";
import practiceAttemptModel from "../models/practiceAttempt.model.js";
import { evaluateAnswer } from "../services/ai.service.js";
import { getUsage, refundGeneration, reserveGeneration } from "../services/aiQuota.service.js";

const MIN_ANSWER = 20;
const MAX_ANSWER = 4000;
const QUESTION_FIELD = { technical: "technicalQuestions", behavioral: "behavioralQuestions" };

// Users with a review in progress (one at a time, like report generation)
const reviewing = new Set();

const notFound = (res) => res.status(404).json({ message: "Report not found" });

const roleSummary = (report) =>
  `${(report.title || "").replace(/^Interview Report\s*-\s*/i, "")}. ${(report.jobDescription || "").slice(0, 600)}`;

/**
 * @name submitPracticeAnswerController
 * @description Review one practice answer with the AI and save the attempt.
 *              Uses one of the user's daily review allowance.
 * @access private
 */
async function submitPracticeAnswerController(req, res) {
  const userId = req.user.id;
  const { id } = req.params;
  const { kind, index, answer, durationSeconds, inputMode } = req.body || {};

  if (!mongoose.isValidObjectId(id)) return notFound(res);

  if (!QUESTION_FIELD[kind] || !Number.isInteger(index) || index < 0) {
    return res.status(400).json({ message: 'kind must be "technical" or "behavioral" and index a question number' });
  }
  const text = typeof answer === "string" ? answer.trim() : "";
  if (text.length < MIN_ANSWER) {
    return res.status(400).json({ message: `Write at least ${MIN_ANSWER} characters so there's something to review.` });
  }
  if (text.length > MAX_ANSWER) {
    return res.status(400).json({ message: `Answers can be up to ${MAX_ANSWER.toLocaleString("en-US")} characters.` });
  }

  const report = await interviewReportModel
    .findOne({ _id: id, user: userId })
    .select(`title jobDescription ${QUESTION_FIELD[kind]}`)
    .lean();
  if (!report) return notFound(res);

  const question = report[QUESTION_FIELD[kind]]?.[index];
  if (!question) {
    return res.status(400).json({ message: "That question doesn't exist in this report." });
  }

  if (reviewing.has(userId)) {
    return res.status(429).json({ message: "Your previous answer is still being reviewed. Wait for it to finish." });
  }

  reviewing.add(userId);
  let reservation = null;

  try {
    reservation = await reserveGeneration(userId, "review");
    if (!reservation) {
      const usage = await getUsage(userId, "review");
      return res.status(429).json({
        code: "DAILY_LIMIT",
        message: `You've used all ${usage.limit} answer reviews for today.`,
        usage
      });
    }

    const feedback = await evaluateAnswer({
      question: question.question,
      intention: question.intention,
      suggestedAnswer: question.answer,
      answer: text,
      kind,
      roleSummary: roleSummary(report)
    });

    const attempt = await practiceAttemptModel.create({
      user: userId,
      report: id,
      kind,
      questionIndex: index,
      answer: text,
      durationSeconds: Number.isFinite(durationSeconds) ? Math.min(Math.max(Math.round(durationSeconds), 0), 3600) : undefined,
      inputMode: inputMode === "voice" ? "voice" : "typed",
      feedback
    });

    return res.status(201).json({
      message: "Answer reviewed",
      attempt,
      usage: reservation.usage
    });
  } catch (err) {
    if (reservation) {
      await refundGeneration(userId, reservation.day, "review").catch((refundErr) =>
        console.error("refundGeneration failed:", refundErr.message)
      );
    }
    console.error("submitPracticeAnswer failed:", err.message);
    return res.status(500).json({ message: "Couldn't review that answer. Please try again.", error: err.message });
  } finally {
    reviewing.delete(userId);
  }
}

/**
 * @name getPracticeSummaryController
 * @description Per-question practice stats for a report, plus the latest
 *              attempt (with feedback) for each question.
 * @access private
 */
async function getPracticeSummaryController(req, res) {
  try {
    const userId = req.user.id;
    const { id } = req.params;
    if (!mongoose.isValidObjectId(id)) return notFound(res);

    const owned = await interviewReportModel.exists({ _id: id, user: userId });
    if (!owned) return notFound(res);

    const attempts = await practiceAttemptModel
      .find({ user: userId, report: id })
      .sort({ createdAt: -1 })
      .limit(300)
      .lean();

    // key "technical-0" -> { attempts, bestScore, lastScore, latest }
    const questions = {};
    for (const attempt of attempts) {
      const key = `${attempt.kind}-${attempt.questionIndex}`;
      const entry = (questions[key] ??= { attempts: 0, bestScore: 0, lastScore: attempt.feedback.score, latest: attempt });
      entry.attempts += 1;
      entry.bestScore = Math.max(entry.bestScore, attempt.feedback.score);
    }

    const reviewUsage = await getUsage(userId, "review");
    return res.status(200).json({ questions, totalAttempts: attempts.length, reviewUsage });
  } catch (err) {
    console.error("getPracticeSummary failed:", err.message);
    return res.status(500).json({ message: "Failed to load practice history", error: err.message });
  }
}

const CRITERIA = ["structure", "specificity", "relevance", "clarity"];
const TREND_DAYS = 30;
const round1 = (n) => (typeof n === "number" ? Math.round(n * 10) / 10 : null);

/**
 * @name getPracticeProgressController
 * @description Practice progress for a report, computed in one aggregation:
 *              overall and per-kind averages, average per criterion, the
 *              weakest kind and criterion, and a daily score trend.
 * @access private
 */
async function getPracticeProgressController(req, res) {
  try {
    const userId = req.user.id;
    const { id } = req.params;
    if (!mongoose.isValidObjectId(id)) return notFound(res);

    const owned = await interviewReportModel.exists({ _id: id, user: userId });
    if (!owned) return notFound(res);

    const since = new Date(Date.now() - TREND_DAYS * 24 * 60 * 60 * 1000);
    const criteriaAverages = Object.fromEntries(CRITERIA.map((c) => [c, { $avg: `$feedback.criteria.${c}` }]));

    // matches the {user, report, ...} index prefix
    const [result] = await practiceAttemptModel.aggregate([
      { $match: { user: new mongoose.Types.ObjectId(userId), report: new mongoose.Types.ObjectId(id) } },
      {
        $facet: {
          overall: [{ $group: { _id: null, attempts: { $sum: 1 }, average: { $avg: "$feedback.score" }, ...criteriaAverages } }],
          byKind: [{ $group: { _id: "$kind", attempts: { $sum: 1 }, average: { $avg: "$feedback.score" } } }],
          trend: [
            { $match: { createdAt: { $gte: since } } },
            {
              $group: {
                _id: { $dateToString: { format: "%Y-%m-%d", date: "$createdAt" } },
                attempts: { $sum: 1 },
                average: { $avg: "$feedback.score" }
              }
            },
            { $sort: { _id: 1 } }
          ]
        }
      }
    ]);

    const overall = result.overall[0];
    if (!overall) {
      return res.status(200).json({ attempts: 0, average: null, byKind: {}, criteria: {}, weakest: null, trend: [] });
    }

    const byKind = Object.fromEntries(
      result.byKind.map((k) => [k._id, { attempts: k.attempts, average: round1(k.average) }])
    );
    const criteria = Object.fromEntries(
      CRITERIA.filter((c) => typeof overall[c] === "number").map((c) => [c, round1(overall[c])])
    );

    const lowest = (entries) => entries.reduce((low, entry) => (!low || entry[1] < low[1] ? entry : low), null)?.[0] ?? null;
    const kinds = Object.entries(byKind).map(([kind, k]) => [kind, k.average]);

    return res.status(200).json({
      attempts: overall.attempts,
      average: round1(overall.average),
      byKind,
      criteria,
      weakest: {
        // only meaningful when both kinds have been practised
        kind: kinds.length > 1 ? lowest(kinds) : null,
        criterion: lowest(Object.entries(criteria))
      },
      trend: result.trend.map((day) => ({ day: day._id, attempts: day.attempts, average: round1(day.average) }))
    });
  } catch (err) {
    console.error("getPracticeProgress failed:", err.message);
    return res.status(500).json({ message: "Failed to load practice progress", error: err.message });
  }
}

export default {
  submitPracticeAnswerController,
  getPracticeSummaryController,
  getPracticeProgressController
};
