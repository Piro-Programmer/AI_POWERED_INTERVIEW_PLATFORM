import aiUsageModel from "../models/aiUsage.model.js";

const DEFAULT_DAILY_LIMIT = 10;

export const dailyLimit = () => {
  const value = Number.parseInt(process.env.AI_DAILY_LIMIT, 10);
  return Number.isInteger(value) && value > 0 ? value : DEFAULT_DAILY_LIMIT;
};

const utcDay = (now = new Date()) => now.toISOString().slice(0, 10);

const nextUtcMidnight = (now = new Date()) =>
  new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + 1));

const toUsage = (used) => {
  const limit = dailyLimit();
  return {
    limit,
    used: Math.min(used, limit),
    remaining: Math.max(0, limit - used),
    resetsAt: nextUtcMidnight().toISOString()
  };
};

/** Today's allowance for a user. */
export async function getUsage(userId) {
  const doc = await aiUsageModel.findOne({ user: userId, day: utcDay() }).lean();
  return toUsage(doc?.count || 0);
}

/**
 * Atomically take one generation from today's allowance.
 *
 * The filter only matches while count < limit. When today's document is
 * already at the limit, the upsert tries to insert a second {user, day}
 * document and the unique index rejects it (E11000), so two parallel
 * requests can never both get the last slot.
 *
 * Returns { day, usage } on success, or null when the allowance is used up.
 */
export async function reserveGeneration(userId) {
  const day = utcDay();
  try {
    const doc = await aiUsageModel.findOneAndUpdate(
      { user: userId, day, count: { $lt: dailyLimit() } },
      { $inc: { count: 1 } },
      { upsert: true, returnDocument: "after", setDefaultsOnInsert: true }
    ).lean();
    return { day, usage: toUsage(doc.count) };
  } catch (err) {
    if (err?.code === 11000) return null;
    throw err;
  }
}

/** Give a generation back, e.g. when the AI call failed. */
export async function refundGeneration(userId, day) {
  await aiUsageModel.updateOne(
    { user: userId, day, count: { $gt: 0 } },
    { $inc: { count: -1 } }
  );
}
