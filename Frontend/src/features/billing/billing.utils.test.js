import { describe, expect, it } from "vitest";
import { formatPrice, percentUsed, planAction, statusLine } from "./billing.utils";

const billing = (fields) => ({
  plan: { id: "pro", name: "Pro" },
  source: "subscription",
  status: "active",
  cancelAtPeriodEnd: false,
  period: { start: "2026-10-05T00:00:00.000Z", end: "2026-11-05T00:00:00.000Z" },
  ...fields
});

describe("formatPrice", () => {
  it("shows whole rupees from paise", () => {
    expect(formatPrice(29900)).toBe("₹299");
    expect(formatPrice(0)).toBe("₹0");
    expect(formatPrice(149900)).toBe("₹1,499");
  });
});

describe("percentUsed", () => {
  it("rounds and caps at 100", () => {
    expect(percentUsed({ used: 1, limit: 3 })).toBe(33);
    expect(percentUsed({ used: 9, limit: 5 })).toBe(100);
    expect(percentUsed({ used: 0, limit: 0 })).toBe(0);
  });
});

describe("planAction", () => {
  it("signed out: start free, choose paid", () => {
    expect(planAction("free", null)).toBe("start");
    expect(planAction("pro", null)).toBe("choose");
  });

  it("signed in: current, upgrade or downgrade", () => {
    expect(planAction("pro", "pro")).toBe("current");
    expect(planAction("premium", "pro")).toBe("upgrade");
    expect(planAction("free", "pro")).toBe("downgrade");
  });
});

describe("statusLine", () => {
  it("is quiet for a plain Free account", () => {
    expect(statusLine(billing({ plan: { id: "free" }, source: "free", status: null }))).toBeNull();
  });

  it("names the renewal date for an active plan", () => {
    expect(statusLine(billing())).toMatch(/^Renews on /);
  });

  it("explains a pending cancel and a failed renewal", () => {
    expect(statusLine(billing({ status: "cancelled", cancelAtPeriodEnd: true }))).toMatch(/Cancelled\. Your plan stays until/);
    expect(statusLine(billing({ status: "pending" }))).toMatch(/renewal payment failed/);
    expect(statusLine(billing({ source: "free", status: "halted" }))).toMatch(/back on Free/);
  });
});
