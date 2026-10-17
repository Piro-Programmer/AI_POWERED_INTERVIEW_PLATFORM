import subscriptionModel from "../models/subscription.model.js";
import { getPlan } from "../config/plans.js";

// What a user has paid for, separate from what they've used (aiQuota.service).

// After a failed renewal Razorpay keeps retrying the charge for a few days;
// the user keeps their plan meanwhile instead of dropping to Free at once.
export const GRACE_DAYS = 3;
const DAY_MS = 24 * 60 * 60 * 1000;

const calendarMonth = (now) => {
  const start = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
  const end = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1));
  return { start, end, key: `M:${start.toISOString().slice(0, 7)}` };
};

/** True when a subscription still gives its plan at `now`. */
export function subscriptionGrantsAccess(sub, now = new Date()) {
  if (!sub) return false;
  const end = sub.currentPeriodEnd?.getTime();
  switch (sub.status) {
    case "authenticated":
    case "active":
      return true;
    case "pending":
    case "halted":
      return Boolean(end) && now.getTime() < end + GRACE_DAYS * DAY_MS;
    case "cancelled":
      return Boolean(sub.cancelAtPeriodEnd && end) && now.getTime() < end;
    default:
      return false;
  }
}

/**
 * The plan in force for a user right now, and the billing period its monthly
 * allowance belongs to.
 *   user: { id, role } (req.user)
 * Returns { plan, source: "free"|"subscription"|"admin", status, periodStart,
 *           periodEnd, periodKey, cancelAtPeriodEnd }
 * Free users count by calendar month (UTC); subscribers by their own billing
 * period, so the allowance renews on the day they're charged.
 */
export async function getEntitlement(user, now = new Date()) {
  const month = calendarMonth(now);
  const free = {
    plan: getPlan("free"),
    source: "free",
    status: null,
    periodStart: month.start,
    periodEnd: month.end,
    periodKey: month.key,
    cancelAtPeriodEnd: false
  };

  // Admins test every feature, so they get the top plan without paying
  if (user.role === "admin") return { ...free, plan: getPlan("premium"), source: "admin" };

  const sub = await subscriptionModel.findOne({ user: user.id }).lean();
  if (!subscriptionGrantsAccess(sub, now)) {
    return { ...free, status: sub?.status ?? null };
  }

  const hasPeriod = sub.currentPeriodStart && sub.currentPeriodEnd;
  return {
    plan: getPlan(sub.plan),
    source: "subscription",
    status: sub.status,
    // just authenticated, before the first charge reports a period
    periodStart: hasPeriod ? sub.currentPeriodStart : month.start,
    periodEnd: hasPeriod ? sub.currentPeriodEnd : month.end,
    periodKey: hasPeriod ? `P:${sub.currentPeriodStart.toISOString()}` : month.key,
    cancelAtPeriodEnd: Boolean(sub.cancelAtPeriodEnd)
  };
}
