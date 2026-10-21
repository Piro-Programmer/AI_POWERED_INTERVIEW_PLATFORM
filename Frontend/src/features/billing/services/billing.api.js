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
 *   period: { start, end }, usage: { report, review } }.
 */
export async function getMyBilling() {
  const response = await api.get("/api/billing/me");
  return response.data;
}
