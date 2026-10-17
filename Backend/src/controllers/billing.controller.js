import { publicCatalogue } from "../config/plans.js";
import { getEntitlement } from "../services/entitlement.service.js";
import { getUsage } from "../services/aiQuota.service.js";

/**
 * @name getPlansController
 * @description The plan catalogue for the pricing page: prices in paise,
 *              limits, features and whether each plan can be bought yet.
 * @access public
 */
function getPlansController(req, res) {
  res.set("Cache-Control", "public, max-age=300");
  return res.status(200).json({ plans: publicCatalogue() });
}

/**
 * @name getMyBillingController
 * @description The signed-in user's plan, subscription state, billing period
 *              and usage of both kinds of AI call.
 * @access private
 */
async function getMyBillingController(req, res) {
  try {
    const entitlement = await getEntitlement(req.user);
    const [report, review] = await Promise.all([
      getUsage(req.user.id, "report", entitlement),
      getUsage(req.user.id, "review", entitlement)
    ]);

    return res.status(200).json({
      plan: { id: entitlement.plan.id, name: entitlement.plan.name },
      source: entitlement.source,
      status: entitlement.status,
      cancelAtPeriodEnd: entitlement.cancelAtPeriodEnd,
      period: {
        start: entitlement.periodStart.toISOString(),
        end: entitlement.periodEnd.toISOString()
      },
      usage: { report, review }
    });
  } catch (err) {
    console.error("getMyBilling failed:", err.message);
    return res.status(500).json({ message: "Failed to load billing details", error: err.message });
  }
}

export default { getPlansController, getMyBillingController };
