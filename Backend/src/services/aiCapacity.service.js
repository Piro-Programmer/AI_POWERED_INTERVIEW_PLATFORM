import aiCapacityModel from "../models/aiCapacity.model.js";

// Global cap on AI API calls across all users, so the site stays under the
// provider's own rate limits. Set the two values a little below your plan's
// requests per minute and per day for the model in use (Groq lists them at
// https://console.groq.com/settings/limits). Every call counts, retries included.
const LIMITS = {
  minute: { env: "AI_GLOBAL_PER_MINUTE", fallback: 25 },
  day: { env: "AI_GLOBAL_PER_DAY", fallback: 900 }
};

export const globalLimit = (window) => {
  const { env, fallback } = LIMITS[window];
  const value = Number.parseInt(process.env[env], 10);
  return Number.isInteger(value) && value > 0 ? value : fallback;
};

/** Thrown when the site-wide AI capacity is used up; maps to HTTP 503. */
export class AiCapacityError extends Error {
  constructor(window, retryAfterSeconds) {
    super(
      window === "minute"
        ? "The AI is busy with other requests right now. Try again in a minute."
        : "The site has reached today's AI capacity. Try again tomorrow."
    );
    this.name = "AiCapacityError";
    this.code = "AI_CAPACITY";
    this.window = window;
    this.retryAfterSeconds = retryAfterSeconds;
  }
}

const windows = (now = new Date()) => {
  const minuteStart = new Date(Math.floor(now.getTime() / 60_000) * 60_000);
  const dayEnd = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + 1));
  return {
    minute: {
      key: `minute:${minuteStart.toISOString().slice(0, 16)}`,
      ends: new Date(minuteStart.getTime() + 60_000)
    },
    day: { key: `day:${now.toISOString().slice(0, 10)}`, ends: dayEnd }
  };
};

/**
 * Atomically take one slot in a window. Same pattern as the per-user quota:
 * the filter only matches while count < limit, and when the window is full
 * the upsert's insert collides with the unique index (E11000).
 */
async function take(key, limit, ends) {
  // Two requests opening a new window at the same instant both try to insert
  // it; the loser gets E11000 although the window isn't full. One retry, now
  // that the document exists, tells the two cases apart.
  for (let attempt = 1; ; attempt++) {
    try {
      await aiCapacityModel.updateOne(
        { window: key, count: { $lt: limit } },
        { $inc: { count: 1 }, $setOnInsert: { expiresAt: new Date(ends.getTime() + 60 * 60 * 1000) } },
        { upsert: true }
      );
      return true;
    } catch (err) {
      if (err?.code !== 11000) throw err;
      if (attempt >= 2) return false;
    }
  }
}

const give = (key) => aiCapacityModel.updateOne({ window: key, count: { $gt: 0 } }, { $inc: { count: -1 } });

/**
 * Take one AI call from this minute's and today's site-wide capacity, or
 * throw AiCapacityError. Call it right before every request to the provider.
 */
export async function takeGlobalSlot(now = new Date()) {
  const { minute, day } = windows(now);

  if (!(await take(minute.key, globalLimit("minute"), minute.ends))) {
    throw new AiCapacityError("minute", Math.max(1, Math.ceil((minute.ends - now) / 1000)));
  }
  if (!(await take(day.key, globalLimit("day"), day.ends))) {
    await give(minute.key); // the minute slot wasn't used after all
    throw new AiCapacityError("day", Math.max(1, Math.ceil((day.ends - now) / 1000)));
  }
}

/** Site-wide calls used so far in the current minute and day. */
export async function getGlobalUsage(now = new Date()) {
  const { minute, day } = windows(now);
  const docs = await aiCapacityModel.find({ window: { $in: [minute.key, day.key] } }).lean();
  const used = (key) => docs.find((d) => d.window === key)?.count || 0;
  return {
    minute: { used: used(minute.key), limit: globalLimit("minute") },
    day: { used: used(day.key), limit: globalLimit("day") }
  };
}
