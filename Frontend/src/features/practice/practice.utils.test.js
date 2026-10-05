import { describe, expect, it } from "vitest";
import { formatClock, formatScore, isWeak, listQuestions, nextQuestion, practiceQueue, scoreBand } from "./practice.utils";

const report = {
  technicalQuestions: [1, 2, 3].map((n) => ({ question: `T${n}?`, intention: "i", answer: "a" })),
  behavioralQuestions: [1, 2].map((n) => ({ question: `B${n}?`, intention: "i", answer: "a" }))
};
const stats = {
  "technical-0": { attempts: 2, bestScore: 8.5, lastScore: 8.5 },
  "technical-2": { attempts: 1, bestScore: 4, lastScore: 4 },
  "behavioral-1": { attempts: 1, bestScore: 6, lastScore: 6 }
};
const keys = (list) => list.map((q) => q.label);

describe("practice ordering", () => {
  const questions = listQuestions(report, stats);

  it("lists technical then behavioral questions with their stats", () => {
    expect(keys(questions)).toEqual(["T1", "T2", "T3", "B1", "B2"]);
    expect(questions[0]).toMatchObject({ key: "technical-0", attempts: 2, bestScore: 8.5 });
    expect(questions[1].bestScore).toBeNull();
  });

  it("serves unanswered questions first, then the lowest best scores", () => {
    expect(keys(practiceQueue(questions))).toEqual(["T2", "B1", "T3", "B2", "T1"]);
  });

  it("re-drill mode keeps only answered questions scoring below 6", () => {
    expect(questions.filter(isWeak).map((q) => q.label)).toEqual(["T3"]);
    expect(keys(practiceQueue(questions, { weakOnly: true }))).toEqual(["T3"]);
  });

  it("next question skips the current one and anything passed over this round", () => {
    const queue = practiceQueue(questions);
    expect(nextQuestion(queue, "technical-1").label).toBe("B1");
    expect(nextQuestion(queue, "technical-1", new Set(["behavioral-0"])).label).toBe("T3");
    // everything skipped: fall back to the first other question rather than getting stuck
    const all = new Set(queue.map((q) => q.key));
    expect(nextQuestion(queue, "technical-1", all).label).toBe("B1");
    expect(nextQuestion([queue[0]], queue[0].key)).toBeNull();
  });
});

describe("formatting", () => {
  it("scoreBand groups scores", () => {
    expect([null, 3, 6, 7.9, 8].map(scoreBand)).toEqual(["none", "weak", "ok", "ok", "strong"]);
  });

  it("formats scores and clock time", () => {
    expect(formatScore(8)).toBe("8");
    expect(formatScore(8.5)).toBe("8.5");
    expect(formatClock(0)).toBe("0:00");
    expect(formatClock(125.7)).toBe("2:05");
  });
});
