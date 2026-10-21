import { useCallback, useEffect, useState } from "react";
import { Link, useLocation } from "react-router-dom";
import AppSidebar from "../../../components/AppSidebar";
import PlanSummary from "../components/PlanSummary";
import { billingError, formatDate, formatPrice, isSubscriber, planName } from "../billing.utils";
import {
  cancelSubscription,
  changePlan,
  getInvoices,
  getMyBilling,
  getPlans,
  resumeSubscription
} from "../services/billing.api";
import "../billing.scss";

const ORDER = ["pro", "premium"];

const Invoices = ({ invoices }) => {
  if (invoices === null) return null; // payments are off: nothing to list
  return (
    <section className="invoices" aria-labelledby="invoices-heading">
      <h3 id="invoices-heading">Payments</h3>
      {invoices.length === 0 ? (
        <p className="invoices__empty">No payments yet.</p>
      ) : (
        <div className="compare__scroll">
          <table>
            <thead>
              <tr>
                <th scope="col">Date</th>
                <th scope="col">Plan</th>
                <th scope="col">Amount</th>
                <th scope="col">Method</th>
                <th scope="col">Status</th>
                <th scope="col">Payment id</th>
              </tr>
            </thead>
            <tbody>
              {invoices.map((invoice) => (
                <tr key={invoice.razorpayPaymentId}>
                  <td>{formatDate(invoice.paidAt || invoice.createdAt)}</td>
                  <td>{invoice.plan ? planName(invoice.plan) : "—"}</td>
                  <td>{formatPrice(invoice.amountInPaise, invoice.currency || "INR")}</td>
                  <td>{invoice.method ? invoice.method.toUpperCase() : "—"}</td>
                  <td>
                    <span className={`invoice-status invoice-status--${invoice.status}`}>{invoice.status}</span>
                  </td>
                  <td className="invoices__id">{invoice.razorpayPaymentId}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
};

/** /billing: plan, usage, cancel / resume / change plan, and payments. */
const Billing = () => {
  const location = useLocation();
  const [billing, setBilling] = useState(null);
  const [plans, setPlans] = useState([]);
  const [invoices, setInvoices] = useState(null);
  const [loadError, setLoadError] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const welcome = location.state?.welcome;
  const [notice, setNotice] = useState(
    welcome ? `Payment received. Welcome to ${welcome}!` : location.state?.notice || ""
  );

  const load = useCallback(async () => {
    try {
      const [me, catalogue] = await Promise.all([getMyBilling(), getPlans()]);
      setBilling(me);
      setPlans(catalogue.plans);
      setLoadError("");
    } catch {
      setLoadError("Couldn't load your billing details. The server may still be waking up.");
    }
    // payments off (503) or failing: the rest of the page still works
    getInvoices()
      .then((data) => setInvoices(data.invoices))
      .catch(() => setInvoices(null));
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const run = async (action, done) => {
    setBusy(true);
    setError("");
    setNotice("");
    try {
      await action();
      setNotice(done);
      await load();
    } catch (err) {
      setError(billingError(err, "That didn't work. Please try again."));
    } finally {
      setBusy(false);
    }
  };

  const cancel = () => {
    if (!window.confirm("Cancel your subscription? You keep your plan until the end of this period.")) return;
    run(cancelSubscription, "Cancelled. Nothing more will be charged.");
  };
  const resume = () => run(resumeSubscription, "Your plan carries on as before.");
  const switchTo = (plan) => {
    const upgrade = ORDER.indexOf(plan.id) > ORDER.indexOf(billing.plan.id);
    const question = upgrade
      ? `Upgrade to ${plan.name} now? Razorpay charges the difference for the rest of this period.`
      : `Switch to ${plan.name} when your current period ends?`;
    if (!window.confirm(question)) return;
    run(() => changePlan(plan.id), upgrade ? `You're on ${plan.name} now.` : `You'll move to ${plan.name} at renewal.`);
  };

  const subscriber = isSubscriber(billing);
  const running = subscriber && ["authenticated", "active"].includes(billing.status);
  const otherPaid = plans.filter((plan) => plan.id !== "free" && plan.id !== billing?.plan.id && plan.purchasable);

  const actions = subscriber && (
    <div className="billing-actions">
      {billing.cancelAtPeriodEnd || billing.scheduledPlan ? (
        <button type="button" className="button primary-button" disabled={busy} onClick={resume}>
          {billing.cancelAtPeriodEnd ? "Keep my plan" : `Stay on ${billing.plan.name}`}
        </button>
      ) : (
        running && (
          <>
            {otherPaid.map((plan) => (
              <button
                key={plan.id}
                type="button"
                className="button secondary-button"
                disabled={busy}
                onClick={() => switchTo(plan)}
              >
                {ORDER.indexOf(plan.id) > ORDER.indexOf(billing.plan.id) ? `Upgrade to ${plan.name}` : `Switch to ${plan.name}`}
              </button>
            ))}
            <button type="button" className="button danger-button" disabled={busy} onClick={cancel}>
              Cancel subscription
            </button>
          </>
        )
      )}
    </div>
  );

  return (
    <main className="workspace-page">
      <AppSidebar />

      <section className="workspace-main">
        <header className="workspace-hero">
          <p className="eyebrow">Billing</p>
          <h2>Your plan and payments</h2>
          <p>
            Change or cancel any time. <Link className="text-link" to="/pricing">Compare plans →</Link>
          </p>
        </header>

        {notice && <p className="billing-ok" role="status">{notice}</p>}
        {(error || loadError) && <p className="billing-error" role="alert">{error || loadError}</p>}

        {billing && <PlanSummary billing={billing} actions={subscriber ? actions : undefined} />}
        {!billing && !loadError && <PlanSummary billing={null} />}

        <Invoices invoices={invoices} />
      </section>
    </main>
  );
};

export default Billing;
