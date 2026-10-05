export const WEAK_SCORE = 6;

export const questionKey = (kind, index) => `${kind}-${index}`;

/** Every question in a report, with its practice stats. */
export function listQuestions(report, stats = {}) {
  const make = (kind, list = []) =>
    list.map((q, index) => {
      const key = questionKey(kind, index);
      const s = stats[key];
      return {
        key,
        kind,
        index,
        label: `${kind === "technical" ? "T" : "B"}${index + 1}`,
        question: q.question,
        intention: q.intention,
        suggestedAnswer: q.answer,
        attempts: s?.attempts || 0,
        bestScore: s ? s.bestScore : null,
        lastScore: s ? s.lastScore : null,
        latest: s?.latest || null
      };
    });
  return [...make("technical", report?.technicalQuestions), ...make("behavioral", report?.behavioralQuestions)];
}

// Answered, but the best attempt so far is below the bar
export const isWeak = (q) => q.bestScore !== null && q.bestScore < WEAK_SCORE;

/**
 * Practice order: unanswered questions first (in report order), then
 * answered ones from the lowest best score up, so weak answers come back.
 */
export function practiceQueue(questions, { weakOnly = false } = {}) {
  const pool = weakOnly ? questions.filter(isWeak) : questions;
  const unanswered = pool.filter((q) => q.bestScore === null);
  const answered = pool
    .filter((q) => q.bestScore !== null)
    .sort((a, b) => a.bestScore - b.bestScore);
  return [...unanswered, ...answered];
}

/** Next question to show after `currentKey`, skipping ones passed over this round. */
export function nextQuestion(queue, currentKey, skipped = new Set()) {
  const candidates = queue.filter((q) => q.key !== currentKey);
  return candidates.find((q) => !skipped.has(q.key)) || candidates[0] || null;
}

export const scoreBand = (score) => {
  if (score === null || score === undefined) return "none";
  if (score >= 8) return "strong";
  if (score >= WEAK_SCORE) return "ok";
  return "weak";
};

export const formatScore = (score) => (Number.isInteger(score) ? String(score) : score.toFixed(1));

export const formatClock = (seconds) => {
  const s = Math.max(0, Math.floor(seconds));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
};
