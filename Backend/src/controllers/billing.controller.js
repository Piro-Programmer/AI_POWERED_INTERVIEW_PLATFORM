import { publicCatalogue, getPlan, PAID_PLAN_IDS } from "../config/plans.js";
import { getEntitlement, subscriptionGrantsAccess } from "../services/entitlement.service.js";
import { getUsage } from "../services/aiQuota.service.js";
import subscriptionModel from "../models/subscription.model.js";
import paymentModel from "../models/payment.model.js";
import webhookEventModel from "../models/webhookEvent.model.js";
import * as razorpay from "../services/razorpay.service.js";
import { handleWebhookEvent, reconcileIfStale } from "../services/billingSync.service.js";

const disabled = (res) =>
  res.status(503).json({ code: "BILLING_DISABLED", message: "Payments aren't available right now." });

// Razorpay's SDK rejects with { statusCode, error: { description } }
const providerError = (res, err, what) => {
  console.error(`Razorpay ${what} failed:`, err?.error?.description || err?.message);
  return res.status(502).json({ message: `Couldn't ${what} with the payment provider. Please try again.` });
};

/**
 * @name getPlansController
 * @description The plan catalogue for the pricing page: prices in paise,
 *              limits, features and whether each plan can be bought yet.
 * @access public
 */
function getPlansController(req, res) {
  res.set("Cache-Control", "public, max-age=300");
  return res.status(200).json({ plans: publicCatalogue() });
}

/**
 * @name getMyBillingController
 * @description The signed-in user's plan, subscription state, billing period
 *              and usage of both kinds of AI call.
 * @access private
 */
async function getMyBillingController(req, res) {
  try {
    await reconcileIfStale(req.user.id);
    const entitlement = await getEntitlement(req.user);
    const [report, review, sub] = await Promise.all([
      getUsage(req.user.id, "report", entitlement),
      getUsage(req.user.id, "review", entitlement),
      subscriptionModel.findOne({ user: req.user.id }).select("scheduledPlan").lean()
    ]);

    return res.status(200).json({
      plan: { id: entitlement.plan.id, name: entitlement.plan.name },
      source: entitlement.source,
      status: entitlement.status,
      cancelAtPeriodEnd: entitlement.cancelAtPeriodEnd,
      scheduledPlan: sub?.scheduledPlan ?? null,
      period: {
        start: entitlement.periodStart.toISOString(),
        end: entitlement.periodEnd.toISOString()
      },
      usage: { report, review }
    });
  } catch (err) {
    console.error("getMyBilling failed:", err.message);
    return res.status(500).json({ message: "Failed to load billing details", error: err.message });
  }
}

/**
 * @name subscribeController
 * @description Start checkout for a paid plan: creates (or reuses) a Razorpay
 *              subscription and returns what Razorpay Checkout needs.
 * @body { planId: "pro" | "premium" }
 * @access private
 */
async function subscribeController(req, res) {
  if (!razorpay.billingEnabled()) return disabled(res);
  const { planId } = req.body ?? {};
  if (!PAID_PLAN_IDS.includes(planId)) {
    return res.status(400).json({ message: "Choose a paid plan." });
  }
  if (!razorpay.razorpayPlanId(planId)) return disabled(res);

  const existing = await subscriptionModel.findOne({ user: req.user.id }).lean();
  if (subscriptionGrantsAccess(existing)) {
    return res.status(409).json({ message: "You already have a plan. Change it from your billing page instead." });
  }

  const keyId = process.env.RAZORPAY_KEY_ID;
  // checkout opened earlier but never paid: hand back the same subscription
  if (existing?.status === "created" && existing.plan === planId && existing.razorpaySubscriptionId) {
    return res.status(200).json({ subscriptionId: existing.razorpaySubscriptionId, keyId });
  }

  let created;
  try {
    created = await razorpay.createSubscription({ planId, userId: req.user.id });
  } catch (err) {
    return providerError(res, err, "start the subscription");
  }

  // one document per user: a new subscription replaces the old, finished one
  await subscriptionModel.findOneAndUpdate(
    { user: req.user.id },
    {
      $set: {
        plan: planId,
        status: "created",
        razorpaySubscriptionId: created.id,
        cancelAtPeriodEnd: false,
        scheduledPlan: null
      },
      $unset: { currentPeriodStart: 1, currentPeriodEnd: 1, lastEventAt: 1, lastSyncedAt: 1 }
    },
    { upsert: true }
  );

  return res.status(201).json({ subscriptionId: created.id, keyId });
}

/**
 * @name verifyController
 * @description Checkout's success handler: checks Razorpay's signature and
 *              marks the subscription authenticated. The charge itself is
 *              confirmed by the subscription.charged webhook.
 * @body { razorpay_payment_id, razorpay_subscription_id, razorpay_signature }
 * @access private
 */
async function verifyController(req, res) {
  if (!razorpay.billingEnabled()) return disabled(res);
  const {
    razorpay_payment_id: paymentId,
    razorpay_subscription_id: subscriptionId,
    razorpay_signature: signature
  } = req.body ?? {};

  if (!razorpay.verifyCheckoutSignature({ paymentId, subscriptionId, signature })) {
    return res.status(400).json({ message: "Payment couldn't be verified." });
  }

  const sub = await subscriptionModel.findOne({ user: req.user.id, razorpaySubscriptionId: subscriptionId });
  if (!sub) return res.status(404).json({ message: "Subscription not found." });

  // never move a subscription a webhook already activated back a step
  if (sub.status === "created") {
    sub.status = "authenticated";
    await sub.save();
  }
  return res.status(200).json({ status: sub.status, plan: sub.plan });
}

const runningSubscription = (userId) =>
  subscriptionModel.findOne({ user: userId, status: { $in: ["authenticated", "active", "pending"] } });

/**
 * @name cancelController
 * @description Cancel at the end of the paid period; the plan stays until then.
 * @access private
 */
async function cancelController(req, res) {
  if (!razorpay.billingEnabled()) return disabled(res);
  const sub = await runningSubscription(req.user.id);
  if (!sub) return res.status(404).json({ message: "You don't have a subscription to cancel." });
  if (sub.cancelAtPeriodEnd) return res.status(200).json({ cancelAtPeriodEnd: true, periodEnd: sub.currentPeriodEnd });

  try {
    await razorpay.cancelSubscription(sub.razorpaySubscriptionId, true);
  } catch (err) {
    return providerError(res, err, "cancel the subscription");
  }
  sub.cancelAtPeriodEnd = true;
  await sub.save();
  return res.status(200).json({ cancelAtPeriodEnd: true, periodEnd: sub.currentPeriodEnd });
}

/**
 * @name resumeController
 * @description Undo a cancellation that hasn't taken effect yet.
 * @access private
 */
async function resumeController(req, res) {
  if (!razorpay.billingEnabled()) return disabled(res);
  const sub = await runningSubscription(req.user.id);
  if (!sub?.cancelAtPeriodEnd) {
    return res.status(409).json({ message: "There's no cancellation to undo. Subscribe again from the pricing page." });
  }

  try {
    await razorpay.cancelScheduledChanges(sub.razorpaySubscriptionId);
  } catch (err) {
    return providerError(res, err, "resume the subscription");
  }
  sub.cancelAtPeriodEnd = false;
  sub.scheduledPlan = null;
  await sub.save();
  return res.status(200).json({ cancelAtPeriodEnd: false });
}

/**
 * @name changePlanController
 * @description Switch between paid plans. An upgrade applies at once; a
 *              downgrade waits for the end of the paid period.
 * @body { planId: "pro" | "premium" }
 * @access private
 */
async function changePlanController(req, res) {
  if (!razorpay.billingEnabled()) return disabled(res);
  const { planId } = req.body ?? {};
  if (!PAID_PLAN_IDS.includes(planId)) return res.status(400).json({ message: "Choose a paid plan." });
  if (!razorpay.razorpayPlanId(planId)) return disabled(res);

  const sub = await subscriptionModel.findOne({ user: req.user.id, status: { $in: ["authenticated", "active"] } });
  if (!sub) return res.status(404).json({ message: "You don't have a subscription to change." });
  if (sub.cancelAtPeriodEnd) return res.status(409).json({ message: "Resume your subscription before changing plan." });
  if (sub.plan === planId) return res.status(409).json({ message: "You're already on this plan." });

  const upgrade = getPlan(planId).priceInPaise > getPlan(sub.plan).priceInPaise;
  const when = upgrade ? "now" : "cycle_end";
  try {
    await razorpay.changePlan(sub.razorpaySubscriptionId, planId, when);
  } catch (err) {
    return providerError(res, err, "change the plan");
  }

  if (upgrade) {
    sub.plan = planId;
    sub.scheduledPlan = null;
  } else {
    sub.scheduledPlan = planId;
  }
  await sub.save();
  return res.status(200).json({ plan: sub.plan, scheduledPlan: sub.scheduledPlan, effective: when });
}

/**
 * @name getInvoicesController
 * @description The user's payments, newest first.
 * @access private
 */
async function getInvoicesController(req, res) {
  if (!razorpay.billingEnabled()) return disabled(res);
  const payments = await paymentModel
    .find({ user: req.user.id })
    .sort({ paidAt: -1, createdAt: -1 })
    .limit(100)
    .select("razorpayPaymentId invoiceId plan amountInPaise currency status method paidAt createdAt -_id")
    .lean();
  return res.status(200).json({ invoices: payments });
}

/**
 * @name webhookController
 * @description Razorpay webhooks. Mounted with express.raw so the signature
 *              is checked against the exact bytes Razorpay signed.
 * @access Razorpay (signed)
 */
async function webhookController(req, res) {
  if (!process.env.RAZORPAY_WEBHOOK_SECRET) return disabled(res);
  if (!razorpay.verifyWebhookSignature(req.body, req.get("x-razorpay-signature"))) {
    return res.status(400).json({ message: "Invalid signature." });
  }

  let body;
  try {
    body = JSON.parse(req.body.toString("utf8"));
  } catch {
    return res.status(400).json({ message: "Request body isn't valid JSON." });
  }

  const eventId = req.get("x-razorpay-event-id");
  if (eventId) {
    try {
      await webhookEventModel.create({ eventId, event: body.event });
    } catch (err) {
      if (err.code === 11000) return res.status(200).json({ status: "duplicate" });
      throw err;
    }
  }

  try {
    await handleWebhookEvent(body);
  } catch (err) {
    // forget the event so Razorpay's retry gets processed
    if (eventId) await webhookEventModel.deleteOne({ eventId }).catch(() => {});
    console.error("Razorpay webhook failed:", err.message);
    return res.status(500).json({ message: "Webhook failed." });
  }
  return res.status(200).json({ status: "ok" });
}

export default {
  getPlansController,
  getMyBillingController,
  subscribeController,
  verifyController,
  cancelController,
  resumeController,
  changePlanController,
  getInvoicesController,
  webhookController
};
