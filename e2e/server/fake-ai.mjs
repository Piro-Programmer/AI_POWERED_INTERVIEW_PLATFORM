// Stands in for Backend/src/services/ai.service.js during end-to-end tests:
// same exports, fixed answers, no network and no AI quota used.

export const FAKE_VERDICT = "Fake review: clear structure, add one concrete number.";

const pause = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

// With onProgress (the streaming path), hand over each part with a short
// pause, like a real model writing, so the page's live progress can be seen.
export default async function generateInterviewReport({ onProgress } = {}) {
  const report = fakeReport();
  if (onProgress) {
    onProgress({ type: "attempt", attempt: 1 });
    for (const [key, value] of Object.entries(report)) {
      await pause(250);
      onProgress({ type: "section", key, value });
    }
  }
  return report;
}

function fakeReport() {
  return {
    matchScore: 72,
    technicalQuestions: [1, 2, 3, 4, 5].map((n) => ({
      question: `How would you design feature ${n} of an Express API?`,
      intention: `Checks API design depth (${n}).`,
      answer: `Start from the data model, then routes, then validation (${n}).`
    })),
    behavioralQuestions: [1, 2, 3].map((n) => ({
      question: `Tell me about a time you handled conflict ${n}.`,
      intention: "Checks collaboration.",
      answer: "Situation, task, action, result."
    })),
    skillGaps: [
      { skill: "GraphQL", severity: "high" },
      { skill: "Docker", severity: "medium" },
      { skill: "AWS", severity: "low" }
    ],
    preparationPlan: [1, 2, 3, 4, 5].map((day) => ({
      day,
      focus: `Focus area ${day}`,
      tasks: [`Read about topic ${day}`, `Build a small demo ${day}`]
    }))
  };
}

export async function evaluateAnswer() {
  return {
    score: 7,
    criteria: { structure: 4, specificity: 3, relevance: 4, clarity: 4 },
    verdict: FAKE_VERDICT,
    strengths: ["You led with the answer."],
    improvements: ["Add a measurable result."],
    strongerAnswer: "Lead with the outcome, then the two key decisions."
  };
}
