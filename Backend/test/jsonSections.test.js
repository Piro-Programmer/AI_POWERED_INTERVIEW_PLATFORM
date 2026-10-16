import { describe, expect, it } from "vitest";
import { completedSections } from "../src/services/jsonSections.js";
import { fakeReport } from "./helpers.js";

describe("completedSections (reading a JSON answer while it streams)", () => {
  const full = JSON.stringify(fakeReport(), null, 2);

  it("returns only the fields that are complete so far, in every prefix", () => {
    const seen = new Set();
    for (let n = 0; n <= full.length; n++) {
      const sections = completedSections(full.slice(0, n));
      for (const key of Object.keys(sections)) {
        // once a field appears it is already the final value
        expect(sections[key]).toEqual(fakeReport()[key]);
        seen.add(key);
      }
    }
    expect([...seen]).toEqual(["matchScore", "technicalQuestions", "behavioralQuestions", "skillGaps", "preparationPlan"]);
  });

  it("waits for a number to be followed by something before trusting it", () => {
    expect(completedSections('{"matchScore": 7')).toEqual({});
    expect(completedSections('{"matchScore": 72,')).toEqual({ matchScore: 72 });
  });

  it("isn't fooled by brackets, quotes and escapes inside strings", () => {
    const text = '{"a": ["x ] } \\" [", {"b": "}"}], "c": "half';
    expect(completedSections(text)).toEqual({ a: ["x ] } \" [", { b: "}" }] });
  });

  it("returns nothing for text that isn't an object yet", () => {
    expect(completedSections("")).toEqual({});
    expect(completedSections("Sure! Here")).toEqual({});
    expect(completedSections('{"matchSco')).toEqual({});
  });
});
