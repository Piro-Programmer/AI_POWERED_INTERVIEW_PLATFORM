import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { formatDay, percentUsed, statusLine } from "../billing.utils";
import { getMyBilling } from "../services/billing.api";
import "../billing.scss";

const Meter = ({ label, counter, resetsLabel }) => (
  <div className="usage-meter">
    <div className="usage-meter__head">
      <span>{label}</span>
      <strong>
        {counter.used} / {counter.limit}
      </strong>
    </div>
    <div
      className={`usage-meter__bar ${counter.remaining === 0 ? "usage-meter__bar--full" : ""}`}
      role="progressbar"
      aria-label={label}
      aria-valuemin={0}
      aria-valuemax={counter.limit}
      aria-valuenow={counter.used}
    >
      <span style={{ width: `${percentUsed(counter)}%` }} />
    </div>
    <small>{resetsLabel}</small>
  </div>
);

/**
 * The user's plan, its status, and how much of this period's (and today's)
 * allowance is used. `compact` hides the daily meters (for the dashboard).
 */
const PlanSummary = ({ compact = false }) => {
  const [billing, setBilling] = useState(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let cancelled = false;
    getMyBilling()
      .then((data) => !cancelled && setBilling(data))
      .catch(() => !cancelled && setFailed(true));
    return () => {
      cancelled = true;
    };
  }, []);

  if (failed) return null; // nice to have; the rest of the page still works
  if (!billing) return <section className="plan-summary plan-summary--loading" aria-busy="true" />;

  const { plan, usage, period } = billing;
  const status = statusLine(billing);
  const isFree = plan.id === "free";
  const monthEnd = `resets ${formatDay(period.end)}`;

  return (
    <section className="plan-summary" aria-labelledby="plan-summary-heading">
      <header className="plan-summary__head">
        <div>
          <p className="eyebrow">Your plan</p>
          <h3 id="plan-summary-heading">
            <span className={`plan-badge plan-badge--${plan.id}`}>{plan.name}</span>
          </h3>
          {status && <p className="plan-summary__status">{status}</p>}
        </div>
        <Link className={`button ${isFree ? "primary-button" : "secondary-button"}`} to="/pricing">
          {isFree ? "See paid plans" : "Compare plans"}
        </Link>
      </header>

      <div className="plan-summary__meters">
        <Meter label="Reports this period" counter={usage.report.monthly} resetsLabel={monthEnd} />
        <Meter label="Answer reviews this period" counter={usage.review.monthly} resetsLabel={monthEnd} />
        {!compact && (
          <>
            <Meter label="Reports today" counter={usage.report.daily} resetsLabel="resets at midnight UTC" />
            <Meter label="Answer reviews today" counter={usage.review.daily} resetsLabel="resets at midnight UTC" />
          </>
        )}
      </div>
    </section>
  );
};

export default PlanSummary;
