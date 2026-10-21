import { useCallback, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../auth/hooks/useAuth";
import { loadRazorpay } from "./loadRazorpay";
import { billingError } from "./billing.utils";
import { subscribe, verifyPayment } from "./services/billing.api";

/**
 * Paid-plan checkout: the server creates the subscription, Razorpay's own
 * window takes the payment, and the server checks Razorpay's signature.
 * The plan becomes active for good when Razorpay's webhook confirms the charge.
 *
 * Returns { checkout(plan), busyPlanId, error }. On success it goes to
 * /billing, which shows the new plan.
 */
export function useCheckout() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [busyPlanId, setBusyPlanId] = useState(null);
  const [error, setError] = useState("");

  const checkout = useCallback(
    async (plan) => {
      setError("");
      setBusyPlanId(plan.id);
      try {
        const [{ subscriptionId, keyId }, Razorpay] = await Promise.all([subscribe(plan.id), loadRazorpay()]);

        await new Promise((resolve, reject) => {
          const popup = new Razorpay({
            key: keyId,
            subscription_id: subscriptionId,
            name: "Interview Lab",
            description: `${plan.name} plan, monthly`,
            prefill: { name: user?.username, email: user?.email },
            theme: { color: "#1a1712" },
            handler: (response) => verifyPayment(response).then(resolve, reject),
            modal: { ondismiss: () => reject(Object.assign(new Error("dismissed"), { dismissed: true })) }
          });
          popup.on("payment.failed", (response) =>
            reject(new Error(response?.error?.description || "The payment didn't go through."))
          );
          popup.open();
        });

        navigate("/billing", { state: { welcome: plan.name } });
      } catch (err) {
        if (!err.dismissed) setError(billingError(err, "Couldn't start the payment. Please try again."));
      } finally {
        setBusyPlanId(null);
      }
    },
    [navigate, user]
  );

  return { checkout, busyPlanId, error };
}
