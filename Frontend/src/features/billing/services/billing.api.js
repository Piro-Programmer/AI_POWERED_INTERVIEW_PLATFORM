import api from "../../../lib/api";

/**
 * The plan catalogue (no sign-in needed).
 * Resolves to { plans: [{ id, name, priceInPaise, currency, interval, features,
 *   limits: { report: { daily, monthly }, review: {...} }, purchasable }] }.
 */
export async function getPlans() {
  const response = await api.get("/api/billing/plans");
  return response.data;
}

/**
 * The signed-in user's plan and usage.
 * Resolves to { plan: { id, name }, source, status, cancelAtPeriodEnd,
 *   scheduledPlan, period: { start, end }, usage: { report, review } }.
 */
export async function getMyBilling() {
  const response = await api.get("/api/billing/me");
  return response.data;
}

/** Start checkout for a paid plan. Resolves to { subscriptionId, keyId }. */
export async function subscribe(planId) {
  const response = await api.post("/api/billing/subscribe", { planId });
  return response.data;
}

/**
 * Hand Razorpay Checkout's success payload to the server to check its signature.
 * payload: { razorpay_payment_id, razorpay_subscription_id, razorpay_signature }
 */
export async function verifyPayment(payload) {
  const response = await api.post("/api/billing/verify", payload);
  return response.data;
}

/** Cancel at the end of the paid period. */
export async function cancelSubscription() {
  const response = await api.post("/api/billing/cancel");
  return response.data;
}

/** Undo a cancellation (or a scheduled downgrade) before it takes effect. */
export async function resumeSubscription() {
  const response = await api.post("/api/billing/resume");
  return response.data;
}

/** Switch paid plan: upgrades now, downgrades at the end of the period. */
export async function changePlan(planId) {
  const response = await api.post("/api/billing/change-plan", { planId });
  return response.data;
}

/** Payments, newest first: { invoices: [{ razorpayPaymentId, plan, amountInPaise, currency, status, method, paidAt }] } */
export async function getInvoices() {
  const response = await api.get("/api/billing/invoices");
  return response.data;
}
