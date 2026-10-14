import { afterEach, describe, expect, it, vi } from "vitest";
import { fakeReport } from "./helpers.js";

// The real AI service, with only the Groq client replaced, so these tests see
// exactly how many provider calls the site-wide cap lets through.
const groqCreate = vi.hoisted(() => vi.fn());
vi.mock("groq-sdk", () => ({
  default: class {
    constructor() {
      this.chat = { completions: { create: groqCreate } };
    }
  }
}));

process.env.GROQ_API_KEY = "test-key"; // the AI service picks Groq at import
const { default: generateInterviewReport } = await import("../src/services/ai.service.js");
const { AiCapacityError, getGlobalUsage, takeGlobalSlot } = await import("../src/services/aiCapacity.service.js");

const reply = (content) => ({ choices: [{ message: { content } }] });
const MINUTE = 60_000;

afterEach(() => {
  delete process.env.AI_GLOBAL_PER_MINUTE;
  delete process.env.AI_GLOBAL_PER_DAY;
  groqCreate.mockReset();
});

describe("site-wide AI cap (2 requests per minute)", () => {
  it("lets exactly 2 of 5 simultaneous calls through, and opens again the next minute", async () => {
    process.env.AI_GLOBAL_PER_MINUTE = "2";
    const now = new Date("2026-10-14T10:05:20Z");

    const results = await Promise.allSettled(Array.from({ length: 5 }, () => takeGlobalSlot(now)));
    const refused = results.filter((r) => r.status === "rejected").map((r) => r.reason);
    expect(results.filter((r) => r.status === "fulfilled")).toHaveLength(2);
    expect(refused).toHaveLength(3);
    for (const err of refused) {
      expect(err).toBeInstanceOf(AiCapacityError);
      expect(err.window).toBe("minute");
      expect(err.retryAfterSeconds).toBe(40); // 10:05:20 -> 10:06:00
    }

    await expect(takeGlobalSlot(new Date(now.getTime() + MINUTE))).resolves.toBeUndefined();
  });

  it("stops at the daily cap and gives the minute slot back", async () => {
    process.env.AI_GLOBAL_PER_MINUTE = "2";
    process.env.AI_GLOBAL_PER_DAY = "3";
    const at = (minute) => new Date(Date.UTC(2026, 9, 14, 10, minute, 0));

    await takeGlobalSlot(at(0));
    await takeGlobalSlot(at(0));
    await takeGlobalSlot(at(1));

    const err = await takeGlobalSlot(at(1)).catch((e) => e);
    expect(err).toBeInstanceOf(AiCapacityError);
    expect(err.window).toBe("day");
    expect(err.message).toMatch(/today's AI capacity/);

    const usage = await getGlobalUsage(at(1));
    expect(usage.day).toEqual({ used: 3, limit: 3 });
    expect(usage.minute).toEqual({ used: 1, limit: 2 }); // refunded, not 2
  });

  it("counts every provider call, retries included, and stops retrying at the cap", async () => {
    process.env.AI_GLOBAL_PER_MINUTE = "2";
    groqCreate.mockResolvedValue(reply("not json")); // every attempt fails validation

    const err = await generateInterviewReport({ resume: "", selfDescription: "", jobDescription: "Backend role" }).catch((e) => e);

    // attempt 1 and 2 reach Groq; attempt 3 is refused before it costs a call
    expect(groqCreate).toHaveBeenCalledTimes(2);
    expect(err).toBeInstanceOf(AiCapacityError);
    expect((await getGlobalUsage()).minute.used).toBe(2);
  });

  it("a retry that succeeds within the cap still returns the report", async () => {
    process.env.AI_GLOBAL_PER_MINUTE = "2";
    groqCreate.mockResolvedValueOnce(reply("not json")).mockResolvedValueOnce(reply(JSON.stringify(fakeReport())));

    const report = await generateInterviewReport({ resume: "", selfDescription: "", jobDescription: "Backend role" });

    expect(report.technicalQuestions).toHaveLength(5);
    expect(groqCreate).toHaveBeenCalledTimes(2);
  });
});
