import aiCapacityModel from "../models/aiCapacity.model.js";

// Site-wide caps on AI provider usage, across all users, so the site stays
// under the provider's own rate limits. Groq limits both requests and tokens
// per minute and per day; for openai/gpt-oss-120b its rate-limit docs list
// 30 requests/min, 1K requests/day, 8K tokens/min and 200K tokens/day (check
// your plan at https://console.groq.com/settings/limits). Tokens are usually
// the tighter limit: one report is a few thousand tokens.
// Every provider call counts, retries included.
const LIMITS = {
  requestsPerMinute: { env: "AI_GLOBAL_PER_MINUTE", fallback: 25 },
  requestsPerDay: { env: "AI_GLOBAL_PER_DAY", fallback: 900 },
  tokensPerMinute: { env: "AI_GLOBAL_TOKENS_PER_MINUTE", fallback: 7000 },
  tokensPerDay: { env: "AI_GLOBAL_TOKENS_PER_DAY", fallback: 180000 }
};

export const globalLimit = (name) => {
  const { env, fallback } = LIMITS[name];
  const value = Number.parseInt(process.env[env], 10);
  return Number.isInteger(value) && value > 0 ? value : fallback;
};

/** Thrown when the site-wide AI capacity is used up; maps to HTTP 503. */
export class AiCapacityError extends Error {
  constructor(window, retryAfterSeconds) {
    super(
      window === "day"
        ? "The site has reached today's AI capacity. Try again tomorrow."
        : "The AI is busy with other requests right now. Try again in a minute."
    );
    this.name = "AiCapacityError";
    this.code = "AI_CAPACITY";
    this.window = window;
    this.retryAfterSeconds = retryAfterSeconds;
  }
}

const windows = (now = new Date()) => {
  const minuteStart = new Date(Math.floor(now.getTime() / 60_000) * 60_000);
  return {
    minute: {
      key: `minute:${minuteStart.toISOString().slice(0, 16)}`,
      ends: new Date(minuteStart.getTime() + 60_000),
      requests: globalLimit("requestsPerMinute"),
      tokens: globalLimit("tokensPerMinute")
    },
    day: {
      key: `day:${now.toISOString().slice(0, 10)}`,
      ends: new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + 1)),
      requests: globalLimit("requestsPerDay"),
      tokens: globalLimit("tokensPerDay")
    }
  };
};

/**
 * Atomically take one request and `tokens` from a window. The filter only
 * matches while both still fit; when they don't, the upsert's insert collides
 * with the unique index (E11000). Two requests opening a new window at the
 * same instant also collide once, so one retry tells "full" from "race".
 */
async function take(window, tokens) {
  for (let attempt = 1; ; attempt++) {
    try {
      await aiCapacityModel.updateOne(
        { window: window.key, requests: { $lt: window.requests }, tokens: { $lte: window.tokens - tokens } },
        { $inc: { requests: 1, tokens }, $setOnInsert: { expiresAt: new Date(window.ends.getTime() + 60 * 60 * 1000) } },
        { upsert: true }
      );
      return true;
    } catch (err) {
      if (err?.code !== 11000) throw err;
      if (attempt >= 2) return false;
    }
  }
}

const adjust = (key, requests, tokens) =>
  aiCapacityModel.updateOne({ window: key }, [
    {
      $set: {
        requests: { $max: [0, { $add: ["$requests", requests] }] },
        tokens: { $max: [0, { $add: ["$tokens", tokens] }] }
      }
    }
  ], { updatePipeline: true });

/**
 * Reserve one provider call of about `estimatedTokens` from this minute's and
 * today's capacity, or throw AiCapacityError. Returns a reservation to pass to
 * settleGlobalSlot once the provider reports the real token count.
 */
export async function takeGlobalSlot(estimatedTokens, now = new Date()) {
  const { minute, day } = windows(now);
  // A single call bigger than a whole window could never fit; let it through
  // when the window is otherwise empty (the provider decides) rather than
  // refusing it forever.
  const tokens = Math.max(1, Math.min(Math.ceil(estimatedTokens), minute.tokens, day.tokens));

  if (!(await take(minute, tokens))) {
    throw new AiCapacityError("minute", Math.max(1, Math.ceil((minute.ends - now) / 1000)));
  }
  if (!(await take(day, tokens))) {
    await adjust(minute.key, -1, -tokens); // the minute share wasn't used after all
    throw new AiCapacityError("day", Math.max(1, Math.ceil((day.ends - now) / 1000)));
  }
  return { minuteKey: minute.key, dayKey: day.key, tokens };
}

/** Replace a reservation's estimated tokens with what the provider actually counted. */
export async function settleGlobalSlot(reservation, actualTokens) {
  if (!reservation || !Number.isFinite(actualTokens) || actualTokens <= 0) return;
  const diff = Math.round(actualTokens) - reservation.tokens;
  if (diff === 0) return;
  await Promise.all([adjust(reservation.minuteKey, 0, diff), adjust(reservation.dayKey, 0, diff)]);
}

/** Site-wide requests and tokens used so far in the current minute and day. */
export async function getGlobalUsage(now = new Date()) {
  const { minute, day } = windows(now);
  const docs = await aiCapacityModel.find({ window: { $in: [minute.key, day.key] } }).lean();
  const usage = (w) => {
    const doc = docs.find((d) => d.window === w.key);
    return { requests: doc?.requests || 0, tokens: doc?.tokens || 0, requestLimit: w.requests, tokenLimit: w.tokens };
  };
  return { minute: usage(minute), day: usage(day) };
}
