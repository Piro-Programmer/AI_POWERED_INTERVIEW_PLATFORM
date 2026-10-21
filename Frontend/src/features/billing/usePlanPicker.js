import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../auth/hooks/useAuth";
import { billingError, isSubscriber } from "./billing.utils";
import { useCheckout } from "./useCheckout";
import { changePlan, getMyBilling, getPlans } from "./services/billing.api";

/**
 * Everything the plan cards need, wherever they're shown (the pricing page,
 * the landing page): the catalogue, who's looking, and what a click does.
 *
 * Returns { plans, loadError, viewer, select, busyPlanId, actionError, anyPurchasable }.
 * plans is null while loading. Free → paid goes through checkout; paid → paid
 * is a plan change on the existing subscription (upgrade now, downgrade at renewal).
 */
export function usePlanPicker() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [plans, setPlans] = useState(null);
  const [billing, setBilling] = useState(null);
  const [loadError, setLoadError] = useState("");
  const [changeError, setChangeError] = useState("");
  const [changingPlanId, setChangingPlanId] = useState(null);
  const { checkout, busyPlanId: checkoutPlanId, error: checkoutError } = useCheckout();

  const viewer = { currentPlanId: user ? billing?.plan.id ?? null : null, subscriber: isSubscriber(billing) };

  const select = async (plan, action) => {
    if (!viewer.subscriber) return checkout(plan);

    const question =
      action === "upgrade"
        ? `Upgrade to ${plan.name} now? Razorpay charges the difference for the rest of this period.`
        : `Switch to ${plan.name} when your current period ends?`;
    if (!window.confirm(question)) return;

    setChangeError("");
    setChangingPlanId(plan.id);
    try {
      await changePlan(plan.id);
      navigate("/billing", {
        state: { notice: action === "upgrade" ? `You're on ${plan.name} now.` : `You'll move to ${plan.name} at renewal.` }
      });
    } catch (err) {
      setChangeError(billingError(err, "Couldn't change your plan. Please try again."));
      setChangingPlanId(null);
    }
  };

  useEffect(() => {
    let cancelled = false;
    getPlans()
      .then((data) => !cancelled && setPlans(data.plans))
      .catch(() => !cancelled && setLoadError("Couldn't load the plans. Please refresh the page."));
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!user) return undefined;
    let cancelled = false;
    getMyBilling()
      .then((data) => !cancelled && setBilling(data))
      .catch(() => {}); // the cards still work without the "your plan" marker
    return () => {
      cancelled = true;
    };
  }, [user]);

  return {
    plans,
    loadError,
    viewer,
    select,
    busyPlanId: checkoutPlanId || changingPlanId,
    actionError: checkoutError || changeError,
    anyPurchasable: Boolean(plans?.some((plan) => plan.purchasable))
  };
}
