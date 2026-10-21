import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import LandingPlans from "./components/LandingPlans";
import * as billingApi from "../billing/services/billing.api";
import { loadRazorpay } from "../billing/loadRazorpay";
import { renderWithApp } from "../../test/renderWithApp";

vi.mock("../billing/services/billing.api", () => ({
  getPlans: vi.fn(),
  getMyBilling: vi.fn(),
  subscribe: vi.fn(),
  verifyPayment: vi.fn(),
  changePlan: vi.fn()
}));
vi.mock("../billing/loadRazorpay", () => ({ loadRazorpay: vi.fn() }));

const plan = (id, name, priceInPaise, purchasable) => ({
  id,
  name,
  priceInPaise,
  currency: "INR",
  interval: "monthly",
  features: [`${name} features`],
  limits: { report: { daily: 2, monthly: 5 }, review: { daily: 10, monthly: 30 } },
  purchasable
});
const catalogue = (purchasable = true) => [
  plan("free", "Free", 0, false),
  plan("pro", "Pro", 29900, purchasable),
  plan("premium", "Premium", 69900, purchasable)
];
const USER = { username: "asha", email: "asha@example.test" };
const card = (name) => screen.findByRole("article", { name });

beforeEach(() => {
  vi.mocked(billingApi.getPlans).mockResolvedValue({ plans: catalogue() });
  vi.mocked(billingApi.getMyBilling).mockResolvedValue({ plan: { id: "free", name: "Free" }, source: "free" });
});

afterEach(() => {
  vi.clearAllMocks();
});

describe("pricing on the landing page", () => {
  it("shows the three plans with prices, and sends signed-out visitors to sign up", async () => {
    renderWithApp(<LandingPlans />, { path: "/" });

    expect(screen.getByRole("heading", { name: /Free to start/ })).toBeInTheDocument();
    expect(within(await card("Pro")).getByText("₹299")).toBeInTheDocument();
    expect(within(await card("Premium")).getByText("₹699")).toBeInTheDocument();
    expect(within(await card("Pro")).getByRole("link", { name: "Choose Pro" })).toHaveAttribute("href", "/register");
    expect(screen.getByRole("link", { name: "Compare every limit →" })).toHaveAttribute("href", "/pricing#compare");
    expect(billingApi.getMyBilling).not.toHaveBeenCalled();
  });

  it("opens checkout for a signed-in Free user", async () => {
    vi.mocked(billingApi.subscribe).mockResolvedValue({ subscriptionId: "sub_1", keyId: "rzp_test_key" });
    const open = vi.fn();
    vi.mocked(loadRazorpay).mockResolvedValue(
      class {
        on() {}
        open() {
          open();
        }
      }
    );
    renderWithApp(<LandingPlans />, { path: "/", user: USER });

    await userEvent.click(await within(await card("Pro")).findByRole("button", { name: "Upgrade to Pro" }));

    expect(billingApi.subscribe).toHaveBeenCalledWith("pro");
    expect(open).toHaveBeenCalled();
  });

  it("marks the signed-in user's current plan", async () => {
    renderWithApp(<LandingPlans />, { path: "/", user: USER });
    expect(await within(await card("Free")).findByText("Your plan")).toBeInTheDocument();
  });

  it("says paid plans open soon while payments are off", async () => {
    vi.mocked(billingApi.getPlans).mockResolvedValue({ plans: catalogue(false) });
    renderWithApp(<LandingPlans />, { path: "/" });

    expect(await screen.findByText(/Paid plans open soon/)).toBeInTheDocument();
  });

  it("falls back to a link when the plans can't be loaded", async () => {
    vi.mocked(billingApi.getPlans).mockRejectedValue(new Error("offline"));
    renderWithApp(<LandingPlans />, { path: "/" });

    expect(await screen.findByRole("link", { name: "See the plans →" })).toHaveAttribute("href", "/pricing");
    expect(screen.queryByRole("article")).toBeNull();
  });
});
