import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import Pricing from "./pages/Pricing";
import Billing from "./pages/Billing";
import PlanSummary from "./components/PlanSummary";
import UpgradeNudge from "./components/UpgradeNudge";
import * as billingApi from "./services/billing.api";
import { loadRazorpay } from "./loadRazorpay";
import { renderWithApp } from "../../test/renderWithApp";

vi.mock("./services/billing.api", () => ({
  getPlans: vi.fn(),
  getMyBilling: vi.fn(),
  subscribe: vi.fn(),
  verifyPayment: vi.fn(),
  cancelSubscription: vi.fn(),
  resumeSubscription: vi.fn(),
  changePlan: vi.fn(),
  getInvoices: vi.fn()
}));
vi.mock("./loadRazorpay", () => ({ loadRazorpay: vi.fn() }));

const plan = (id, name, priceInPaise, report, review, purchasable = false) => ({
  id,
  name,
  priceInPaise,
  currency: "INR",
  interval: "monthly",
  features: [`${report[1]} interview reports a month`],
  limits: { report: { daily: report[0], monthly: report[1] }, review: { daily: review[0], monthly: review[1] } },
  purchasable
});

const catalogue = (purchasable = false) => [
  plan("free", "Free", 0, [2, 5], [10, 30]),
  plan("pro", "Pro", 29900, [10, 60], [60, 400], purchasable),
  plan("premium", "Premium", 69900, [25, 200], [150, 1500], purchasable)
];

const counter = (used, limit) => ({ used, limit, remaining: Math.max(0, limit - used), resetsAt: "2026-11-01T00:00:00.000Z" });
const myBilling = (planId = "free", fields = {}) => ({
  plan: { id: planId, name: { free: "Free", pro: "Pro", premium: "Premium" }[planId] },
  source: planId === "free" ? "free" : "subscription",
  status: planId === "free" ? null : "active",
  cancelAtPeriodEnd: false,
  scheduledPlan: null,
  period: { start: "2026-10-01T00:00:00.000Z", end: "2026-11-01T00:00:00.000Z" },
  usage: {
    report: { daily: counter(1, 2), monthly: counter(5, 5) },
    review: { daily: counter(0, 10), monthly: counter(3, 30) }
  },
  ...fields
});

const httpError = (status, data) => Object.assign(new Error(`HTTP ${status}`), { response: { status, data } });
const USER = { username: "asha", email: "asha@example.test" };

const card = (name) => screen.getByRole("article", { name });
const findCard = (name) => screen.findByRole("article", { name });

// A stand-in for Razorpay Checkout: records its options; tests play the user.
let razorpay;
class FakeRazorpay {
  constructor(options) {
    this.options = options;
    this.handlers = {};
    razorpay = this;
  }
  on(event, fn) {
    this.handlers[event] = fn;
  }
  open() {
    this.opened = true;
  }
}

beforeEach(() => {
  vi.mocked(billingApi.getPlans).mockResolvedValue({ plans: catalogue() });
  vi.mocked(billingApi.getMyBilling).mockResolvedValue(myBilling());
  vi.mocked(billingApi.getInvoices).mockResolvedValue({ invoices: [] });
  vi.mocked(loadRazorpay).mockResolvedValue(FakeRazorpay);
  vi.spyOn(window, "confirm").mockReturnValue(true);
  razorpay = null;
});

afterEach(() => {
  vi.clearAllMocks();
  vi.restoreAllMocks();
});

describe("Pricing page", () => {
  it("shows every plan with its price, and sign-up buttons when signed out", async () => {
    renderWithApp(<Pricing />, { path: "/pricing" });

    expect(within(await findCard("Pro")).getByText("₹299")).toBeInTheDocument();
    expect(within(card("Premium")).getByText("₹699")).toBeInTheDocument();
    expect(within(card("Free")).getByRole("link", { name: "Start free" })).toHaveAttribute("href", "/register");
    expect(billingApi.getMyBilling).not.toHaveBeenCalled();
  });

  it("says paid plans aren't on sale yet while payments are off", async () => {
    renderWithApp(<Pricing />, { path: "/pricing" });

    expect(await screen.findByText(/Paid plans open soon/)).toBeInTheDocument();
    expect(within(card("Pro")).getByRole("button", { name: "Coming soon" })).toBeDisabled();
  });

  it("marks a subscriber's plan and sends them to Billing to drop to Free", async () => {
    vi.mocked(billingApi.getMyBilling).mockResolvedValue(myBilling("pro"));
    renderWithApp(<Pricing />, { path: "/pricing", user: USER });

    expect(await within(await findCard("Pro")).findByText("Your plan")).toBeInTheDocument();
    expect(within(card("Free")).getByRole("link", { name: "Cancel from Billing" })).toHaveAttribute("href", "/billing");
  });

  it("compares the limits in a table", async () => {
    renderWithApp(<Pricing />, { path: "/pricing" });

    const row = (await screen.findByRole("rowheader", { name: "Interview reports a month" })).closest("tr");
    expect(within(row).getAllByRole("cell").map((c) => c.textContent)).toEqual(["5", "60", "200"]);
  });

  it("says so when the plans can't be loaded", async () => {
    vi.mocked(billingApi.getPlans).mockRejectedValue(new Error("offline"));
    renderWithApp(<Pricing />, { path: "/pricing" });

    expect(await screen.findByRole("alert")).toHaveTextContent(/Couldn't load the plans/);
  });
});

describe("checkout from Free", () => {
  beforeEach(() => {
    vi.mocked(billingApi.getPlans).mockResolvedValue({ plans: catalogue(true) });
  });

  it("opens Razorpay for the subscription, verifies the payment, then goes to Billing", async () => {
    vi.mocked(billingApi.subscribe).mockResolvedValue({ subscriptionId: "sub_123", keyId: "rzp_test_key" });
    vi.mocked(billingApi.verifyPayment).mockResolvedValue({ status: "authenticated", plan: "pro" });
    renderWithApp(<Pricing />, { path: "/pricing", user: USER });

    await userEvent.click(await within(await findCard("Pro")).findByRole("button", { name: "Upgrade to Pro" }));

    expect(billingApi.subscribe).toHaveBeenCalledWith("pro");
    expect(razorpay.opened).toBe(true);
    expect(razorpay.options).toMatchObject({
      key: "rzp_test_key",
      subscription_id: "sub_123",
      prefill: { name: "asha", email: "asha@example.test" }
    });

    const paid = { razorpay_payment_id: "pay_1", razorpay_subscription_id: "sub_123", razorpay_signature: "sig" };
    await razorpay.options.handler(paid);

    expect(billingApi.verifyPayment).toHaveBeenCalledWith(paid);
    expect(await screen.findByText("navigated away")).toBeInTheDocument();
  });

  it("closing the payment window is not an error", async () => {
    vi.mocked(billingApi.subscribe).mockResolvedValue({ subscriptionId: "sub_123", keyId: "k" });
    renderWithApp(<Pricing />, { path: "/pricing", user: USER });

    const button = await within(await findCard("Pro")).findByRole("button", { name: "Upgrade to Pro" });
    await userEvent.click(button);
    razorpay.options.modal.ondismiss();

    expect(await within(card("Pro")).findByRole("button", { name: "Upgrade to Pro" })).toBeEnabled();
    expect(screen.queryByRole("alert")).toBeNull();
  });

  it("shows a failed payment", async () => {
    vi.mocked(billingApi.subscribe).mockResolvedValue({ subscriptionId: "sub_123", keyId: "k" });
    renderWithApp(<Pricing />, { path: "/pricing", user: USER });

    await userEvent.click(await within(await findCard("Pro")).findByRole("button", { name: "Upgrade to Pro" }));
    razorpay.handlers["payment.failed"]({ error: { description: "Your bank declined the payment." } });

    expect(await screen.findByRole("alert")).toHaveTextContent("Your bank declined the payment.");
  });

  it.each([
    [503, { code: "BILLING_DISABLED", message: "Payments aren't available right now." }, /Payments aren't open yet/],
    [409, { message: "You already have a plan. Change it from your billing page instead." }, /already have a plan/],
    [429, { message: "Too many billing requests. Try again in 5 minutes." }, /Try again in 5 minutes/]
  ])("explains a %s from the server", async (status, data, expected) => {
    vi.mocked(billingApi.subscribe).mockRejectedValue(httpError(status, data));
    renderWithApp(<Pricing />, { path: "/pricing", user: USER });

    await userEvent.click(await within(await findCard("Pro")).findByRole("button", { name: "Upgrade to Pro" }));

    expect(await screen.findByRole("alert")).toHaveTextContent(expected);
    expect(razorpay?.opened).toBeFalsy();
  });
});

describe("plan change from Pricing", () => {
  it("upgrades a subscriber in place, without a new checkout", async () => {
    vi.mocked(billingApi.getPlans).mockResolvedValue({ plans: catalogue(true) });
    vi.mocked(billingApi.getMyBilling).mockResolvedValue(myBilling("pro"));
    vi.mocked(billingApi.changePlan).mockResolvedValue({ plan: "premium", scheduledPlan: null, effective: "now" });
    renderWithApp(<Pricing />, { path: "/pricing", user: USER });

    await userEvent.click(await within(await findCard("Premium")).findByRole("button", { name: "Upgrade to Premium" }));

    expect(billingApi.changePlan).toHaveBeenCalledWith("premium");
    expect(billingApi.subscribe).not.toHaveBeenCalled();
    expect(await screen.findByText("navigated away")).toBeInTheDocument();
  });
});

describe("Billing page", () => {
  const renderBilling = () => renderWithApp(<Billing />, { path: "/billing", user: USER });

  it("lets an active subscriber cancel at the end of the period", async () => {
    vi.mocked(billingApi.getMyBilling).mockResolvedValue(myBilling("pro"));
    vi.mocked(billingApi.getPlans).mockResolvedValue({ plans: catalogue(true) });
    vi.mocked(billingApi.cancelSubscription).mockResolvedValue({ cancelAtPeriodEnd: true });
    renderBilling();

    expect(await screen.findByText(/^Renews on /)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Upgrade to Premium" })).toBeInTheDocument();

    vi.mocked(billingApi.getMyBilling).mockResolvedValue(myBilling("pro", { status: "active", cancelAtPeriodEnd: true }));
    await userEvent.click(screen.getByRole("button", { name: "Cancel subscription" }));

    expect(billingApi.cancelSubscription).toHaveBeenCalled();
    expect(await screen.findByRole("status")).toHaveTextContent(/Cancelled\. Nothing more will be charged/);
    expect(await screen.findByRole("button", { name: "Keep my plan" })).toBeInTheDocument();
  });

  it("does nothing when the cancel is not confirmed", async () => {
    window.confirm.mockReturnValue(false);
    vi.mocked(billingApi.getMyBilling).mockResolvedValue(myBilling("pro"));
    renderBilling();

    await userEvent.click(await screen.findByRole("button", { name: "Cancel subscription" }));
    expect(billingApi.cancelSubscription).not.toHaveBeenCalled();
  });

  it("resumes a cancelled plan", async () => {
    vi.mocked(billingApi.getMyBilling).mockResolvedValue(myBilling("pro", { cancelAtPeriodEnd: true, status: "active" }));
    vi.mocked(billingApi.resumeSubscription).mockResolvedValue({ cancelAtPeriodEnd: false });
    renderBilling();

    expect(await screen.findByText(/Cancelled\. Your plan stays until/)).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Keep my plan" }));
    expect(billingApi.resumeSubscription).toHaveBeenCalled();
  });

  it("shows a scheduled downgrade and offers to stay", async () => {
    vi.mocked(billingApi.getMyBilling).mockResolvedValue(myBilling("premium", { scheduledPlan: "pro" }));
    renderBilling();

    expect(await screen.findByText(/Switches to Pro on/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Stay on Premium" })).toBeInTheDocument();
  });

  it("shows the server's reason when a change is refused", async () => {
    vi.mocked(billingApi.getMyBilling).mockResolvedValue(myBilling("pro"));
    vi.mocked(billingApi.getPlans).mockResolvedValue({ plans: catalogue(true) });
    vi.mocked(billingApi.changePlan).mockRejectedValue(httpError(409, { message: "Resume your subscription before changing plan." }));
    renderBilling();

    await userEvent.click(await screen.findByRole("button", { name: "Upgrade to Premium" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("Resume your subscription before changing plan.");
  });

  it("lists payments", async () => {
    vi.mocked(billingApi.getMyBilling).mockResolvedValue(myBilling("pro"));
    vi.mocked(billingApi.getInvoices).mockResolvedValue({
      invoices: [
        { razorpayPaymentId: "pay_1", plan: "pro", amountInPaise: 29900, currency: "INR", status: "captured", method: "upi", paidAt: "2026-10-05T10:00:00Z" }
      ]
    });
    renderBilling();

    const row = (await screen.findByRole("cell", { name: "pay_1" })).closest("tr");
    expect(within(row).getByText("₹299")).toBeInTheDocument();
    expect(within(row).getByText("UPI")).toBeInTheDocument();
    expect(within(row).getByText("captured")).toBeInTheDocument();
  });

  it("leaves out the payments list while payments are off, and offers paid plans on Free", async () => {
    vi.mocked(billingApi.getInvoices).mockRejectedValue(httpError(503, { code: "BILLING_DISABLED" }));
    renderBilling();

    expect(await screen.findByRole("link", { name: "See paid plans" })).toHaveAttribute("href", "/pricing");
    expect(screen.queryByRole("heading", { name: "Payments" })).toBeNull();
    expect(screen.queryByRole("button", { name: "Cancel subscription" })).toBeNull();
  });

  it("welcomes a new subscriber back from checkout", async () => {
    renderWithApp(<Billing />, { path: "/billing", route: { pathname: "/billing", state: { welcome: "Pro" } }, user: USER });
    expect(await screen.findByRole("status")).toHaveTextContent("Payment received. Welcome to Pro!");
  });
});

describe("PlanSummary", () => {
  it("shows the plan, this period's usage and an upgrade link on Free", async () => {
    renderWithApp(<PlanSummary />, { user: USER });

    expect(await screen.findByText("Free")).toBeInTheDocument();
    expect(screen.getByRole("progressbar", { name: "Reports this period" })).toHaveAttribute("aria-valuenow", "5");
    expect(screen.getByRole("progressbar", { name: "Reports today" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "See paid plans" })).toHaveAttribute("href", "/pricing");
  });

  it("links subscribers to their billing page", async () => {
    vi.mocked(billingApi.getMyBilling).mockResolvedValue(myBilling("pro"));
    renderWithApp(<PlanSummary />, { user: USER });

    expect(await screen.findByRole("link", { name: "Manage billing" })).toHaveAttribute("href", "/billing");
  });

  it("compact mode leaves out the daily meters", async () => {
    renderWithApp(<PlanSummary compact />, { user: USER });

    await screen.findByText("Free");
    expect(screen.queryByRole("progressbar", { name: "Reports today" })).toBeNull();
  });
});

describe("UpgradeNudge", () => {
  it("points Free users at Pro, and says nothing on Premium", () => {
    const { unmount } = renderWithApp(<UpgradeNudge usage={{ plan: "free", limitedBy: "month" }} />);
    expect(screen.getByText(/Need more this month\? Pro raises every limit/)).toBeInTheDocument();
    unmount();

    const { container } = renderWithApp(<UpgradeNudge usage={{ plan: "premium", limitedBy: "day" }} />);
    expect(container).toBeEmptyDOMElement();
  });
});
