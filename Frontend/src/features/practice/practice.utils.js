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

export const CRITERIA_LABELS = {
  structure: "Structure",
  specificity: "Specificity",
  relevance: "Relevance",
  clarity: "Clarity"
};

const mean = (values) => values.reduce((sum, v) => sum + v, 0) / values.length;
const round1 = (n) => Math.round(n * 10) / 10;
const lowestKey = (averages) =>
  Object.entries(averages).reduce((low, entry) => (!low || entry[1] < low[1] ? entry : low), null)?.[0] ?? null;

/** "Technical Q2" for the session recap (the strip's chips say "T2"). */
export const questionName = ({ kind, index }) => `${kind === "behavioral" ? "Behavioral" : "Technical"} Q${index + 1}`;

/**
 * What happened in this practice session (answers reviewed since the page opened).
 * entries: [{ key, kind, index, score, criteria }] in the order answered.
 */
export function sessionSummary(entries) {
  if (!entries.length) return null;

  const byKind = {};
  for (const entry of entries) (byKind[entry.kind] ??= []).push(entry.score);
  const kindAverages = Object.fromEntries(Object.entries(byKind).map(([kind, scores]) => [kind, round1(mean(scores))]));

  const criteria = Object.fromEntries(
    Object.keys(CRITERIA_LABELS)
      .map((c) => [c, entries.map((e) => e.criteria?.[c]).filter((v) => typeof v === "number")])
      .filter(([, values]) => values.length)
      .map(([c, values]) => [c, round1(mean(values))])
  );

  const sorted = [...entries].sort((a, b) => b.score - a.score);
  return {
    answered: entries.length,
    questions: new Set(entries.map((e) => e.key)).size,
    average: round1(mean(entries.map((e) => e.score))),
    kindAverages,
    // a kind is only "weakest" when both were practised
    weakestKind: Object.keys(kindAverages).length > 1 ? lowestKey(kindAverages) : null,
    weakestCriterion: lowestKey(criteria),
    best: sorted[0],
    // only worth naming when it actually scored lower than the best
    worst: sorted[sorted.length - 1].score < sorted[0].score ? sorted[sorted.length - 1] : null
  };
}
