import { afterEach, describe, expect, it, vi } from "vitest";
import { fakeReport } from "./helpers.js";

// The real AI service with only the Groq client replaced: a fake stream that
// sends the JSON in small pieces and the token count in the last chunk.
const groqCreate = vi.hoisted(() => vi.fn());
vi.mock("groq-sdk", () => ({
  default: class {
    constructor() {
      this.chat = { completions: { create: groqCreate } };
    }
  }
}));

process.env.GROQ_API_KEY = "test-key";
const { default: generateInterviewReport } = await import("../src/services/ai.service.js");
const { getGlobalUsage } = await import("../src/services/aiCapacity.service.js");

const job = { resume: "", selfDescription: "", jobDescription: "Backend role" };

const streamOf = (json, totalTokens) =>
  (async function* () {
    for (let i = 0; i < json.length; i += 40) yield { choices: [{ delta: { content: json.slice(i, i + 40) } }] };
    yield { choices: [{ delta: {} }], x_groq: { usage: { total_tokens: totalTokens } } };
  })();

const label = (e) => (e.type === "section" ? e.key : `${e.type}:${e.attempt}`);

afterEach(() => groqCreate.mockReset());

describe("streaming a report (live progress)", () => {
  it("reports each section as it finishes, then returns the validated report", async () => {
    groqCreate.mockImplementation(async (req) => {
      expect(req.stream).toBe(true);
      return streamOf(JSON.stringify(fakeReport()), 4321);
    });
    const events = [];

    const report = await generateInterviewReport({ ...job, onProgress: (e) => events.push(e) });

    expect(report.matchScore).toBe(72);
    expect(events.map(label)).toEqual([
      "attempt:1",
      "matchScore",
      "technicalQuestions",
      "behavioralQuestions",
      "skillGaps",
      "preparationPlan"
    ]);
    expect(events.find((e) => e.key === "technicalQuestions").value).toHaveLength(5);
    expect((await getGlobalUsage()).minute.tokens).toBe(4321); // real count from the stream
  });

  it("a retry starts over, so the page can clear what it showed", async () => {
    groqCreate
      .mockImplementationOnce(async () => streamOf('{"matchScore": 72, "technicalQuestions": "oops"}', 500))
      .mockImplementationOnce(async () => streamOf(JSON.stringify(fakeReport()), 4000));
    const events = [];

    await generateInterviewReport({ ...job, onProgress: (e) => events.push(e) });

    expect(events.filter((e) => e.type === "attempt").map((e) => e.attempt)).toEqual([1, 2]);
    const second = events.slice(events.findIndex((e) => e.attempt === 2));
    expect(second.filter((e) => e.type === "section")).toHaveLength(5);
  });

  it("without onProgress it doesn't stream", async () => {
    groqCreate.mockImplementation(async (req) => {
      expect(req.stream).toBeUndefined();
      return { choices: [{ message: { content: JSON.stringify(fakeReport()) } }], usage: { total_tokens: 3000 } };
    });
    expect((await generateInterviewReport(job)).matchScore).toBe(72);
  });
});
