import aiUsageModel from "../models/aiUsage.model.js";

// Separate daily allowances: full reports are expensive, answer reviews are
// small and happen many times per practice session.
const LIMITS = {
  report: { env: "AI_DAILY_LIMIT", fallback: 10 },
  review: { env: "AI_DAILY_REVIEW_LIMIT", fallback: 30 }
};

export const dailyLimit = (kind = "report") => {
  const { env, fallback } = LIMITS[kind];
  const value = Number.parseInt(process.env[env], 10);
  return Number.isInteger(value) && value > 0 ? value : fallback;
};

const utcDay = (now = new Date()) => now.toISOString().slice(0, 10);

const nextUtcMidnight = (now = new Date()) =>
  new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + 1));

const toUsage = (used, kind) => {
  const limit = dailyLimit(kind);
  return {
    limit,
    used: Math.min(used, limit),
    remaining: Math.max(0, limit - used),
    resetsAt: nextUtcMidnight().toISOString()
  };
};

/** Today's allowance of one kind for a user. */
export async function getUsage(userId, kind = "report") {
  const doc = await aiUsageModel.findOne({ user: userId, day: utcDay(), kind }).lean();
  return toUsage(doc?.count || 0, kind);
}

/**
 * Atomically take one call from today's allowance.
 *
 * The filter only matches while count < limit. When today's document is
 * already at the limit, the upsert tries to insert a second {user, day, kind}
 * document and the unique index rejects it (E11000), so two parallel
 * requests can never both get the last slot.
 *
 * Returns { day, usage } on success, or null when the allowance is used up.
 */
export async function reserveGeneration(userId, kind = "report") {
  const day = utcDay();
  try {
    const doc = await aiUsageModel.findOneAndUpdate(
      { user: userId, day, kind, count: { $lt: dailyLimit(kind) } },
      { $inc: { count: 1 } },
      { upsert: true, returnDocument: "after", setDefaultsOnInsert: true }
    ).lean();
    return { day, usage: toUsage(doc.count, kind) };
  } catch (err) {
    if (err?.code === 11000) return null;
    throw err;
  }
}

/** Give a call back, e.g. when the AI request failed. */
export async function refundGeneration(userId, day, kind = "report") {
  await aiUsageModel.updateOne(
    { user: userId, day, kind, count: { $gt: 0 } },
    { $inc: { count: -1 } }
  );
}
