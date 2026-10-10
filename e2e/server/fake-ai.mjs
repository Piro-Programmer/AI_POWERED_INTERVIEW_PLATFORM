// Stands in for Backend/src/services/ai.service.js during end-to-end tests:
// same exports, fixed answers, no network and no AI quota used.

export const FAKE_VERDICT = "Fake review: clear structure, add one concrete number.";

export default async function generateInterviewReport() {
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
