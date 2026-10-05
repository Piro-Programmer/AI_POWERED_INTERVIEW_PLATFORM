import { describe, expect, it } from "vitest";
import { cleanTitle, firstLine, planDone, planStatus } from "./history.utils";

describe("history utils", () => {
  it("cleanTitle strips the stored prefix", () => {
    expect(cleanTitle("Interview Report - Backend Developer")).toBe("Backend Developer");
    expect(cleanTitle("")).toBe("Interview report");
  });

  it("firstLine skips blank lines", () => {
    expect(firstLine("\n\n  We're hiring  \nmore")).toBe("We're hiring");
  });

  it("planStatus classifies progress", () => {
    expect(planStatus(0, 10)).toBe("not-started");
    expect(planStatus(4, 10)).toBe("in-progress");
    expect(planStatus(10, 10)).toBe("done");
    expect(planStatus(0, 0)).toBe("not-started");
  });

  it("planDone reads this browser's ticks and survives bad data", () => {
    localStorage.setItem("plan:abc", JSON.stringify(["0-0", "1-1"]));
    expect(planDone("abc")).toBe(2);
    localStorage.setItem("plan:bad", "{not json");
    expect(planDone("bad")).toBe(0);
    expect(planDone("missing")).toBe(0);
  });
});
