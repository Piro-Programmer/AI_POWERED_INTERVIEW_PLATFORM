import { beforeEach, describe, expect, it, vi } from "vitest";
import request from "supertest";
import mongoose from "mongoose";
import { authCookie, createReport, createUser, fakeFeedback, fakeReport } from "./helpers.js";

vi.mock("../src/services/ai.service.js", () => ({ default: vi.fn(), evaluateAnswer: vi.fn() }));
const { default: generateInterviewReport } = await import("../src/services/ai.service.js");
const { default: app } = await import("../src/app.js");
const { default: interviewReportModel } = await import("../src/models/interviewReport.model.js");
const { default: practiceAttemptModel } = await import("../src/models/practiceAttempt.model.js");

const generate = (user, fields = { jobDescription: "Backend developer, Node.js" }) => {
  const req = request(app).post("/api/interview").set("Cookie", authCookie(user));
  for (const [key, value] of Object.entries(fields)) req.field(key, value);
  return req;
};

beforeEach(() => {
  generateInterviewReport.mockReset();
  generateInterviewReport.mockResolvedValue(fakeReport());
});

describe("POST /api/interview (generate)", () => {
  it("requires a signed-in user", async () => {
    const res = await request(app).post("/api/interview").field("jobDescription", "x");
    expect(res.status).toBe(401);
  });

  it("generates, saves the report for the user, and reports the allowance", async () => {
    const user = await createUser();
    const res = await generate(user);

    expect(res.status).toBe(201);
    expect(res.body.interviewReport.title).toBe("Interview Report - Backend developer, Node.js");
    expect(res.body.interviewReport.completedTasks).toEqual([]);
    expect(res.body.usage).toMatchObject({ limit: 3, used: 1, remaining: 2 });
    expect(await interviewReportModel.countDocuments({ user: user._id })).toBe(1);
  });

  it("gives the allowance back when the AI call fails", async () => {
    const user = await createUser();
    generateInterviewReport.mockRejectedValueOnce(new Error("model down"));

    const res = await generate(user);
    expect(res.status).toBe(500);

    const usage = await request(app).get("/api/interview/usage").set("Cookie", authCookie(user));
    expect(usage.body.usage.used).toBe(0);
  });

  it("runs one generation at a time per user", async () => {
    const user = await createUser();
    generateInterviewReport.mockImplementationOnce(
      () => new Promise((resolve) => setTimeout(() => resolve(fakeReport()), 300))
    );

    // .then() sends it now; supertest is lazy until awaited
    const first = generate(user).then((res) => res);
    await new Promise((r) => setTimeout(r, 50));
    const second = await generate(user);

    expect(second.status).toBe(429);
    expect(second.body.message).toMatch(/already being generated/);
    expect((await first).status).toBe(201);
  });

  it.each([
    ["missing job description", {}, /Job description is required/],
    ["job description over 15,000 characters", { jobDescription: "x".repeat(15001) }, /max 15,000/],
    ["profile over 5,000 characters", { jobDescription: "ok", selfDescription: "x".repeat(5001) }, /max 5,000/]
  ])("rejects %s without calling the AI", async (_label, fields, message) => {
    const user = await createUser();
    const res = await generate(user, fields);
    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(message);
    expect(generateInterviewReport).not.toHaveBeenCalled();
  });

  it("only accepts PDF resumes up to 3 MB", async () => {
    const user = await createUser();
    const notPdf = await generate(user).attach("resume", Buffer.from("hello"), { filename: "cv.txt", contentType: "text/plain" });
    expect(notPdf.status).toBe(400);
    expect(notPdf.body.message).toBe("Resume must be a PDF file.");

    const other = await createUser();
    const tooBig = await generate(other).attach("resume", Buffer.alloc(3 * 1024 * 1024 + 1), {
      filename: "cv.pdf",
      contentType: "application/pdf"
    });
    expect(tooBig.status).toBe(413);
    expect(tooBig.body.message).toBe("Resume PDF must be 3 MB or smaller.");
  });
});

describe("reading reports", () => {
  it("lists only the user's reports, as summaries without resume text or answers", async () => {
    const owner = await createUser();
    const stranger = await createUser();
    await createReport(owner, { completedTasks: ["0-0", "1-1"] });
    await createReport(stranger);

    const res = await request(app).get("/api/interview").set("Cookie", authCookie(owner));
    expect(res.status).toBe(200);
    expect(res.body.reports).toHaveLength(1);

    const [summary] = res.body.reports;
    expect(summary).toMatchObject({ technicalCount: 5, behavioralCount: 3, planTaskCount: 10, completedCount: 2 });
    expect(JSON.stringify(res.body)).not.toContain("SECRET RESUME TEXT");
    expect(summary.technicalQuestions).toBeUndefined();
  });

  it("returns one report in full to its owner, and 404 to anyone else", async () => {
    const owner = await createUser();
    const stranger = await createUser();
    const report = await createReport(owner);

    const own = await request(app).get(`/api/interview/${report._id}`).set("Cookie", authCookie(owner));
    expect(own.status).toBe(200);
    expect(own.body.interviewReport.technicalQuestions).toHaveLength(5);
    expect(own.body.interviewReport.resume).toBeUndefined();

    const theirs = await request(app).get(`/api/interview/${report._id}`).set("Cookie", authCookie(stranger));
    expect(theirs.status).toBe(404);

    const invalid = await request(app).get("/api/interview/not-an-id").set("Cookie", authCookie(owner));
    expect(invalid.status).toBe(404);
  });
});

describe("resume privacy", () => {
  it("doesn't store resume text with a generated report", async () => {
    const user = await createUser();
    const res = await generate(user);
    expect(res.status).toBe(201);

    const raw = await interviewReportModel.collection.findOne({ _id: new mongoose.Types.ObjectId(res.body.interviewReport._id) });
    expect(raw).not.toHaveProperty("resume");
  });
});

describe("DELETE /api/interview/:id", () => {
  it("deletes the owner's report and its practice attempts, 404 for anyone else", async () => {
    const owner = await createUser();
    const stranger = await createUser();
    const report = await createReport(owner);
    await practiceAttemptModel.create({
      user: owner._id, report: report._id, kind: "technical", questionIndex: 0, answer: "x", feedback: fakeFeedback()
    });

    const theirs = await request(app).delete(`/api/interview/${report._id}`).set("Cookie", authCookie(stranger));
    expect(theirs.status).toBe(404);
    expect(await interviewReportModel.countDocuments()).toBe(1);

    const own = await request(app).delete(`/api/interview/${report._id}`).set("Cookie", authCookie(owner));
    expect(own.status).toBe(200);
    expect(await interviewReportModel.countDocuments()).toBe(0);
    expect(await practiceAttemptModel.countDocuments()).toBe(0);

    const again = await request(app).delete(`/api/interview/${report._id}`).set("Cookie", authCookie(owner));
    expect(again.status).toBe(404);
    const invalid = await request(app).delete("/api/interview/not-an-id").set("Cookie", authCookie(owner));
    expect(invalid.status).toBe(404);
  });

  it("requires a signed-in user", async () => {
    const report = await createReport(await createUser());
    expect((await request(app).delete(`/api/interview/${report._id}`)).status).toBe(401);
  });
});

describe("PATCH /api/interview/:id/progress", () => {
  it("saves ticks, dropping duplicates and tasks that don't exist", async () => {
    const user = await createUser();
    const report = await createReport(user);

    const res = await request(app)
      .patch(`/api/interview/${report._id}/progress`)
      .set("Cookie", authCookie(user))
      .send({ completedTasks: ["0-0", "0-0", "4-1", "0-9", "9-0"] });

    expect(res.status).toBe(200);
    expect(res.body.completedTasks).toEqual(["0-0", "4-1"]);
    const saved = await interviewReportModel.findById(report._id).lean();
    expect(saved.completedTasks).toEqual(["0-0", "4-1"]);
  });

  it.each([
    ["not an array", { completedTasks: "0-0" }],
    ["malformed id", { completedTasks: ["zero"] }],
    ["operator object", { completedTasks: [{ $gt: "" }] }]
  ])("rejects %s", async (_label, body) => {
    const user = await createUser();
    const report = await createReport(user);
    const res = await request(app).patch(`/api/interview/${report._id}/progress`).set("Cookie", authCookie(user)).send(body);
    expect(res.status).toBe(400);
  });

  it("can't touch another user's report", async () => {
    const owner = await createUser();
    const stranger = await createUser();
    const report = await createReport(owner);

    const res = await request(app)
      .patch(`/api/interview/${report._id}/progress`)
      .set("Cookie", authCookie(stranger))
      .send({ completedTasks: ["0-0"] });

    expect(res.status).toBe(404);
    expect((await interviewReportModel.findById(report._id).lean()).completedTasks).toEqual([]);
  });
});
