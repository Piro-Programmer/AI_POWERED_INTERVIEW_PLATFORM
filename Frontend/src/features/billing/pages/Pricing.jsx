import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../../auth/hooks/useAuth";
import Wordmark from "../../../components/Wordmark";
import PlanCards from "../components/PlanCards";
import { getMyBilling, getPlans } from "../services/billing.api";
import "../../landing/landing.scss";
import "../billing.scss";

const LIMIT_ROWS = [
  ["Interview reports a month", (l) => l.report.monthly],
  ["Interview reports a day", (l) => l.report.daily],
  ["AI answer reviews a month", (l) => l.review.monthly],
  ["AI answer reviews a day", (l) => l.review.daily]
];

const FAQ = [
  [
    "What counts as a report?",
    "One generated interview report: questions, gaps and a five-day plan for one job description. A report that fails to generate isn't counted."
  ],
  [
    "Why a daily limit as well as a monthly one?",
    "It keeps the service fast for everyone. The daily cap resets at midnight UTC; the monthly allowance resets on your billing date (on Free, on the 1st)."
  ],
  [
    "Can I cancel any time?",
    "Yes. You keep your plan until the end of the period you paid for, then move to Free. Your reports stay in your account."
  ],
  [
    "How do I pay?",
    "Cards and UPI, through Razorpay. Your card details never reach our servers."
  ]
];

const Pricing = () => {
  const { user } = useAuth();
  const [plans, setPlans] = useState(null);
  const [currentPlanId, setCurrentPlanId] = useState(null);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;
    getPlans()
      .then((data) => !cancelled && setPlans(data.plans))
      .catch(() => !cancelled && setError("Couldn't load the plans. Please refresh the page."));
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!user) return undefined;
    let cancelled = false;
    getMyBilling()
      .then((data) => !cancelled && setCurrentPlanId(data.plan.id))
      .catch(() => {}); // the cards still work without the "your plan" marker
    return () => {
      cancelled = true;
    };
  }, [user]);

  const anyPurchasable = plans?.some((plan) => plan.purchasable);

  return (
    <div className="landing pricing-page">
      <header className="topbar">
        <Wordmark />
        <nav className="topbar__nav" aria-label="Sections">
          <Link to="/">Home</Link>
          <a href="#compare">Compare</a>
          <a href="#faq">Questions</a>
        </nav>
        <div className="topbar__actions">
          {user ? (
            <Link className="button primary-button" to="/dashboard">Open your desk</Link>
          ) : (
            <>
              <Link className="topbar__signin" to="/login">Sign in</Link>
              <Link className="button primary-button" to="/register">Create account</Link>
            </>
          )}
        </div>
      </header>

      <main className="pricing">
        <header className="section-head pricing__head">
          <p className="eyebrow">Plans</p>
          <h1>
            Start free. Pay when you’re <span className="hl">interviewing a lot.</span>
          </h1>
          <p>
            Every plan gets the same reports and the same practice reviews. Paid plans just give you more of them.
          </p>
        </header>

        {error && <p className="billing-error" role="alert">{error}</p>}
        {!plans && !error && <p className="pricing__loading">fetching the price list…</p>}

        {plans && (
          <>
            {!anyPurchasable && (
              <p className="pricing__soon" role="status">
                Paid plans open soon. Everything on Free works today.
              </p>
            )}
            <PlanCards plans={plans} currentPlanId={user ? currentPlanId : null} />

            <section className="compare" id="compare" aria-labelledby="compare-heading">
              <h2 id="compare-heading">Side by side</h2>
              <div className="compare__scroll">
                <table>
                  <thead>
                    <tr>
                      <th scope="col"><span className="sr-only">Limit</span></th>
                      {plans.map((plan) => (
                        <th scope="col" key={plan.id}>{plan.name}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {LIMIT_ROWS.map(([label, pick]) => (
                      <tr key={label}>
                        <th scope="row">{label}</th>
                        {plans.map((plan) => (
                          <td key={plan.id}>{pick(plan.limits).toLocaleString("en-IN")}</td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          </>
        )}

        <section className="faq" id="faq" aria-labelledby="faq-heading">
          <h2 id="faq-heading">Questions</h2>
          <dl>
            {FAQ.map(([q, a]) => (
              <div key={q}>
                <dt>{q}</dt>
                <dd>{a}</dd>
              </div>
            ))}
          </dl>
        </section>
      </main>

      <footer className="footer">
        <Wordmark />
        <Link className="text-link" to="/">Home</Link>
        <Link className="text-link" to="/privacy">Privacy</Link>
      </footer>
    </div>
  );
};

export default Pricing;
