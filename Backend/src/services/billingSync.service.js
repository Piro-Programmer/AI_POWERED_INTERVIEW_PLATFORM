import subscriptionModel from "../models/subscription.model.js";
import paymentModel from "../models/payment.model.js";
import { planIdFromRazorpay, fetchSubscription, billingEnabled } from "./razorpay.service.js";

// Keeps our Subscription and Payment documents in step with Razorpay, from
// webhooks and from the occasional direct fetch.

const STATUSES = new Set(subscriptionModel.schema.path("status").enumValues);
const fromUnix = (seconds) => (Number.isFinite(seconds) && seconds > 0 ? new Date(seconds * 1000) : undefined);

// Re-check with Razorpay at most this often when no webhook has come in
export const STALE_MS = 6 * 60 * 60 * 1000;

/**
 * The fields to $set on our Subscription from a Razorpay subscription entity.
 * Unknown values (a status we don't model, a plan we don't sell) are left out.
 */
function subscriptionFields(entity, current) {
  const fields = {};
  if (STATUSES.has(entity.status)) fields.status = entity.status;

  const start = fromUnix(entity.current_start);
  const end = fromUnix(entity.current_end);
  if (start) fields.currentPeriodStart = start;
  if (end) fields.currentPeriodEnd = end;

  const plan = planIdFromRazorpay(entity.plan_id);
  if (plan) {
    fields.plan = plan;
    if (current?.scheduledPlan === plan) fields.scheduledPlan = null;
  }

  // Razorpay keeps a cycle-end cancellation as a scheduled change; once the
  // subscription is running normally again there is nothing pending
  if (entity.status === "active" && entity.has_scheduled_changes === false && current?.cancelAtPeriodEnd) {
    fields.cancelAtPeriodEnd = false;
  }
  return fields;
}

/**
 * Apply a subscription entity seen at `eventAt`. Ignored when an event newer
 * than this one was already applied (Razorpay doesn't promise ordering).
 * Returns the updated document, or null when nothing matched.
 */
export async function applySubscriptionEntity(entity, eventAt) {
  if (!entity?.id) return null;
  const current = await subscriptionModel.findOne({ razorpaySubscriptionId: entity.id }).lean();
  if (!current) return null;

  // the filter makes "only if newer" atomic against a concurrent event
  return subscriptionModel.findOneAndUpdate(
    {
      _id: current._id,
      $or: [{ lastEventAt: null }, { lastEventAt: { $exists: false } }, { lastEventAt: { $lte: eventAt } }]
    },
    { $set: { ...subscriptionFields(entity, current), lastEventAt: eventAt } },
    { returnDocument: "after" }
  );
}

/** Record (or update) one payment for the subscription it belongs to. */
export async function recordPayment(payment, subscriptionId) {
  if (!payment?.id) return null;
  const subId = subscriptionId || payment.subscription_id;
  const sub = subId ? await subscriptionModel.findOne({ razorpaySubscriptionId: subId }).lean() : null;
  if (!sub) return null;

  return paymentModel.findOneAndUpdate(
    { razorpayPaymentId: payment.id },
    {
      $set: {
        user: sub.user,
        razorpaySubscriptionId: subId,
        invoiceId: payment.invoice_id || undefined,
        plan: sub.plan,
        amountInPaise: payment.amount,
        currency: payment.currency || "INR",
        status: payment.status,
        method: payment.method,
        paidAt: payment.status === "captured" ? fromUnix(payment.created_at) : undefined
      }
    },
    { upsert: true, returnDocument: "after" }
  );
}

/**
 * Handle one verified webhook event. Unknown events are ignored, so turning
 * on extra events in the dashboard does no harm.
 */
export async function handleWebhookEvent(body) {
  const event = body?.event;
  const subEntity = body?.payload?.subscription?.entity;
  const payEntity = body?.payload?.payment?.entity;
  const eventAt = fromUnix(body?.created_at) || new Date();

  switch (event) {
    case "subscription.charged":
      await applySubscriptionEntity(subEntity, eventAt);
      await recordPayment(payEntity, subEntity?.id);
      return;
    case "subscription.authenticated":
    case "subscription.activated":
    case "subscription.pending":
    case "subscription.halted":
    case "subscription.cancelled":
    case "subscription.completed":
    case "subscription.updated":
      await applySubscriptionEntity(subEntity, eventAt);
      return;
    case "payment.failed":
      // only payments tied to one of our subscriptions are kept
      await recordPayment(payEntity);
      return;
    default:
      return;
  }
}

/**
 * When no webhook has reached us for a while (missed or misconfigured), ask
 * Razorpay directly. Best effort: a failure just leaves the stored state.
 */
export async function reconcileIfStale(userId, now = new Date()) {
  if (!billingEnabled()) return;
  const sub = await subscriptionModel.findOne({ user: userId }).lean();
  if (!sub?.razorpaySubscriptionId || ["completed", "expired"].includes(sub.status)) return;

  const lastSeen = Math.max(sub.lastEventAt?.getTime() || 0, sub.lastSyncedAt?.getTime() || 0);
  if (now.getTime() - lastSeen < STALE_MS) return;

  try {
    await subscriptionModel.updateOne({ _id: sub._id }, { $set: { lastSyncedAt: now } });
    const entity = await fetchSubscription(sub.razorpaySubscriptionId);
    await applySubscriptionEntity(entity, now);
  } catch (err) {
    console.error("Razorpay reconcile failed:", err.message);
  }
}
