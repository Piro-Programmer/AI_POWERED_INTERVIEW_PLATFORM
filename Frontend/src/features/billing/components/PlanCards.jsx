import { Link } from "react-router-dom";
import { formatPrice, planAction } from "../billing.utils";

// The highlighted card: what most people who pay should pick.
const FEATURED = "pro";

const ComingSoon = () => (
  <button className="button primary-button" disabled title="Payments open soon">
    Coming soon
  </button>
);

/**
 * The button (or note) at the foot of one card.
 *   viewer: { currentPlanId, subscriber } — currentPlanId is null when signed out
 *   onSelect(plan, action): checkout from Free, or a plan change for subscribers
 */
const PlanButton = ({ plan, viewer, onSelect, busyPlanId }) => {
  const action = planAction(plan.id, viewer.currentPlanId);
  const busy = busyPlanId === plan.id;

  if (action === "current") return <span className="plan-card__current">Your plan</span>;
  if (action === "start") return <Link className="button secondary-button" to="/register">Start free</Link>;

  if (plan.id === "free") {
    // dropping to Free means cancelling, which lives on the billing page
    return viewer.subscriber ? (
      <Link className="button ghost-button" to="/billing">Cancel from Billing</Link>
    ) : (
      <span className="plan-card__note">Included in your plan</span>
    );
  }

  if (!plan.purchasable) return <ComingSoon />;
  if (action === "choose") return <Link className="button primary-button" to="/register">Choose {plan.name}</Link>;
  // paid plan below the current one, for someone who isn't paying (an admin)
  if (action === "downgrade" && !viewer.subscriber) return <span className="plan-card__note">Included in your plan</span>;

  const label =
    action === "upgrade" ? `Upgrade to ${plan.name}` : `Switch to ${plan.name} at renewal`;
  return (
    <button
      type="button"
      className={`button ${action === "upgrade" ? "primary-button" : "secondary-button"}`}
      disabled={Boolean(busyPlanId)}
      onClick={() => onSelect(plan, action)}
    >
      {busy ? (viewer.subscriber ? "Changing plan…" : "Opening checkout…") : label}
    </button>
  );
};

/** Free / Pro / Premium side by side. */
const PlanCards = ({ plans, viewer = { currentPlanId: null, subscriber: false }, onSelect, busyPlanId = null }) => (
  <div className="plan-cards">
    {plans.map((plan) => {
      const featured = plan.id === FEATURED;
      const current = plan.id === viewer.currentPlanId;
      return (
        <article
          key={plan.id}
          className={`plan-card ${featured ? "plan-card--featured" : ""} ${current ? "plan-card--current" : ""}`}
          aria-labelledby={`plan-${plan.id}`}
        >
          {featured && <span className="plan-card__flag">most picked</span>}
          <h3 id={`plan-${plan.id}`}>{plan.name}</h3>
          <p className="plan-card__price">
            <strong>{formatPrice(plan.priceInPaise, plan.currency)}</strong>
            <span>{plan.priceInPaise ? "/ month" : "forever"}</span>
          </p>
          <ul className="plan-card__features">
            {plan.features.map((feature) => (
              <li key={feature}>{feature}</li>
            ))}
            <li>
              Up to {plan.limits.report.daily} reports and {plan.limits.review.daily} reviews a day
            </li>
          </ul>
          <div className="plan-card__action">
            <PlanButton plan={plan} viewer={viewer} onSelect={onSelect} busyPlanId={busyPlanId} />
          </div>
        </article>
      );
    })}
  </div>
);

export default PlanCards;
