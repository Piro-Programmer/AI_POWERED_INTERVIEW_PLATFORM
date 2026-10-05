import { describe, expect, it } from "vitest";
import { markup } from "./markup";
import { SAMPLES } from "./samples";

const marks = (result) => result.segments.filter((s) => typeof s !== "string");

describe("markup (landing demo)", () => {
  it("marks skills, people skills and recruiter phrases with the right kind", () => {
    const { tally } = markup("We want React and Node.js, someone collaborative, in a fast-paced startup.");
    expect(tally).toEqual({ skill: 2, people: 1, signal: 2 });
  });

  it("keeps the original text intact when segments are joined", () => {
    const text = SAMPLES[0].text;
    const joined = markup(text).segments.map((s) => (typeof s === "string" ? s : s.text)).join("");
    expect(joined).toBe(text);
  });

  it("respects word boundaries (no 'rest' in 'interest', no 'ai' in 'maintain')", () => {
    expect(marks(markup("We maintain interest in the rest of the team."))).toHaveLength(0);
  });

  it("matches symbols in names like Node.js and CI/CD", () => {
    const found = marks(markup("Node.js services with CI/CD")).map((m) => m.text);
    expect(found).toEqual(["Node.js", "CI/CD"]);
  });

  it("marks only the first occurrence as first and numbers it once", () => {
    const result = markup("React here, React there.");
    const [a, b] = marks(result);
    expect(a.first).toBe(true);
    expect(b.first).toBe(false);
    expect(a.n).toBe(b.n);
    expect(result.notes).toHaveLength(1);
  });

  it("caps numbered margin notes at 4 skills, 2 people and 2 signals", () => {
    const text =
      "React TypeScript Node.js GraphQL Docker AWS PostgreSQL Redis. Collaborate with stakeholders, mentor juniors, communicate well. Fast-paced startup, 5+ years, nice to have.";
    const { notes } = markup(text);
    const numbered = notes.filter((n) => n.n);
    const count = (kind) => numbered.filter((n) => n.kind === kind).length;

    expect(count("skill")).toBe(4);
    expect(count("people")).toBe(2);
    expect(count("signal")).toBe(2);
    expect(numbered.map((n) => n.n)).toEqual([1, 2, 3, 4, 5, 6, 7, 8]);
    expect(notes.length).toBeGreaterThan(numbered.length); // the rest show on hover
  });

  it("returns nothing to mark for unrelated text", () => {
    const result = markup("The quick brown fox jumps over the lazy dog.");
    expect(result.notes).toEqual([]);
    expect(result.segments).toEqual(["The quick brown fox jumps over the lazy dog."]);
  });
});
