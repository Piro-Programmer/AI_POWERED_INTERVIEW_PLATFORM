/** "₹299", "₹0" — whole rupees, Indian digit grouping. */
export const formatPrice = (paise, currency = "INR") =>
  new Intl.NumberFormat("en-IN", { style: "currency", currency, maximumFractionDigits: 0 }).format(paise / 100);

/** "5 Nov" */
export const formatDay = (iso) => new Date(iso).toLocaleDateString([], { day: "numeric", month: "short" });

/** "5 Nov 2026" */
export const formatDate = (iso) =>
  new Date(iso).toLocaleDateString([], { day: "numeric", month: "short", year: "numeric" });

/** 0–100, for a usage meter. */
export const percentUsed = ({ used, limit }) => (limit > 0 ? Math.min(100, Math.round((used / limit) * 100)) : 0);

const PLAN_NAMES = { free: "Free", pro: "Pro", premium: "Premium" };
export const planName = (id) => PLAN_NAMES[id] || id;

/**
 * A billing request's failure in words. The server explains itself
 * (409 "already on this plan", 429 "try again in N minutes", 502 provider
 * trouble); 503 BILLING_DISABLED gets a steadier line.
 */
export function billingError(err, fallback) {
  const data = err?.response?.data;
  if (data?.code === "BILLING_DISABLED") return "Payments aren't open yet. Your Free plan keeps working.";
  return data?.message || err?.message || fallback;
}

/** One line about where the subscription stands, or null for plain Free. */
export function statusLine(billing) {
  if (!billing) return null;
  const end = formatDay(billing.period.end);
  if (billing.source === "admin") return "Admin account: every plan feature, no charge.";
  if (billing.source === "free") {
    return billing.status === "pending" || billing.status === "halted"
      ? "Your last payment didn't go through, so you're back on Free."
      : null;
  }
  if (billing.status === "pending" || billing.status === "halted") {
    return "Your renewal payment failed. Razorpay is retrying; check the payment method on your card or UPI app to keep your plan.";
  }
  if (billing.cancelAtPeriodEnd) return `Cancelled. Your plan stays until ${end}, then you're on Free.`;
  if (billing.scheduledPlan) return `Switches to ${planName(billing.scheduledPlan)} on ${end}.`;
  if (billing.status === "authenticated") return "Payment received. Your plan is active.";
  return `Renews on ${end}.`;
}

// Ordered cheapest first, so "is this an upgrade?" is an index comparison.
const ORDER = ["free", "pro", "premium"];

/**
 * What the button on a plan card does for this viewer:
 *   signed out:  "start" (Free) | "choose" (paid, sign up first)
 *   signed in:   "current" | "upgrade" | "downgrade"
 */
export function planAction(planId, currentPlanId) {
  if (!currentPlanId) return planId === "free" ? "start" : "choose";
  if (planId === currentPlanId) return "current";
  return ORDER.indexOf(planId) > ORDER.indexOf(currentPlanId) ? "upgrade" : "downgrade";
}

/** True when this billing state is a subscription the user can manage. */
export const isSubscriber = (billing) => billing?.source === "subscription";
