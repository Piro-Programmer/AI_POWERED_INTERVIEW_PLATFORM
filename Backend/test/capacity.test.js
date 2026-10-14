import { afterEach, describe, expect, it, vi } from "vitest";
import { fakeReport } from "./helpers.js";

// The real AI service, with only the Groq client replaced, so these tests see
// exactly how many provider calls and tokens the site-wide caps let through.
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
const { AiCapacityError, getGlobalUsage, settleGlobalSlot, takeGlobalSlot } = await import(
  "../src/services/aiCapacity.service.js"
);

const reply = (content, totalTokens = 3000) => ({ choices: [{ message: { content } }], usage: { total_tokens: totalTokens } });
const job = { resume: "", selfDescription: "", jobDescription: "Backend role" };
const MINUTE = 60_000;

afterEach(() => {
  for (const name of ["PER_MINUTE", "PER_DAY", "TOKENS_PER_MINUTE", "TOKENS_PER_DAY"]) delete process.env[`AI_GLOBAL_${name}`];
  groqCreate.mockReset();
});

describe("site-wide request cap (example: 2 requests per minute)", () => {
  it("lets exactly 2 of 5 simultaneous calls through, and opens again the next minute", async () => {
    process.env.AI_GLOBAL_PER_MINUTE = "2";
    const now = new Date("2026-10-14T10:05:20Z");

    const results = await Promise.allSettled(Array.from({ length: 5 }, () => takeGlobalSlot(100, now)));
    const refused = results.filter((r) => r.status === "rejected").map((r) => r.reason);
    expect(results.filter((r) => r.status === "fulfilled")).toHaveLength(2);
    expect(refused).toHaveLength(3);
    for (const err of refused) {
      expect(err).toBeInstanceOf(AiCapacityError);
      expect(err.window).toBe("minute");
      expect(err.retryAfterSeconds).toBe(40); // 10:05:20 -> 10:06:00
    }

    await expect(takeGlobalSlot(100, new Date(now.getTime() + MINUTE))).resolves.toMatchObject({ tokens: 100 });
  });

  it("stops at the daily cap and gives the minute share back", async () => {
    process.env.AI_GLOBAL_PER_DAY = "3";
    const at = (minute) => new Date(Date.UTC(2026, 9, 14, 10, minute, 0));

    await takeGlobalSlot(100, at(0));
    await takeGlobalSlot(100, at(0));
    await takeGlobalSlot(100, at(1));

    const err = await takeGlobalSlot(100, at(1)).catch((e) => e);
    expect(err).toBeInstanceOf(AiCapacityError);
    expect(err.window).toBe("day");
    expect(err.message).toMatch(/today's AI capacity/);

    const usage = await getGlobalUsage(at(1));
    expect(usage.day).toMatchObject({ requests: 3, tokens: 300 });
    expect(usage.minute).toMatchObject({ requests: 1, tokens: 100 }); // refunded
  });
});

describe("site-wide token cap (Groq limits tokens per minute too)", () => {
  it("refuses a call that would go over this minute's tokens, even with requests to spare", async () => {
    process.env.AI_GLOBAL_TOKENS_PER_MINUTE = "7000";
    const now = new Date("2026-10-14T10:05:00Z");

    await takeGlobalSlot(4500, now); // one report
    const err = await takeGlobalSlot(4500, now).catch((e) => e); // a second won't fit in 7,000
    expect(err).toBeInstanceOf(AiCapacityError);
    expect(err.window).toBe("minute");

    await expect(takeGlobalSlot(2000, now)).resolves.toBeTruthy(); // a small review still fits
    expect((await getGlobalUsage(now)).minute).toMatchObject({ requests: 2, tokens: 6500 });
  });

  it("records the provider's real token count instead of the estimate", async () => {
    const now = new Date("2026-10-14T10:05:00Z");
    const slot = await takeGlobalSlot(4500, now);
    await settleGlobalSlot(slot, 6200);
    const usage = await getGlobalUsage(now);
    expect(usage.minute.tokens).toBe(6200);
    expect(usage.day.tokens).toBe(6200);
  });

  it("lets one oversized call through when the window is empty, rather than never", async () => {
    process.env.AI_GLOBAL_TOKENS_PER_MINUTE = "7000";
    const now = new Date("2026-10-14T10:05:00Z");
    await expect(takeGlobalSlot(12000, now)).resolves.toMatchObject({ tokens: 7000 });
    await expect(takeGlobalSlot(10, now)).rejects.toBeInstanceOf(AiCapacityError);
  });
});

describe("AI service + caps", () => {
  it("counts every provider call, retries included, and stops retrying at the cap", async () => {
    process.env.AI_GLOBAL_PER_MINUTE = "2";
    groqCreate.mockResolvedValue(reply("not json", 1000)); // every attempt fails validation

    const err = await generateInterviewReport(job).catch((e) => e);

    // attempts 1 and 2 reach Groq; attempt 3 is refused before it costs a call
    expect(groqCreate).toHaveBeenCalledTimes(2);
    expect(err).toBeInstanceOf(AiCapacityError);
    expect((await getGlobalUsage()).minute).toMatchObject({ requests: 2, tokens: 2000 }); // real counts
  });

  it("a retry that succeeds within the caps still returns the report", async () => {
    groqCreate.mockResolvedValueOnce(reply("not json")).mockResolvedValueOnce(reply(JSON.stringify(fakeReport())));
    const report = await generateInterviewReport(job);
    expect(report.technicalQuestions).toHaveLength(5);
    expect(groqCreate).toHaveBeenCalledTimes(2);
  });

  it("stops at once when Groq itself says 429, using Groq's retry-after", async () => {
    groqCreate.mockRejectedValue(
      Object.assign(new Error("Rate limit reached for tokens per minute"), {
        status: 429,
        headers: new Headers({ "retry-after": "17" })
      })
    );

    const err = await generateInterviewReport(job).catch((e) => e);
    expect(groqCreate).toHaveBeenCalledTimes(1); // no retries
    expect(err).toBeInstanceOf(AiCapacityError);
    expect(err.retryAfterSeconds).toBe(17);
    expect(err.message).toMatch(/busy/);
  });
});
