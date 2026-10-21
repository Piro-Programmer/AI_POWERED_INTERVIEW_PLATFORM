import crypto from "node:crypto";
import { beforeEach, describe, expect, it, vi } from "vitest";
import request from "supertest";
import { authCookie, createUser, fakeReport } from "./helpers.js";

const rz = vi.hoisted(() => ({
  subscriptions: {
    create: vi.fn(),
    cancel: vi.fn(),
    cancelScheduledChanges: vi.fn(),
    update: vi.fn(),
    fetch: vi.fn()
  }
}));
vi.mock("razorpay", () => ({ default: vi.fn(function Razorpay() { return rz; }) }));
vi.mock("../src/services/ai.service.js", () => ({ default: vi.fn(async () => fakeReport()), evaluateAnswer: vi.fn() }));

const { default: app } = await import("../src/app.js");
const { default: subscriptionModel } = await import("../src/models/subscription.model.js");
const { default: paymentModel } = await import("../src/models/payment.model.js");
const { getEntitlement } = await import("../src/services/entitlement.service.js");
const { verifyCheckoutSignature, verifyWebhookSignature } = await import("../src/services/razorpay.service.js");

const KEY_SECRET = "test-key-secret";
const WEBHOOK_SECRET = "test-webhook-secret";
const DAY_S = 24 * 60 * 60;
const nowS = () => Math.floor(Date.now() / 1000);

beforeEach(() => {
  vi.clearAllMocks();
  Object.assign(process.env, {
    RAZORPAY_KEY_ID: "rzp_test_key",
    RAZORPAY_KEY_SECRET: KEY_SECRET,
    RAZORPAY_WEBHOOK_SECRET: WEBHOOK_SECRET,
    RAZORPAY_PLAN_PRO: "plan_pro",
    RAZORPAY_PLAN_PREMIUM: "plan_premium"
  });
  rz.subscriptions.create.mockImplementation(async () => ({ id: `sub_${crypto.randomUUID()}`, status: "created" }));
  rz.subscriptions.cancel.mockResolvedValue({});
  rz.subscriptions.cancelScheduledChanges.mockResolvedValue({});
  rz.subscriptions.update.mockResolvedValue({});
});

const sign = (secret, data) => crypto.createHmac("sha256", secret).update(data).digest("hex");

let eventCounter = 0;
/** POST a signed webhook. Same `eventId` = a redelivery. */
const webhook = (body, { eventId = `evt_${++eventCounter}`, signature } = {}) => {
  const raw = JSON.stringify(body);
  return request(app)
    .post("/api/billing/webhook")
    .set("Content-Type", "application/json")
    .set("x-razorpay-event-id", eventId)
    .set("x-razorpay-signature", signature ?? sign(WEBHOOK_SECRET, raw))
    .send(raw);
};

const subEntity = (id, fields = {}) => ({
  id,
  plan_id: "plan_pro",
  status: "active",
  current_start: nowS() - DAY_S,
  current_end: nowS() + 29 * DAY_S,
  ...fields
});

const event = (name, entity, { createdAt = nowS(), payment } = {}) => ({
  event: name,
  created_at: createdAt,
  payload: { subscription: { entity }, ...(payment && { payment: { entity: payment } }) }
});

/** A user who opened checkout for `plan`, with their subscription id. */
async function checkoutUser(plan = "pro") {
  const user = await createUser();
  const res = await request(app).post("/api/billing/subscribe").set("Cookie", authCookie(user)).send({ planId: plan });
  expect(res.status).toBe(201);
  return { user, subId: res.body.subscriptionId };
}

describe("signatures", () => {
  it("accepts a checkout signature over payment_id|subscription_id and rejects a wrong one", () => {
    const good = sign(KEY_SECRET, "pay_1|sub_1");
    expect(verifyCheckoutSignature({ paymentId: "pay_1", subscriptionId: "sub_1", signature: good })).toBe(true);
    expect(verifyCheckoutSignature({ paymentId: "pay_2", subscriptionId: "sub_1", signature: good })).toBe(false);
    expect(verifyCheckoutSignature({ paymentId: "pay_1", subscriptionId: "sub_1", signature: "short" })).toBe(false);
    expect(verifyCheckoutSignature({ paymentId: "pay_1", subscriptionId: "sub_1" })).toBe(false);
  });

  it("checks a webhook signature against the raw bytes", () => {
    const raw = Buffer.from('{"event":"x"}');
    expect(verifyWebhookSignature(raw, sign(WEBHOOK_SECRET, raw))).toBe(true);
    // same JSON, different bytes: not what was signed
    expect(verifyWebhookSignature(Buffer.from('{ "event": "x" }'), sign(WEBHOOK_SECRET, raw))).toBe(false);
  });
});

describe("POST /api/billing/subscribe", () => {
  it("needs a sign-in", async () => {
    expect((await request(app).post("/api/billing/subscribe").send({ planId: "pro" })).status).toBe(401);
  });

  it("creates a Razorpay subscription and returns what checkout needs", async () => {
    const { user, subId } = await checkoutUser("pro");

    expect(rz.subscriptions.create).toHaveBeenCalledWith(
      expect.objectContaining({ plan_id: "plan_pro", total_count: 120, notes: expect.objectContaining({ userId: String(user._id) }) })
    );
    const sub = await subscriptionModel.findOne({ user: user._id }).lean();
    expect(sub).toMatchObject({ plan: "pro", status: "created", razorpaySubscriptionId: subId });
  });

  it("rejects the Free plan and unknown plans", async () => {
    const user = await createUser();
    for (const planId of ["free", "gold", undefined]) {
      const res = await request(app).post("/api/billing/subscribe").set("Cookie", authCookie(user)).send({ planId });
      expect(res.status).toBe(400);
    }
    expect(rz.subscriptions.create).not.toHaveBeenCalled();
  });

  it("reuses an unpaid subscription for the same plan", async () => {
    const { user, subId } = await checkoutUser("pro");
    const again = await request(app).post("/api/billing/subscribe").set("Cookie", authCookie(user)).send({ planId: "pro" });

    expect(again.status).toBe(200);
    expect(again.body).toEqual({ subscriptionId: subId, keyId: "rzp_test_key" });
    expect(rz.subscriptions.create).toHaveBeenCalledTimes(1);
  });

  it("refuses a second subscription while one is active", async () => {
    const { user, subId } = await checkoutUser("pro");
    await webhook(event("subscription.activated", subEntity(subId)));

    const res = await request(app).post("/api/billing/subscribe").set("Cookie", authCookie(user)).send({ planId: "premium" });
    expect(res.status).toBe(409);
  });
});

describe("POST /api/billing/verify", () => {
  it("marks the subscription authenticated with a valid signature", async () => {
    const { user, subId } = await checkoutUser();
    const res = await request(app)
      .post("/api/billing/verify")
      .set("Cookie", authCookie(user))
      .send({ razorpay_payment_id: "pay_1", razorpay_subscription_id: subId, razorpay_signature: sign(KEY_SECRET, `pay_1|${subId}`) });

    expect(res.status).toBe(200);
    expect((await subscriptionModel.findOne({ user: user._id })).status).toBe("authenticated");
    expect((await getEntitlement({ id: String(user._id), role: "user" })).plan.id).toBe("pro");
  });

  it("rejects a forged signature", async () => {
    const { user, subId } = await checkoutUser();
    const res = await request(app)
      .post("/api/billing/verify")
      .set("Cookie", authCookie(user))
      .send({ razorpay_payment_id: "pay_1", razorpay_subscription_id: subId, razorpay_signature: sign("wrong", `pay_1|${subId}`) });

    expect(res.status).toBe(400);
    expect((await subscriptionModel.findOne({ user: user._id })).status).toBe("created");
  });

  it("can't verify someone else's subscription", async () => {
    const { subId } = await checkoutUser();
    const other = await createUser();
    const res = await request(app)
      .post("/api/billing/verify")
      .set("Cookie", authCookie(other))
      .send({ razorpay_payment_id: "pay_1", razorpay_subscription_id: subId, razorpay_signature: sign(KEY_SECRET, `pay_1|${subId}`) });
    expect(res.status).toBe(404);
  });
});

describe("POST /api/billing/webhook", () => {
  it("rejects a bad signature", async () => {
    const { subId } = await checkoutUser();
    const res = await webhook(event("subscription.activated", subEntity(subId)), { signature: sign("wrong", "x") });

    expect(res.status).toBe(400);
    expect((await subscriptionModel.findOne({ razorpaySubscriptionId: subId })).status).toBe("created");
  });

  it("subscription.charged records the payment and switches the user to the paid plan", async () => {
    const { user, subId } = await checkoutUser("premium");
    const entity = subEntity(subId, { plan_id: "plan_premium" });
    const res = await webhook(
      event("subscription.charged", entity, {
        payment: { id: "pay_123", amount: 69900, currency: "INR", status: "captured", method: "upi", invoice_id: "inv_1", created_at: nowS() }
      })
    );

    expect(res.status).toBe(200);
    const payment = await paymentModel.findOne({ razorpayPaymentId: "pay_123" }).lean();
    expect(payment).toMatchObject({ amountInPaise: 69900, status: "captured", method: "upi", invoiceId: "inv_1", plan: "premium", razorpaySubscriptionId: subId });
    expect(String(payment.user)).toBe(String(user._id));

    const sub = await subscriptionModel.findOne({ user: user._id }).lean();
    expect(sub.status).toBe("active");
    expect(sub.currentPeriodStart.getTime()).toBe(entity.current_start * 1000);
    expect(sub.currentPeriodEnd.getTime()).toBe(entity.current_end * 1000);

    const ent = await getEntitlement({ id: String(user._id), role: "user" });
    expect(ent).toMatchObject({ source: "subscription", periodKey: `P:${sub.currentPeriodStart.toISOString()}` });
    expect(ent.plan.id).toBe("premium");

    const invoices = await request(app).get("/api/billing/invoices").set("Cookie", authCookie(user));
    expect(invoices.body.invoices).toHaveLength(1);
    expect(invoices.body.invoices[0]).toMatchObject({ razorpayPaymentId: "pay_123", amountInPaise: 69900 });
  });

  it("skips a redelivered event", async () => {
    const { subId } = await checkoutUser();
    const body = event("subscription.charged", subEntity(subId), {
      payment: { id: "pay_dup", amount: 29900, status: "captured", created_at: nowS() }
    });

    expect((await webhook(body, { eventId: "evt_same" })).body.status).toBe("ok");
    // the user changes something in between; the replay must not undo it
    await subscriptionModel.updateOne({ razorpaySubscriptionId: subId }, { status: "halted" });
    const again = await webhook(body, { eventId: "evt_same" });

    expect(again.status).toBe(200);
    expect(again.body.status).toBe("duplicate");
    expect((await subscriptionModel.findOne({ razorpaySubscriptionId: subId })).status).toBe("halted");
    expect(await paymentModel.countDocuments({ razorpayPaymentId: "pay_dup" })).toBe(1);
  });

  it("ignores an event older than one already applied", async () => {
    const { user, subId } = await checkoutUser();
    const t = nowS();
    await webhook(event("subscription.halted", subEntity(subId, { status: "halted" }), { createdAt: t }));
    // delivered late, but happened before the halt
    const late = await webhook(event("subscription.activated", subEntity(subId), { createdAt: t - 60 }));

    expect(late.status).toBe(200);
    const sub = await subscriptionModel.findOne({ user: user._id }).lean();
    expect(sub.status).toBe("halted");
    expect(sub.lastEventAt.getTime()).toBe(t * 1000);
  });

  it("answers 200 to events it doesn't handle or can't match", async () => {
    expect((await webhook({ event: "order.paid", created_at: nowS(), payload: {} })).status).toBe(200);
    expect((await webhook(event("subscription.activated", subEntity("sub_unknown")))).status).toBe(200);
  });

  it("records a failed payment for a known subscription", async () => {
    const { subId } = await checkoutUser();
    await webhook({
      event: "payment.failed",
      created_at: nowS(),
      payload: { payment: { entity: { id: "pay_fail", amount: 29900, status: "failed", subscription_id: subId } } }
    });
    expect(await paymentModel.findOne({ razorpayPaymentId: "pay_fail" }).lean()).toMatchObject({ status: "failed" });
  });

  it("isn't behind the API rate limiter and needs no cookie", async () => {
    const res = await webhook({ event: "order.paid", created_at: nowS(), payload: {} });
    expect(res.headers["ratelimit-policy"]).toBeUndefined();
    expect(res.status).toBe(200);
  });
});

describe("cancel, resume and change plan", () => {
  async function activeUser(plan = "pro") {
    const { user, subId } = await checkoutUser(plan);
    await webhook(event("subscription.activated", subEntity(subId, { plan_id: `plan_${plan}` })));
    return { user, subId };
  }

  it("cancel keeps the plan until the period ends", async () => {
    const { user, subId } = await activeUser();
    const res = await request(app).post("/api/billing/cancel").set("Cookie", authCookie(user));

    expect(res.status).toBe(200);
    expect(rz.subscriptions.cancel).toHaveBeenCalledWith(subId, true);
    const sub = await subscriptionModel.findOne({ user: user._id }).lean();
    expect(sub.cancelAtPeriodEnd).toBe(true);

    // Razorpay sends subscription.cancelled when the period runs out
    await webhook(event("subscription.cancelled", subEntity(subId, { status: "cancelled" })));
    const user_ = { id: String(user._id), role: "user" };
    expect((await getEntitlement(user_)).plan.id).toBe("pro");
    expect((await getEntitlement(user_, new Date(sub.currentPeriodEnd.getTime() + 1000))).plan.id).toBe("free");
  });

  it("resume undoes a pending cancellation", async () => {
    const { user, subId } = await activeUser();
    await request(app).post("/api/billing/cancel").set("Cookie", authCookie(user));
    const res = await request(app).post("/api/billing/resume").set("Cookie", authCookie(user));

    expect(res.status).toBe(200);
    expect(rz.subscriptions.cancelScheduledChanges).toHaveBeenCalledWith(subId);
    expect((await subscriptionModel.findOne({ user: user._id })).cancelAtPeriodEnd).toBe(false);
  });

  it("an upgrade applies now, a downgrade at the end of the cycle", async () => {
    const { user, subId } = await activeUser("pro");
    const up = await request(app).post("/api/billing/change-plan").set("Cookie", authCookie(user)).send({ planId: "premium" });
    expect(up.body).toMatchObject({ plan: "premium", effective: "now" });
    expect(rz.subscriptions.update).toHaveBeenLastCalledWith(subId, expect.objectContaining({ plan_id: "plan_premium", schedule_change_at: "now" }));

    const down = await request(app).post("/api/billing/change-plan").set("Cookie", authCookie(user)).send({ planId: "pro" });
    expect(down.body).toMatchObject({ plan: "premium", scheduledPlan: "pro", effective: "cycle_end" });
    expect(rz.subscriptions.update).toHaveBeenLastCalledWith(subId, expect.objectContaining({ plan_id: "plan_pro", schedule_change_at: "cycle_end" }));
  });
});

describe("GET /api/billing/me reconciles a stale subscription", () => {
  it("fetches from Razorpay when no event has arrived for a while", async () => {
    const { user, subId } = await checkoutUser();
    await subscriptionModel.updateOne({ user: user._id }, { lastEventAt: new Date(Date.now() - 7 * DAY_S * 1000) });
    rz.subscriptions.fetch.mockResolvedValue(subEntity(subId));

    const res = await request(app).get("/api/billing/me").set("Cookie", authCookie(user));
    expect(rz.subscriptions.fetch).toHaveBeenCalledWith(subId);
    expect(res.body).toMatchObject({ plan: { id: "pro" }, status: "active" });

    // fresh now: the next request doesn't fetch again
    await request(app).get("/api/billing/me").set("Cookie", authCookie(user));
    expect(rz.subscriptions.fetch).toHaveBeenCalledTimes(1);
  });
});

describe("without Razorpay keys", () => {
  it("every billing action answers 503 BILLING_DISABLED", async () => {
    delete process.env.RAZORPAY_KEY_ID;
    delete process.env.RAZORPAY_KEY_SECRET;
    delete process.env.RAZORPAY_WEBHOOK_SECRET;
    const user = await createUser();
    const cookie = authCookie(user);

    const calls = [
      request(app).post("/api/billing/subscribe").set("Cookie", cookie).send({ planId: "pro" }),
      request(app).post("/api/billing/verify").set("Cookie", cookie).send({}),
      request(app).post("/api/billing/cancel").set("Cookie", cookie),
      request(app).post("/api/billing/resume").set("Cookie", cookie),
      request(app).post("/api/billing/change-plan").set("Cookie", cookie).send({ planId: "premium" }),
      request(app).get("/api/billing/invoices").set("Cookie", cookie),
      request(app).post("/api/billing/webhook").set("Content-Type", "application/json").send("{}")
    ];
    for (const res of await Promise.all(calls)) {
      expect(res.status).toBe(503);
      expect(res.body.code).toBe("BILLING_DISABLED");
    }
    expect(rz.subscriptions.create).not.toHaveBeenCalled();
    // the rest of billing still works
    expect((await request(app).get("/api/billing/me").set("Cookie", cookie)).status).toBe(200);
  });
});

describe("account deletion", () => {
  it("cancels a live subscription at once so the card isn't charged again", async () => {
    const { user, subId } = await checkoutUser();
    const res = await request(app).delete("/api/auth/account").set("Cookie", authCookie(user)).send({ password: "right-password" });

    expect(res.status).toBe(200);
    expect(rz.subscriptions.cancel).toHaveBeenCalledWith(subId, false);
  });
});
