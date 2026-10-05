import { beforeEach, describe, expect, it, vi } from "vitest";
import request from "supertest";
import { authCookie, createUser, fakeReport } from "./helpers.js";

vi.mock("../src/services/ai.service.js", () => ({ default: vi.fn(), evaluateAnswer: vi.fn() }));
const { default: generateInterviewReport } = await import("../src/services/ai.service.js");
const { default: app } = await import("../src/app.js");
const quota = await import("../src/services/aiQuota.service.js");

beforeEach(() => {
  generateInterviewReport.mockReset();
  generateInterviewReport.mockResolvedValue(fakeReport());
});

describe("daily AI allowance (real MongoDB)", () => {
  it("never goes over the limit, even with 20 parallel reservations", async () => {
    process.env.AI_DAILY_LIMIT = "10";
    try {
      const user = await createUser();
      const results = await Promise.all(Array.from({ length: 20 }, () => quota.reserveGeneration(user._id, "report")));

      expect(results.filter(Boolean)).toHaveLength(10);
      expect(results.filter((r) => r === null)).toHaveLength(10);
      expect((await quota.getUsage(user._id, "report")).remaining).toBe(0);
    } finally {
      process.env.AI_DAILY_LIMIT = "3";
    }
  });

  it("refunds one call at a time and never below zero", async () => {
    const user = await createUser();
    const { day } = await quota.reserveGeneration(user._id, "report");

    await quota.refundGeneration(user._id, day, "report");
    await quota.refundGeneration(user._id, day, "report");

    expect((await quota.getUsage(user._id, "report")).used).toBe(0);
  });

  it("keeps report and review allowances separate", async () => {
    const user = await createUser();
    for (let i = 0; i < 3; i++) expect(await quota.reserveGeneration(user._id, "report")).not.toBeNull();
    expect(await quota.reserveGeneration(user._id, "report")).toBeNull();

    const review = await quota.reserveGeneration(user._id, "review");
    expect(review.usage).toMatchObject({ used: 1, remaining: 2 });
  });

  it("answers 429 DAILY_LIMIT once the reports are used up, with the reset time", async () => {
    const user = await createUser();
    for (let i = 0; i < 3; i++) await quota.reserveGeneration(user._id, "report");

    const res = await request(app)
      .post("/api/interview")
      .set("Cookie", authCookie(user))
      .field("jobDescription", "Backend developer");

    expect(res.status).toBe(429);
    expect(res.body.code).toBe("DAILY_LIMIT");
    expect(res.body.usage.remaining).toBe(0);
    expect(new Date(res.body.usage.resetsAt).getUTCHours()).toBe(0);
    expect(generateInterviewReport).not.toHaveBeenCalled();
  });

  it("GET /usage returns both allowances and isn't mistaken for a report id", async () => {
    const user = await createUser();
    await quota.reserveGeneration(user._id, "review");

    const res = await request(app).get("/api/interview/usage").set("Cookie", authCookie(user));
    expect(res.status).toBe(200);
    expect(res.body.usage).toMatchObject({ limit: 3, used: 0, remaining: 3 });
    expect(res.body.reviewUsage).toMatchObject({ limit: 3, used: 1, remaining: 2 });
  });

  it("limits bursts to 3 generations per minute per user", async () => {
    process.env.AI_DAILY_LIMIT = "10";
    try {
      const user = await createUser();
      const statuses = [];
      for (let i = 0; i < 4; i++) {
        const res = await request(app).post("/api/interview").set("Cookie", authCookie(user)).field("jobDescription", "Backend");
        statuses.push(res.status);
        if (i === 3) expect(res.body.message).toMatch(/generating reports too quickly/);
      }
      expect(statuses).toEqual([201, 201, 201, 429]);
    } finally {
      process.env.AI_DAILY_LIMIT = "3";
    }
  });
});
