import { describe, expect, it, vi } from "vitest";
import request from "supertest";
import { authCookie, createUser, fakeReport } from "./helpers.js";

vi.mock("../src/services/ai.service.js", () => ({ default: vi.fn(async () => fakeReport()), evaluateAnswer: vi.fn() }));
const { default: app } = await import("../src/app.js");
const { default: subscriptionModel } = await import("../src/models/subscription.model.js");
const { default: userModel } = await import("../src/models/user.model.js");
const { getEntitlement, subscriptionGrantsAccess, GRACE_DAYS } = await import("../src/services/entitlement.service.js");
const quota = await import("../src/services/aiQuota.service.js");

const DAY_MS = 24 * 60 * 60 * 1000;
const NOW = new Date("2026-10-17T12:00:00Z");
const periodStart = new Date("2026-10-05T00:00:00Z");
const periodEnd = new Date("2026-11-05T00:00:00Z");

const subscribe = (user, fields = {}) =>
  subscriptionModel.create({
    user: user._id,
    plan: "pro",
    status: "active",
    razorpaySubscriptionId: `sub_${user._id}`,
    currentPeriodStart: periodStart,
    currentPeriodEnd: periodEnd,
    ...fields
  });

describe("which subscription states give access", () => {
  const sub = (status, extra = {}) => ({ status, currentPeriodEnd: periodEnd, ...extra });
  const after = (days) => new Date(periodEnd.getTime() + days * DAY_MS);

  it.each([
    ["active", {}, NOW, true],
    ["authenticated", {}, NOW, true],
    ["created", {}, NOW, false], // checkout never finished
    ["pending", {}, after(GRACE_DAYS - 1), true], // renewal failing, still in grace
    ["pending", {}, after(GRACE_DAYS + 1), false],
    ["halted", {}, after(1), true],
    ["cancelled", { cancelAtPeriodEnd: true }, NOW, true], // paid up until the period ends
    ["cancelled", { cancelAtPeriodEnd: true }, after(1), false],
    ["cancelled", { cancelAtPeriodEnd: false }, NOW, false], // cancelled immediately
    ["completed", {}, NOW, false],
    ["expired", {}, NOW, false]
  ])("%s %o at %s → %s", (status, extra, now, expected) => {
    expect(subscriptionGrantsAccess(sub(status, extra), now)).toBe(expected);
  });

  it("no subscription gives no access", () => {
    expect(subscriptionGrantsAccess(null)).toBe(false);
  });
});

describe("getEntitlement", () => {
  it("puts users without a subscription on Free, counting by calendar month", async () => {
    const user = await createUser();
    const ent = await getEntitlement({ id: String(user._id), role: "user" }, NOW);

    expect(ent).toMatchObject({ source: "free", status: null, periodKey: "M:2026-10" });
    expect(ent.plan.id).toBe("free");
    expect(ent.periodEnd.toISOString()).toBe("2026-11-01T00:00:00.000Z");
  });

  it("gives an active subscriber their plan and their own billing period", async () => {
    const user = await createUser();
    await subscribe(user);
    const ent = await getEntitlement({ id: String(user._id), role: "user" }, NOW);

    expect(ent).toMatchObject({ source: "subscription", status: "active", periodKey: `P:${periodStart.toISOString()}` });
    expect(ent.plan.id).toBe("pro");
    expect(ent.periodEnd).toEqual(periodEnd);
  });

  it("drops a lapsed subscriber back to Free but reports the status", async () => {
    const user = await createUser();
    await subscribe(user, { status: "halted", currentPeriodEnd: new Date(NOW.getTime() - 10 * DAY_MS) });
    const ent = await getEntitlement({ id: String(user._id), role: "user" }, NOW);

    expect(ent.plan.id).toBe("free");
    expect(ent.status).toBe("halted");
  });

  it("gives admins the top plan", async () => {
    const user = await createUser();
    const ent = await getEntitlement({ id: String(user._id), role: "admin" }, NOW);
    expect(ent).toMatchObject({ source: "admin" });
    expect(ent.plan.id).toBe("premium");
  });

  it("a Pro subscriber gets Pro limits, not the Free ones", async () => {
    const user = await createUser();
    await subscribe(user);
    const ent = await getEntitlement({ id: String(user._id), role: "user" });

    for (let i = 0; i < 4; i++) {
      expect((await quota.reserveGeneration(user._id, "report", ent)).limited).toBeUndefined();
    }
    const usage = await quota.getUsage(user._id, "report", ent);
    expect(usage.daily).toMatchObject({ limit: 10, used: 4 });
    expect(usage.monthly).toMatchObject({ limit: 60, used: 4 });
  });
});

describe("GET /api/billing/plans", () => {
  it("lists Free, Pro and Premium with prices in paise and no secrets", async () => {
    const res = await request(app).get("/api/billing/plans");

    expect(res.status).toBe(200);
    expect(res.body.plans.map((p) => p.id)).toEqual(["free", "pro", "premium"]);
    expect(res.body.plans[1]).toMatchObject({
      name: "Pro",
      priceInPaise: 29900,
      currency: "INR",
      interval: "monthly",
      limits: { report: { daily: 10, monthly: 60 } },
      purchasable: false // Razorpay isn't configured in tests
    });
    expect(JSON.stringify(res.body)).not.toMatch(/RAZORPAY/);
  });

  it("needs no sign-in", async () => {
    expect((await request(app).get("/api/billing/plans")).status).toBe(200);
  });
});

describe("GET /api/billing/me", () => {
  it("needs a sign-in", async () => {
    expect((await request(app).get("/api/billing/me")).status).toBe(401);
  });

  it("shows a new user on Free with this month's usage", async () => {
    const user = await createUser();
    await request(app).post("/api/interview").set("Cookie", authCookie(user)).field("jobDescription", "Backend");

    const res = await request(app).get("/api/billing/me").set("Cookie", authCookie(user));
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ plan: { id: "free", name: "Free" }, source: "free", status: null, cancelAtPeriodEnd: false });
    expect(res.body.usage.report.monthly).toMatchObject({ used: 1 });
    expect(res.body.usage.review.monthly).toMatchObject({ used: 0 });
  });

  it("shows a subscriber's plan, status and billing period", async () => {
    const user = await createUser();
    await subscribe(user, { plan: "premium", status: "cancelled", cancelAtPeriodEnd: true, currentPeriodEnd: new Date(Date.now() + 5 * DAY_MS) });

    const res = await request(app).get("/api/billing/me").set("Cookie", authCookie(user));
    expect(res.body).toMatchObject({ plan: { id: "premium" }, source: "subscription", status: "cancelled", cancelAtPeriodEnd: true });
    expect(res.body.usage.report.monthly.limit).toBe(200);
  });
});

describe("account deletion", () => {
  it("removes the user's subscription record too", async () => {
    const user = await createUser({ password: "right-password" });
    await subscribe(user);

    const res = await request(app)
      .delete("/api/auth/account")
      .set("Cookie", authCookie(user))
      .send({ password: "right-password" });

    expect(res.status).toBe(200);
    expect(await userModel.exists({ _id: user._id })).toBeNull();
    expect(await subscriptionModel.countDocuments({ user: user._id })).toBe(0);
  });
});
