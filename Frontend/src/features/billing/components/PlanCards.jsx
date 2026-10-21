import { Link } from "react-router-dom";
import { formatPrice, planAction } from "../billing.utils";

// The highlighted card: what most people who pay should pick.
const FEATURED = "pro";

const PlanButton = ({ plan, action }) => {
  if (action === "current") return <span className="plan-card__current">Your plan</span>;
  if (action === "start") return <Link className="button secondary-button" to="/register">Start free</Link>;
  if (action === "downgrade") return <span className="plan-card__note">Included in your plan</span>;
  if (!plan.purchasable) {
    return (
      <button className="button primary-button" disabled title="Payments open soon">
        Coming soon
      </button>
    );
  }
  // Signed out: an account first. Checkout itself arrives with the payment step.
  return action === "choose" ? (
    <Link className="button primary-button" to="/register">Choose {plan.name}</Link>
  ) : (
    <button className="button primary-button" disabled>Upgrade to {plan.name}</button>
  );
};

/** Free / Pro / Premium side by side. currentPlanId is null when signed out. */
const PlanCards = ({ plans, currentPlanId = null }) => (
  <div className="plan-cards">
    {plans.map((plan) => {
      const action = planAction(plan.id, currentPlanId);
      const featured = plan.id === FEATURED;
      return (
        <article
          key={plan.id}
          className={`plan-card ${featured ? "plan-card--featured" : ""} ${action === "current" ? "plan-card--current" : ""}`}
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
            <PlanButton plan={plan} action={action} />
          </div>
        </article>
      );
    })}
  </div>
);

export default PlanCards;
