import { GoogleGenAI } from "@google/genai";
import { z } from "zod";
import { zodToJsonSchema } from "zod-to-json-schema";

const ai = new GoogleGenAI({
  apiKey: process.env.GOOGLE_GENAI_API_KEY
});

// ✅ STRICT schema (no empty arrays)
const interviewReportSchema = z.object({
  matchScore: z.number().min(0).max(100),

  technicalQuestions: z.array(
    z.object({
      question: z.string(),
      intention: z.string(),
      answer: z.string()
    })
  ).min(5),

  behavioralQuestions: z.array(
    z.object({
      question: z.string(),
      intention: z.string(),
      answer: z.string()
    })
  ).min(3),

  skillGaps: z.array(
    z.object({
      skill: z.string(),
      severity: z.enum(["low", "medium", "high"])
    })
  ).min(3),

  preparationPlan: z.array(
    z.object({
      day: z.number(),
      focus: z.string(),
      tasks: z.array(z.string()).min(2)
    })
  ).min(5),

  title: z.string()
});

// 🔁 Retry wrapper
async function generateWithRetry(prompt, retries = 3) {
  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      const response = await ai.models.generateContent({
        model: "gemini-2.5-pro", // 🔥 important change
        contents: prompt,
        config: {
          responseMimeType: "application/json",
          responseJsonSchema: zodToJsonSchema(interviewReportSchema),
        }
      });

      // 🧪 Debug (optional)
      console.log("RAW AI RESPONSE:", response.text);

      const parsed = JSON.parse(response.text);

      // ✅ Strict validation
      const validated = interviewReportSchema.parse(parsed);

      return validated;

    } catch (error) {
      console.log(`❌ Attempt ${attempt} failed`);

      if (attempt === retries) {
        throw new Error("AI failed to generate valid structured response");
      }
    }
  }
}

// 🎯 MAIN SERVICE FUNCTION
async function generateInterviewReport({ resume, selfDescription, jobDescription }) {

  const prompt = `
You are an expert technical interviewer.

Generate a STRICT JSON response matching the schema.

IMPORTANT RULES:
- Do NOT leave any array empty
- MUST include:
  - 5 technical questions
  - 3 behavioral questions
  - 3 skill gaps
  - 5-day preparation plan
- Keep answers practical and interview-focused

Return ONLY valid JSON.

Candidate Details:
Resume: ${resume}
Self Description: ${selfDescription}
Job Description: ${jobDescription}
`;

  const result = await generateWithRetry(prompt);

  return result;
}

export default generateInterviewReport;
