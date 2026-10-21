import crypto from "node:crypto";
import Razorpay from "razorpay";
import { getPlan, PAID_PLAN_IDS } from "../config/plans.js";

// Everything that talks to Razorpay, plus the signature checks. The client is
// built on first use, so the keys are read when billing is used, not at import.

// ~10 years of monthly charges: Razorpay needs an end, the user cancels sooner
const TOTAL_COUNT = 120;

let client = null;
let clientKey = null;

/** True when the Razorpay keys are configured. */
export const billingEnabled = () => Boolean(process.env.RAZORPAY_KEY_ID && process.env.RAZORPAY_KEY_SECRET);

function razorpay() {
  if (!billingEnabled()) throw new Error("Razorpay keys are not configured");
  const key = `${process.env.RAZORPAY_KEY_ID}:${process.env.RAZORPAY_KEY_SECRET}`;
  if (!client || clientKey !== key) {
    client = new Razorpay({ key_id: process.env.RAZORPAY_KEY_ID, key_secret: process.env.RAZORPAY_KEY_SECRET });
    clientKey = key;
  }
  return client;
}

/** The Razorpay plan id (plan_xxx) for one of our paid plans, or null. */
export const razorpayPlanId = (planId) => {
  const env = getPlan(planId).razorpayPlanEnv;
  return (env && process.env[env]) || null;
};

/** Our plan id ("pro"/"premium") for a Razorpay plan id, or null. */
export const planIdFromRazorpay = (razorpayId) =>
  PAID_PLAN_IDS.find((id) => razorpayId && razorpayPlanId(id) === razorpayId) || null;

const safeEqualHex = (expected, given) => {
  if (typeof given !== "string") return false;
  const a = Buffer.from(expected, "utf8");
  const b = Buffer.from(given, "utf8");
  return a.length === b.length && crypto.timingSafeEqual(a, b);
};

const hmac = (secret, data) => crypto.createHmac("sha256", secret).update(data).digest("hex");

/** Checkout's handler response: signature of "payment_id|subscription_id". */
export function verifyCheckoutSignature({ paymentId, subscriptionId, signature }) {
  if (!paymentId || !subscriptionId || !process.env.RAZORPAY_KEY_SECRET) return false;
  return safeEqualHex(hmac(process.env.RAZORPAY_KEY_SECRET, `${paymentId}|${subscriptionId}`), signature);
}

/** A webhook's X-Razorpay-Signature, computed over the raw body bytes. */
export function verifyWebhookSignature(rawBody, signature) {
  const secret = process.env.RAZORPAY_WEBHOOK_SECRET;
  if (!secret || !Buffer.isBuffer(rawBody)) return false;
  return safeEqualHex(hmac(secret, rawBody), signature);
}

/** A new monthly subscription for `userId` on one of our paid plans. */
export function createSubscription({ planId, userId }) {
  return razorpay().subscriptions.create({
    plan_id: razorpayPlanId(planId),
    total_count: TOTAL_COUNT,
    customer_notify: 1,
    notes: { userId: String(userId), plan: planId }
  });
}

/** Cancel now, or (atCycleEnd) when the paid period ends. */
export const cancelSubscription = (id, atCycleEnd = true) => razorpay().subscriptions.cancel(id, atCycleEnd);

/** Undo a cancellation that was scheduled for the end of the cycle. */
export const cancelScheduledChanges = (id) => razorpay().subscriptions.cancelScheduledChanges(id);

/** Move to another plan, now (upgrade) or at the end of the cycle (downgrade). */
export const changePlan = (id, planId, when) =>
  razorpay().subscriptions.update(id, {
    plan_id: razorpayPlanId(planId),
    schedule_change_at: when,
    customer_notify: 1
  });

export const fetchSubscription = (id) => razorpay().subscriptions.fetch(id);
