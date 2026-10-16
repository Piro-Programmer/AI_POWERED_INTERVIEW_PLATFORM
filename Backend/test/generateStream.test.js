import { beforeEach, describe, expect, it, vi } from "vitest";
import request from "supertest";
import { authCookie, createUser, fakeReport } from "./helpers.js";

vi.mock("../src/services/ai.service.js", () => ({ default: vi.fn(), evaluateAnswer: vi.fn() }));
const { default: generateInterviewReport } = await import("../src/services/ai.service.js");
const { default: app } = await import("../src/app.js");
const { AiCapacityError } = await import("../src/services/aiCapacity.service.js");
const { default: interviewReportModel } = await import("../src/models/interviewReport.model.js");

// "event: x\ndata: {...}\n\n" blocks -> [{ event, data }]
const parseEvents = (text) =>
  text
    .split("\n\n")
    .filter((block) => block.startsWith("event:"))
    .map((block) => {
      const [eventLine, dataLine] = block.split("\n");
      return { event: eventLine.slice(7), data: JSON.parse(dataLine.slice(6)) };
    });

const generateStreaming = (user, jobDescription = "Backend developer, Node.js") =>
  request(app)
    .post("/api/interview")
    .set("Cookie", authCookie(user))
    .set("Accept", "text/event-stream")
    .field("jobDescription", jobDescription)
    .buffer(true)
    .parse((res, done) => {
      let text = "";
      res.on("data", (chunk) => (text += chunk));
      res.on("end", () => done(null, text));
    });

// braces: a function returned from beforeEach would be run as a cleanup step
beforeEach(() => {
  generateInterviewReport.mockReset();
});

describe("POST /api/interview with Accept: text/event-stream", () => {
  it("streams start, each section, then done with the saved report", async () => {
    const report = fakeReport();
    generateInterviewReport.mockImplementation(async ({ onProgress }) => {
      onProgress({ type: "attempt", attempt: 1 });
      for (const key of Object.keys(report)) onProgress({ type: "section", key, value: report[key] });
      return report;
    });
    const user = await createUser();

    const res = await generateStreaming(user);
    expect(res.status).toBe(200);
    expect(res.headers["content-type"]).toMatch(/text\/event-stream/);

    const events = parseEvents(res.body);
    expect(events.map((e) => (e.event === "section" ? e.data.key : e.event))).toEqual([
      "start", "matchScore", "technicalQuestions", "behavioralQuestions", "skillGaps", "preparationPlan", "done"
    ]);
    expect(events[0].data.usage).toMatchObject({ used: 1 });
    const done = events.at(-1).data;
    expect(done.interviewReport._id).toBeTruthy();
    expect(await interviewReportModel.countDocuments({ user: user._id })).toBe(1);
  });

  it("tells the page when the AI retries", async () => {
    generateInterviewReport.mockImplementation(async ({ onProgress }) => {
      onProgress({ type: "attempt", attempt: 1 });
      onProgress({ type: "attempt", attempt: 2 });
      return fakeReport();
    });
    const events = parseEvents((await generateStreaming(await createUser())).body);
    expect(events.map((e) => e.event)).toEqual(["start", "retry", "done"]);
    expect(events[1].data).toEqual({ attempt: 2 });
  });

  it("sends a failure as an error event and gives the report back", async () => {
    generateInterviewReport.mockRejectedValueOnce(new AiCapacityError("minute", 30));
    const user = await createUser();

    const events = parseEvents((await generateStreaming(user)).body);
    expect(events.at(-1)).toMatchObject({
      event: "error",
      data: { status: 503, code: "AI_CAPACITY", retryAfterSeconds: 30 }
    });

    const usage = await request(app).get("/api/interview/usage").set("Cookie", authCookie(user));
    expect(usage.body.usage.used).toBe(0);
  });

  it("problems found before the AI starts are still plain JSON errors", async () => {
    const res = await request(app)
      .post("/api/interview")
      .set("Cookie", authCookie(await createUser()))
      .set("Accept", "text/event-stream")
      .field("selfDescription", "no job description");
    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/Job description is required/);
    expect(generateInterviewReport).not.toHaveBeenCalled();
  });

  it("without the header it answers JSON as before", async () => {
    generateInterviewReport.mockResolvedValue(fakeReport());
    const res = await request(app)
      .post("/api/interview")
      .set("Cookie", authCookie(await createUser()))
      .field("jobDescription", "Backend developer");
    expect(res.status).toBe(201);
    expect(res.body.interviewReport).toBeTruthy();
    expect(generateInterviewReport.mock.calls[0][0].onProgress).toBeUndefined();
  });
});
