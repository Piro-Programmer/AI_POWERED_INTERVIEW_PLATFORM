import { beforeEach, describe, expect, it, vi } from "vitest";
import { screen, within } from "@testing-library/react";
import Pricing from "./pages/Pricing";
import PlanSummary from "./components/PlanSummary";
import UpgradeNudge from "./components/UpgradeNudge";
import { getMyBilling, getPlans } from "./services/billing.api";
import { renderWithApp } from "../../test/renderWithApp";

vi.mock("./services/billing.api", () => ({ getPlans: vi.fn(), getMyBilling: vi.fn() }));

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

const PLANS = [
  plan("free", "Free", 0, [2, 5], [10, 30]),
  plan("pro", "Pro", 29900, [10, 60], [60, 400]),
  plan("premium", "Premium", 69900, [25, 200], [150, 1500])
];

const counter = (used, limit) => ({ used, limit, remaining: Math.max(0, limit - used), resetsAt: "2026-11-01T00:00:00.000Z" });
const myBilling = (planId = "free", name = "Free") => ({
  plan: { id: planId, name },
  source: planId === "free" ? "free" : "subscription",
  status: planId === "free" ? null : "active",
  cancelAtPeriodEnd: false,
  period: { start: "2026-10-01T00:00:00.000Z", end: "2026-11-01T00:00:00.000Z" },
  usage: {
    report: { daily: counter(1, 2), monthly: counter(5, 5) },
    review: { daily: counter(0, 10), monthly: counter(3, 30) }
  }
});

const card = (name) => screen.getByRole("article", { name });
const findCard = (name) => screen.findByRole("article", { name });

beforeEach(() => {
  getPlans.mockReset().mockResolvedValue({ plans: PLANS });
  getMyBilling.mockReset().mockResolvedValue(myBilling());
});

describe("Pricing page", () => {
  it("shows every plan with its price, and sign-up buttons when signed out", async () => {
    renderWithApp(<Pricing />, { path: "/pricing" });

    expect(within(await findCard("Pro")).getByText("₹299")).toBeInTheDocument();
    expect(within(card("Premium")).getByText("₹699")).toBeInTheDocument();
    expect(within(card("Free")).getByRole("link", { name: "Start free" })).toHaveAttribute("href", "/register");
    expect(getMyBilling).not.toHaveBeenCalled();
  });

  it("says paid plans aren't on sale yet while payments are off", async () => {
    renderWithApp(<Pricing />, { path: "/pricing" });

    expect(await screen.findByText(/Paid plans open soon/)).toBeInTheDocument();
    expect(within(card("Pro")).getByRole("button", { name: "Coming soon" })).toBeDisabled();
  });

  it("marks the signed-in user's plan", async () => {
    getMyBilling.mockResolvedValue(myBilling("pro", "Pro"));
    renderWithApp(<Pricing />, { path: "/pricing", user: { username: "asha" } });

    expect(await within(await findCard("Pro")).findByText("Your plan")).toBeInTheDocument();
    expect(within(card("Free")).getByText("Included in your plan")).toBeInTheDocument();
  });

  it("compares the limits in a table", async () => {
    renderWithApp(<Pricing />, { path: "/pricing" });

    const row = (await screen.findByRole("rowheader", { name: "Interview reports a month" })).closest("tr");
    expect(within(row).getAllByRole("cell").map((c) => c.textContent)).toEqual(["5", "60", "200"]);
  });

  it("says so when the plans can't be loaded", async () => {
    getPlans.mockRejectedValue(new Error("offline"));
    renderWithApp(<Pricing />, { path: "/pricing" });

    expect(await screen.findByRole("alert")).toHaveTextContent(/Couldn't load the plans/);
  });
});

describe("PlanSummary", () => {
  it("shows the plan, this period's usage and an upgrade link on Free", async () => {
    renderWithApp(<PlanSummary />, { user: { username: "asha" } });

    expect(await screen.findByText("Free")).toBeInTheDocument();
    expect(screen.getByRole("progressbar", { name: "Reports this period" })).toHaveAttribute("aria-valuenow", "5");
    expect(screen.getByRole("progressbar", { name: "Reports today" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "See paid plans" })).toHaveAttribute("href", "/pricing");
  });

  it("compact mode leaves out the daily meters", async () => {
    renderWithApp(<PlanSummary compact />, { user: { username: "asha" } });

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
