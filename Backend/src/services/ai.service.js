import { GoogleGenAI } from "@google/genai";
import Groq from "groq-sdk";
import { z } from "zod";

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
  ).min(5)
});

// zod v4's own converter; zod-to-json-schema returns an empty schema for v4.
const { $schema, ...reportJsonSchema } = z.toJSONSchema(interviewReportSchema);

// Groq is used when GROQ_API_KEY is set, otherwise Gemini.
const provider = process.env.GROQ_API_KEY ? "groq" : "gemini";

let groqClient;
let geminiClient;

async function generateWithGroq(prompt) {
  groqClient ??= new Groq({ apiKey: process.env.GROQ_API_KEY });

  const response = await groqClient.chat.completions.create({
    model: process.env.GROQ_MODEL || "openai/gpt-oss-120b",
    messages: [
      { role: "system", content: "You are an expert technical interviewer. Reply with a single valid JSON object only." },
      { role: "user", content: `${prompt}\n\nThe JSON must match this JSON Schema:\n${JSON.stringify(reportJsonSchema)}` }
    ],
    response_format: { type: "json_object" },
    temperature: 0.5
  });

  return response.choices[0]?.message?.content;
}

async function generateWithGemini(prompt) {
  geminiClient ??= new GoogleGenAI({ apiKey: process.env.GOOGLE_GENAI_API_KEY });

  const response = await geminiClient.models.generateContent({
    model: process.env.GEMINI_MODEL || "gemini-2.5-flash",
    contents: prompt,
    config: {
      responseMimeType: "application/json",
      responseJsonSchema: reportJsonSchema
    }
  });

  return response.text;
}

async function generateWithRetry(prompt, retries = 3) {
  const generate = provider === "groq" ? generateWithGroq : generateWithGemini;
  let lastError;

  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      const text = await generate(prompt);
      const validated = interviewReportSchema.parse(JSON.parse(text));

      return validated;
    } catch (error) {
      lastError = error;
      console.log(`AI attempt ${attempt}/${retries} (${provider}) failed: ${error.message}`);
    }
  }

  throw new Error(`AI failed to generate valid structured response (${provider}): ${lastError?.message}`);
}

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
- skill gap severity must be exactly "low", "medium" or "high"
- Analyze the resume against the job description to calculate a realistic matchScore (0-100)
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
