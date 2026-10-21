// The plan catalogue: the one place prices and limits are defined. The
// server never takes a price or a limit from the client.
//
// Each kind of AI call has a monthly allowance (the plan's real size) and a
// daily cap (so one day can't burn the whole month, and AI costs stay bounded).

const envInt = (name, fallback) => {
  const value = Number.parseInt(process.env[name], 10);
  return Number.isInteger(value) && value > 0 ? value : fallback;
};

const PLANS = {
  free: {
    id: "free",
    name: "Free",
    priceInPaise: 0,
    currency: "INR",
    interval: "monthly",
    // Free limits can be tuned per deployment without a code change
    limits: () => ({
      report: { daily: envInt("AI_DAILY_LIMIT", 2), monthly: envInt("AI_MONTHLY_LIMIT", 5) },
      review: { daily: envInt("AI_DAILY_REVIEW_LIMIT", 10), monthly: envInt("AI_MONTHLY_REVIEW_LIMIT", 30) }
    }),
    // beyond the limits, which the catalogue lists from the numbers in force
    features: ["Share links for your reports"],
    razorpayPlanEnv: null
  },
  pro: {
    id: "pro",
    name: "Pro",
    priceInPaise: 29900,
    currency: "INR",
    interval: "monthly",
    limits: () => ({
      report: { daily: 10, monthly: 60 },
      review: { daily: 60, monthly: 400 }
    }),
    features: ["Everything in Free"],
    razorpayPlanEnv: "RAZORPAY_PLAN_PRO"
  },
  premium: {
    id: "premium",
    name: "Premium",
    priceInPaise: 69900,
    currency: "INR",
    interval: "monthly",
    limits: () => ({
      report: { daily: 25, monthly: 200 },
      review: { daily: 150, monthly: 1500 }
    }),
    features: ["Everything in Pro"],
    razorpayPlanEnv: "RAZORPAY_PLAN_PREMIUM"
  }
};

export const PLAN_IDS = Object.keys(PLANS);
export const PAID_PLAN_IDS = PLAN_IDS.filter((id) => PLANS[id].priceInPaise > 0);

/** A plan by id, or the Free plan for anything unknown. */
export const getPlan = (id) => PLANS[id] || PLANS.free;

/** Today's limits for a plan: { report: {daily, monthly}, review: {...} } */
export const planLimits = (id) => getPlan(id).limits();

/** True when a paid plan can actually be bought (Razorpay is configured for it). */
export const isPurchasable = (id) => {
  const plan = PLANS[id];
  return Boolean(
    plan?.razorpayPlanEnv &&
      process.env[plan.razorpayPlanEnv] &&
      process.env.RAZORPAY_KEY_ID &&
      process.env.RAZORPAY_KEY_SECRET
  );
};

/** The catalogue as the pricing page sees it: no env names, no secrets. */
export const publicCatalogue = () =>
  PLAN_IDS.map((id) => {
    const { name, priceInPaise, currency, interval, features } = PLANS[id];
    const limits = planLimits(id);
    const count = (n) => n.toLocaleString("en-IN");
    return {
      id,
      name,
      priceInPaise,
      currency,
      interval,
      // limit lines come from the live numbers, so they never disagree with them
      features: [
        `${count(limits.report.monthly)} interview reports a month`,
        `${count(limits.review.monthly)} AI answer reviews a month`,
        ...features
      ],
      limits,
      purchasable: isPurchasable(id)
    };
  });
