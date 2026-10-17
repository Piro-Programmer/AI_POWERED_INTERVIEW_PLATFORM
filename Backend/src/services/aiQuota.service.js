import aiUsageModel from "../models/aiUsage.model.js";

// Each AI call is counted twice: against today's cap and against the billing
// period's allowance. The limits come from the user's plan (see
// entitlement.service.js and config/plans.js); reports and answer reviews
// have separate allowances.

const DAY_MS = 24 * 60 * 60 * 1000;
const DAY_KEEP_MS = 7 * DAY_MS; // daily counters only matter for today
const PERIOD_KEEP_MS = 365 * DAY_MS; // period counters double as usage history

const utcDay = (now) => now.toISOString().slice(0, 10);

const nextUtcMidnight = (now) =>
  new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + 1));

const counter = (used, limit, resetsAt) => ({
  limit,
  used: Math.min(used, limit),
  remaining: Math.max(0, limit - used),
  resetsAt: resetsAt.toISOString()
});

/**
 * The usage the API returns. The top-level { limit, used, remaining,
 * resetsAt } is "today" as the UI has always shown it, except that remaining
 * and resetsAt follow whichever allowance runs out first. `daily` and
 * `monthly` carry the full detail.
 */
function toUsage(entitlement, kind, dailyUsed, monthlyUsed, now) {
  const limits = entitlement.plan.limits()[kind];
  const daily = counter(dailyUsed, limits.daily, nextUtcMidnight(now));
  const monthly = counter(monthlyUsed, limits.monthly, entitlement.periodEnd);
  const limitedBy = monthly.remaining === 0 || monthly.remaining < daily.remaining ? "month" : "day";
  const binding = limitedBy === "month" ? monthly : daily;
  return {
    limit: daily.limit,
    used: daily.used,
    remaining: binding.remaining,
    resetsAt: binding.resetsAt,
    limitedBy,
    plan: entitlement.plan.id,
    daily,
    monthly
  };
}

/** A user's current usage of one kind, under their entitlement. */
export async function getUsage(userId, kind, entitlement, now = new Date()) {
  const [day, period] = await Promise.all([
    aiUsageModel.findOne({ user: userId, day: utcDay(now), kind }).lean(),
    aiUsageModel.findOne({ user: userId, day: entitlement.periodKey, kind }).lean()
  ]);
  return toUsage(entitlement, kind, day?.count || 0, period?.count || 0, now);
}

/**
 * Atomically take one call from a bucket. The filter only matches while
 * count < limit. When the bucket is already full, the upsert tries to insert
 * a second {user, day, kind} document and the unique index rejects it
 * (E11000), so two parallel requests can never both get the last slot.
 * Returns the new count, or null when the bucket is full.
 */
async function take(userId, bucket, kind, limit, expiresAt) {
  try {
    const doc = await aiUsageModel.findOneAndUpdate(
      { user: userId, day: bucket, kind, count: { $lt: limit } },
      { $inc: { count: 1 }, $setOnInsert: { expiresAt } },
      { upsert: true, returnDocument: "after", setDefaultsOnInsert: true }
    ).lean();
    return doc.count;
  } catch (err) {
    if (err?.code === 11000) return null;
    throw err;
  }
}

const giveBack = (userId, bucket, kind) =>
  aiUsageModel.updateOne({ user: userId, day: bucket, kind, count: { $gt: 0 } }, { $inc: { count: -1 } });

/**
 * Take one call from today's cap and from the period's allowance.
 *   Success:   { buckets, usage } — keep it to refund a failed call.
 *   Used up:   { limited: "DAILY_LIMIT" | "MONTHLY_LIMIT", usage }
 * If the day has room but the period doesn't, the day's slot is given back.
 */
export async function reserveGeneration(userId, kind, entitlement, now = new Date()) {
  const limits = entitlement.plan.limits()[kind];
  const buckets = { day: utcDay(now), period: entitlement.periodKey };

  const dailyUsed = await take(userId, buckets.day, kind, limits.daily, new Date(now.getTime() + DAY_KEEP_MS));
  if (dailyUsed === null) {
    return { limited: "DAILY_LIMIT", usage: await getUsage(userId, kind, entitlement, now) };
  }

  const periodExpiry = new Date(entitlement.periodEnd.getTime() + PERIOD_KEEP_MS);
  const monthlyUsed = await take(userId, buckets.period, kind, limits.monthly, periodExpiry);
  if (monthlyUsed === null) {
    await giveBack(userId, buckets.day, kind);
    return { limited: "MONTHLY_LIMIT", usage: await getUsage(userId, kind, entitlement, now) };
  }

  return { buckets, usage: toUsage(entitlement, kind, dailyUsed, monthlyUsed, now) };
}

/** Give a call back to both buckets, e.g. when the AI request failed. */
export async function refundGeneration(userId, reservation, kind) {
  await Promise.all([
    giveBack(userId, reservation.buckets.day, kind),
    giveBack(userId, reservation.buckets.period, kind)
  ]);
}

/** The 429 body for a used-up allowance. `noun` is e.g. "reports". */
export function limitResponse({ limited, usage }, noun) {
  const planName = usage.plan.charAt(0).toUpperCase() + usage.plan.slice(1);
  const message =
    limited === "MONTHLY_LIMIT"
      ? `You've used all ${usage.monthly.limit} ${noun} in this billing period on the ${planName} plan.`
      : `You've used all ${usage.daily.limit} ${noun} for today.`;
  return { code: limited, message, usage };
}
