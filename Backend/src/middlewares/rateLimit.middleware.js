import { rateLimit } from "express-rate-limit";

const MINUTE = 60 * 1000;

const minutesUntil = (date) =>
  Math.max(1, Math.ceil(((date instanceof Date ? date.getTime() : Date.now()) - Date.now()) / MINUTE));

// Every limiter answers with the same JSON shape the frontend already shows:
// { message, retryAfterMinutes }. Counters live in memory, so they reset if
// the server restarts; the daily AI allowance is stored in MongoDB instead.
const limiter = ({ message, ...options }) =>
  rateLimit({
    standardHeaders: "draft-8",
    legacyHeaders: false,
    handler: (req, res, next, used) => {
      const minutes = minutesUntil(req.rateLimit?.resetTime);
      res.status(used.statusCode).json({
        message: `${message} Try again in ${minutes} minute${minutes === 1 ? "" : "s"}.`,
        retryAfterMinutes: minutes
      });
    },
    ...options
  });

/** Broad guard for the whole API, per IP address. */
export const apiLimiter = limiter({
  windowMs: 15 * MINUTE,
  limit: 300,
  message: "Too many requests from your network."
});

/** Failed sign-ins per IP address (successful ones don't count). */
export const loginIpLimiter = limiter({
  windowMs: 15 * MINUTE,
  limit: 30,
  skipSuccessfulRequests: true,
  message: "Too many sign-in attempts from your network."
});

/** Failed sign-ins per account, so one address can't be guessed at from many IPs. */
export const loginAccountLimiter = limiter({
  windowMs: 15 * MINUTE,
  limit: 10,
  skipSuccessfulRequests: true,
  keyGenerator: (req) => `login:${String(req.body?.email ?? "").trim().toLowerCase()}`,
  message: "Too many sign-in attempts for this account."
});

/** New accounts per IP address. */
export const registerLimiter = limiter({
  windowMs: 60 * MINUTE,
  limit: 10,
  message: "Too many accounts created from your network."
});

/** Report generation bursts per signed-in user (runs after authUser). */
export const generateLimiter = limiter({
  windowMs: MINUTE,
  limit: 3,
  keyGenerator: (req) => `generate:${req.user.id}`,
  message: "You're generating reports too quickly."
});

/** Practice answer reviews per signed-in user (runs after authUser). */
export const reviewLimiter = limiter({
  windowMs: MINUTE,
  limit: 10,
  keyGenerator: (req) => `review:${req.user.id}`,
  message: "You're sending answers too quickly."
});

/** Plan-progress saves per signed-in user (runs after authUser). */
export const progressLimiter = limiter({
  windowMs: MINUTE,
  limit: 60,
  keyGenerator: (req) => `progress:${req.user.id}`,
  message: "Too many saves."
});
