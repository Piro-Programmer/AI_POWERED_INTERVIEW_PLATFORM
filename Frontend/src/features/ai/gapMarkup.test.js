import { describe, expect, it } from "vitest";
import { gapMarkup, planDayFor } from "./gapMarkup";

const JD = "You'll build features in React and TypeScript, backed by a GraphQL API on PostgreSQL. Docker is a plus.";
const PLAN = [
  { day: 1, focus: "React performance", tasks: ["Profile a page", "Fix re-renders"] },
  { day: 2, focus: "Close the GraphQL gap", tasks: ["Write 3 resolvers", "Explain N+1"] }
];

describe("gapMarkup", () => {
  it("marks gaps where they appear in the job description, numbered in reading order", () => {
    const { segments, notes, unmatched } = gapMarkup(JD, [
      { skill: "Docker", severity: "low" },
      { skill: "GraphQL", severity: "high" }
    ]);

    const marked = segments.filter((s) => typeof s !== "string");
    expect(marked.map((m) => [m.text, m.kind, m.n])).toEqual([
      ["GraphQL", "gap-high", 1],
      ["Docker", "gap-low", 2]
    ]);
    expect(notes).toHaveLength(2);
    expect(unmatched).toEqual([]);
  });

  it("falls back to a word from the gap name, and drops the (aside)", () => {
    const { segments } = gapMarkup(JD, [{ skill: "Advanced PostgreSQL tuning (indexes)", severity: "medium" }]);
    expect(segments.find((s) => typeof s !== "string").text).toBe("PostgreSQL");
  });

  it("lists gaps that the posting never names", () => {
    const { unmatched, notes } = gapMarkup(JD, [{ skill: "Kubernetes", severity: "high" }]);
    expect(notes).toEqual([]);
    expect(unmatched[0]).toMatchObject({ skill: "Kubernetes", severity: "high" });
  });

  it("links a gap to the plan day that covers it", () => {
    const { notes } = gapMarkup(JD, [{ skill: "GraphQL", severity: "high" }], PLAN);
    expect(notes[0].day).toBe(2);
    expect(notes[0].text).toMatch(/Day 2 of your plan covers it/);
  });

  it("treats an unknown severity as medium", () => {
    const { notes } = gapMarkup(JD, [{ skill: "React", severity: "urgent" }]);
    expect(notes[0].kind).toBe("gap-medium");
  });

  it("doesn't mark the same words twice for overlapping gaps", () => {
    const { notes, unmatched } = gapMarkup(JD, [
      { skill: "GraphQL", severity: "high" },
      { skill: "GraphQL APIs", severity: "low" }
    ]);
    expect(notes).toHaveLength(1);
    expect(unmatched).toHaveLength(1);
  });
});

describe("planDayFor", () => {
  it("returns null when no day mentions the skill", () => {
    expect(planDayFor("Kubernetes", PLAN)).toBeNull();
  });
});
