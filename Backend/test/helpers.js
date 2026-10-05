import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import userModel from "../src/models/user.model.js";
import interviewReportModel from "../src/models/interviewReport.model.js";

let counter = 0;

/** A user straight in the database (skips the register rate limit). */
export async function createUser(overrides = {}) {
  counter += 1;
  const password = overrides.password || "right-password";
  const user = await userModel.create({
    username: overrides.username || `user${counter}`,
    email: overrides.email || `user${counter}@example.test`,
    password: await bcrypt.hash(password, 4)
  });
  return user;
}

/** Cookie header value that authenticates as `user`. */
export const authCookie = (user) =>
  `token=${jwt.sign({ id: String(user._id), username: user.username }, process.env.JWT_SECRET)}`;

export const fakeReport = () => ({
  matchScore: 72,
  technicalQuestions: [1, 2, 3, 4, 5].map((n) => ({
    question: `Technical question ${n}?`,
    intention: `Why they ask ${n}.`,
    answer: `How to answer ${n}.`
  })),
  behavioralQuestions: [1, 2, 3].map((n) => ({
    question: `Behavioral question ${n}?`,
    intention: "Intent.",
    answer: "STAR outline."
  })),
  skillGaps: [
    { skill: "GraphQL", severity: "high" },
    { skill: "Docker", severity: "medium" },
    { skill: "AWS", severity: "low" }
  ],
  preparationPlan: [1, 2, 3, 4, 5].map((day) => ({ day, focus: `Focus ${day}`, tasks: ["Task A", "Task B"] }))
});

/** A saved report owned by `user`. */
export const createReport = (user, overrides = {}) =>
  interviewReportModel.create({
    user: user._id,
    title: "Interview Report - Backend Developer",
    jobDescription: "Backend developer. Node.js, Express, MongoDB.",
    resume: "SECRET RESUME TEXT",
    selfDescription: "MERN developer",
    ...fakeReport(),
    ...overrides
  });

export const fakeFeedback = (score = 7) => ({
  score,
  criteria: { structure: 4, specificity: 3, relevance: 4, clarity: 4 },
  verdict: "Solid, could be more specific.",
  strengths: ["Clear structure."],
  improvements: ["Add a number."],
  strongerAnswer: "Lead with the result, then the steps."
});
