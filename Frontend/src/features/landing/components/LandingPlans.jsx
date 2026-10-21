import { Link } from "react-router-dom";
import PlanCards from "../../billing/components/PlanCards";
import { usePlanPicker } from "../../billing/usePlanPicker";
import "../../billing/billing.scss";

/**
 * § 04 on the landing page: the real plan cards, with the same buttons as
 * /pricing (sign up, checkout, or a plan change). If the catalogue can't be
 * loaded it falls back to a line of text and a link, so the page never breaks.
 */
const LandingPlans = () => {
  const { plans, loadError, viewer, select, busyPlanId, actionError, anyPurchasable } = usePlanPicker();

  return (
    <section className="plans-home" id="pricing" aria-labelledby="plans-home-heading">
      <header className="section-head" data-reveal>
        <p className="eyebrow">§ 04 · Pricing</p>
        <h2 id="plans-home-heading">Free to start. More when you’re interviewing a lot.</h2>
        <p>
          Every plan gets the same reports and the same practice reviews. Pro and Premium raise the limits for weeks
          when the interviews stack up. Cancel any time.
        </p>
      </header>

      {loadError && (
        <p className="plans-home__fallback">
          Every account gets free reports and practice reviews each month.{" "}
          <Link className="text-link" to="/pricing">See the plans →</Link>
        </p>
      )}
      {!plans && !loadError && <p className="pricing__loading">fetching the price list…</p>}

      {plans && (
        <>
          {!anyPurchasable && (
            <p className="pricing__soon" role="status">
              Paid plans open soon. Everything on Free works today.
            </p>
          )}
          {actionError && <p className="billing-error" role="alert">{actionError}</p>}
          <PlanCards plans={plans} viewer={viewer} onSelect={select} busyPlanId={busyPlanId} />
          <p className="plans-home__more">
            Paid through Razorpay with UPI or cards.{" "}
            <Link className="text-link" to="/pricing#compare">Compare every limit →</Link>
          </p>
        </>
      )}
    </section>
  );
};

export default LandingPlans;
