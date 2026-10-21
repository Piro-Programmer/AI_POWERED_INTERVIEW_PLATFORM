import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../../auth/hooks/useAuth";
import Wordmark from "../../../components/Wordmark";
import PlanCards from "../components/PlanCards";
import { billingError, isSubscriber } from "../billing.utils";
import { useCheckout } from "../useCheckout";
import { changePlan, getMyBilling, getPlans } from "../services/billing.api";
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
  const navigate = useNavigate();
  const [plans, setPlans] = useState(null);
  const [billing, setBilling] = useState(null);
  const [error, setError] = useState("");
  const [changeError, setChangeError] = useState("");
  const [changingPlanId, setChangingPlanId] = useState(null);
  const { checkout, busyPlanId: checkoutPlanId, error: checkoutError } = useCheckout();

  const viewer = { currentPlanId: user ? billing?.plan.id ?? null : null, subscriber: isSubscriber(billing) };

  // Free → paid goes through checkout; paid → paid is a plan change on the
  // existing subscription (upgrade now, downgrade at renewal).
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
      .catch(() => !cancelled && setError("Couldn't load the plans. Please refresh the page."));
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
            {(checkoutError || changeError) && (
              <p className="billing-error" role="alert">{checkoutError || changeError}</p>
            )}
            <PlanCards
              plans={plans}
              viewer={viewer}
              onSelect={select}
              busyPlanId={checkoutPlanId || changingPlanId}
            />

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
