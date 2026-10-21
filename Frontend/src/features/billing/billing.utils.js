/** "₹299", "₹0" — whole rupees, Indian digit grouping. */
export const formatPrice = (paise, currency = "INR") =>
  new Intl.NumberFormat("en-IN", { style: "currency", currency, maximumFractionDigits: 0 }).format(paise / 100);

/** "5 Nov" */
export const formatDay = (iso) => new Date(iso).toLocaleDateString([], { day: "numeric", month: "short" });

/** 0–100, for a usage meter. */
export const percentUsed = ({ used, limit }) => (limit > 0 ? Math.min(100, Math.round((used / limit) * 100)) : 0);

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
    return "Your renewal payment failed. We're retrying; update your payment method to keep your plan.";
  }
  if (billing.cancelAtPeriodEnd) return `Cancelled. Your plan stays until ${end}, then you're on Free.`;
  return `Renews on ${end}.`;
}

// Ordered cheapest first, so "is this an upgrade?" is an index comparison.
const ORDER = ["free", "pro", "premium"];

/** What the button on a plan card should say for this viewer. */
export function planAction(planId, currentPlanId) {
  if (!currentPlanId) return planId === "free" ? "start" : "choose";
  if (planId === currentPlanId) return "current";
  return ORDER.indexOf(planId) > ORDER.indexOf(currentPlanId) ? "upgrade" : "downgrade";
}
