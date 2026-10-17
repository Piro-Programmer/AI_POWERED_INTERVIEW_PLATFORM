import { beforeEach, describe, expect, it, vi } from "vitest";
import request from "supertest";
import { authCookie, createUser, fakeReport } from "./helpers.js";

vi.mock("../src/services/ai.service.js", () => ({ default: vi.fn(), evaluateAnswer: vi.fn() }));
const { default: generateInterviewReport } = await import("../src/services/ai.service.js");
const { default: app } = await import("../src/app.js");
const quota = await import("../src/services/aiQuota.service.js");
const { getEntitlement } = await import("../src/services/entitlement.service.js");

const free = (user) => getEntitlement({ id: String(user._id), role: "user" });

beforeEach(() => {
  generateInterviewReport.mockReset();
  generateInterviewReport.mockResolvedValue(fakeReport());
});

describe("AI allowance (real MongoDB)", () => {
  it("never goes over the limit, even with 20 parallel reservations", async () => {
    process.env.AI_DAILY_LIMIT = "10";
    try {
      const user = await createUser();
      const ent = await free(user);
      const results = await Promise.all(Array.from({ length: 20 }, () => quota.reserveGeneration(user._id, "report", ent)));

      expect(results.filter((r) => !r.limited)).toHaveLength(10);
      expect(results.filter((r) => r.limited === "DAILY_LIMIT")).toHaveLength(10);
      expect((await quota.getUsage(user._id, "report", ent)).remaining).toBe(0);
    } finally {
      process.env.AI_DAILY_LIMIT = "3";
    }
  });

  it("refunds both buckets one call at a time and never below zero", async () => {
    const user = await createUser();
    const ent = await free(user);
    const reservation = await quota.reserveGeneration(user._id, "report", ent);

    await quota.refundGeneration(user._id, reservation, "report");
    await quota.refundGeneration(user._id, reservation, "report");

    const usage = await quota.getUsage(user._id, "report", ent);
    expect(usage.daily.used).toBe(0);
    expect(usage.monthly.used).toBe(0);
  });

  it("keeps report and review allowances separate", async () => {
    const user = await createUser();
    const ent = await free(user);
    for (let i = 0; i < 3; i++) expect((await quota.reserveGeneration(user._id, "report", ent)).limited).toBeUndefined();
    expect((await quota.reserveGeneration(user._id, "report", ent)).limited).toBe("DAILY_LIMIT");

    const review = await quota.reserveGeneration(user._id, "review", ent);
    expect(review.usage).toMatchObject({ used: 1, remaining: 2 });
  });

  it("stops at the monthly allowance and gives the day's slot back", async () => {
    process.env.AI_MONTHLY_LIMIT = "2";
    try {
      const user = await createUser();
      const ent = await free(user);
      await quota.reserveGeneration(user._id, "report", ent);
      await quota.reserveGeneration(user._id, "report", ent);

      const third = await quota.reserveGeneration(user._id, "report", ent);
      expect(third.limited).toBe("MONTHLY_LIMIT");
      expect(third.usage.daily.used).toBe(2); // not 3: the refused call was given back
      expect(third.usage).toMatchObject({ remaining: 0, limitedBy: "month", resetsAt: ent.periodEnd.toISOString() });
    } finally {
      process.env.AI_MONTHLY_LIMIT = "100";
    }
  });

  it("counts months separately: last month's usage doesn't carry over", async () => {
    process.env.AI_MONTHLY_LIMIT = "1";
    try {
      const user = await createUser();
      const septemberEnt = await getEntitlement({ id: String(user._id), role: "user" }, new Date("2026-09-30T12:00:00Z"));
      await quota.reserveGeneration(user._id, "report", septemberEnt, new Date("2026-09-30T12:00:00Z"));

      const octoberEnt = await getEntitlement({ id: String(user._id), role: "user" }, new Date("2026-10-01T12:00:00Z"));
      const october = await quota.reserveGeneration(user._id, "report", octoberEnt, new Date("2026-10-01T12:00:00Z"));
      expect(october.limited).toBeUndefined();
      expect(october.usage.monthly).toMatchObject({ used: 1, resetsAt: "2026-11-01T00:00:00.000Z" });
    } finally {
      process.env.AI_MONTHLY_LIMIT = "100";
    }
  });

  it("answers 429 DAILY_LIMIT once the reports are used up, with the reset time", async () => {
    const user = await createUser();
    const ent = await free(user);
    for (let i = 0; i < 3; i++) await quota.reserveGeneration(user._id, "report", ent);

    const res = await request(app)
      .post("/api/interview")
      .set("Cookie", authCookie(user))
      .field("jobDescription", "Backend developer");

    expect(res.status).toBe(429);
    expect(res.body.code).toBe("DAILY_LIMIT");
    expect(res.body.message).toMatch(/for today/);
    expect(res.body.usage.remaining).toBe(0);
    expect(new Date(res.body.usage.resetsAt).getUTCHours()).toBe(0);
    expect(generateInterviewReport).not.toHaveBeenCalled();
  });

  it("answers 429 MONTHLY_LIMIT naming the plan when the period's reports are used up", async () => {
    process.env.AI_MONTHLY_LIMIT = "1";
    try {
      const user = await createUser();
      await quota.reserveGeneration(user._id, "report", await free(user));

      const res = await request(app)
        .post("/api/interview")
        .set("Cookie", authCookie(user))
        .field("jobDescription", "Backend developer");

      expect(res.status).toBe(429);
      expect(res.body.code).toBe("MONTHLY_LIMIT");
      expect(res.body.message).toMatch(/Free plan/);
      expect(res.body.usage.plan).toBe("free");
      expect(generateInterviewReport).not.toHaveBeenCalled();
    } finally {
      process.env.AI_MONTHLY_LIMIT = "100";
    }
  });

  it("refunds a failed generation in both buckets", async () => {
    generateInterviewReport.mockRejectedValue(new Error("AI down"));
    const user = await createUser();

    const res = await request(app).post("/api/interview").set("Cookie", authCookie(user)).field("jobDescription", "Backend");
    expect(res.status).toBe(500);

    const usage = await quota.getUsage(user._id, "report", await free(user));
    expect(usage.daily.used).toBe(0);
    expect(usage.monthly.used).toBe(0);
  });

  it("GET /usage returns both allowances and isn't mistaken for a report id", async () => {
    const user = await createUser();
    await quota.reserveGeneration(user._id, "review", await free(user));

    const res = await request(app).get("/api/interview/usage").set("Cookie", authCookie(user));
    expect(res.status).toBe(200);
    expect(res.body.usage).toMatchObject({ limit: 3, used: 0, remaining: 3, plan: "free" });
    expect(res.body.reviewUsage).toMatchObject({ limit: 3, used: 1, remaining: 2 });
    expect(res.body.reviewUsage.monthly).toMatchObject({ limit: 100, used: 1 });
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
