import { beforeEach, describe, expect, it, vi } from "vitest";
import request from "supertest";
import { authCookie, createReport, createUser, fakeFeedback } from "./helpers.js";

vi.mock("../src/services/ai.service.js", () => ({ default: vi.fn(), evaluateAnswer: vi.fn() }));
const { evaluateAnswer } = await import("../src/services/ai.service.js");
const { default: app } = await import("../src/app.js");
const { default: practiceAttemptModel } = await import("../src/models/practiceAttempt.model.js");

const ANSWER = "First I'd profile it with React DevTools to see what re-renders, then fix the cause.";

const submit = (user, reportId, body) =>
  request(app)
    .post(`/api/interview/${reportId}/practice`)
    .set("Cookie", authCookie(user))
    .send({ kind: "technical", index: 0, answer: ANSWER, durationSeconds: 75, inputMode: "voice", ...body });

beforeEach(() => {
  evaluateAnswer.mockReset();
  evaluateAnswer.mockResolvedValue(fakeFeedback(7));
});

describe("POST /api/interview/:id/practice", () => {
  it("reviews the answer against the right question and saves the attempt", async () => {
    const user = await createUser();
    const report = await createReport(user);

    const res = await submit(user, report._id, { kind: "behavioral", index: 2 });

    expect(res.status).toBe(201);
    expect(res.body.attempt.feedback.score).toBe(7);
    expect(res.body.usage).toMatchObject({ used: 1, remaining: 2 });
    expect(evaluateAnswer).toHaveBeenCalledWith(
      expect.objectContaining({ question: "Behavioral question 3?", kind: "behavioral", answer: ANSWER })
    );

    const saved = await practiceAttemptModel.findOne({ user: user._id }).lean();
    expect(saved).toMatchObject({ kind: "behavioral", questionIndex: 2, durationSeconds: 75, inputMode: "voice" });
  });

  it.each([
    ["unknown kind", { kind: "trivia" }, 400],
    ["negative index", { index: -1 }, 400],
    ["question that doesn't exist", { index: 9 }, 400],
    ["answer under 20 characters", { answer: "too short" }, 400],
    ["answer over 4,000 characters", { answer: "x".repeat(4001) }, 400]
  ])("rejects %s without calling the AI", async (_label, body, status) => {
    const user = await createUser();
    const report = await createReport(user);
    const res = await submit(user, report._id, body);
    expect(res.status).toBe(status);
    expect(evaluateAnswer).not.toHaveBeenCalled();
  });

  it("returns 404 for another user's report and doesn't spend their allowance", async () => {
    const owner = await createUser();
    const stranger = await createUser();
    const report = await createReport(owner);

    const res = await submit(stranger, report._id, {});
    expect(res.status).toBe(404);
    expect(evaluateAnswer).not.toHaveBeenCalled();
    expect(await practiceAttemptModel.countDocuments()).toBe(0);
  });

  it("refunds the review when the AI fails", async () => {
    const user = await createUser();
    const report = await createReport(user);
    evaluateAnswer.mockRejectedValueOnce(new Error("model down"));

    expect((await submit(user, report._id, {})).status).toBe(500);
    const usage = await request(app).get("/api/interview/usage").set("Cookie", authCookie(user));
    expect(usage.body.reviewUsage.used).toBe(0);
  });

  it("stops at the daily review allowance", async () => {
    const user = await createUser();
    const report = await createReport(user);
    for (let i = 0; i < 3; i++) expect((await submit(user, report._id, { index: i })).status).toBe(201);

    const res = await submit(user, report._id, { index: 3 });
    expect(res.status).toBe(429);
    expect(res.body.code).toBe("DAILY_LIMIT");
  });
});

describe("GET /api/interview/:id/practice", () => {
  it("summarises attempts per question with best and last scores", async () => {
    const user = await createUser();
    const report = await createReport(user);

    evaluateAnswer.mockResolvedValueOnce(fakeFeedback(4)).mockResolvedValueOnce(fakeFeedback(8.5));
    await submit(user, report._id, { index: 0 });
    await submit(user, report._id, { index: 0 });

    const res = await request(app).get(`/api/interview/${report._id}/practice`).set("Cookie", authCookie(user));
    expect(res.status).toBe(200);
    expect(res.body.totalAttempts).toBe(2);
    expect(res.body.questions["technical-0"]).toMatchObject({ attempts: 2, bestScore: 8.5, lastScore: 8.5 });
    expect(res.body.questions["technical-0"].latest.feedback.score).toBe(8.5);
    expect(res.body.reviewUsage.used).toBe(2);
  });

  it("returns 404 for another user's report", async () => {
    const owner = await createUser();
    const stranger = await createUser();
    const report = await createReport(owner);
    const res = await request(app).get(`/api/interview/${report._id}/practice`).set("Cookie", authCookie(stranger));
    expect(res.status).toBe(404);
  });
});
