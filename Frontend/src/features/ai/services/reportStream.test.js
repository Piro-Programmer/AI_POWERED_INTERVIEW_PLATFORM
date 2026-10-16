import { afterEach, describe, expect, it, vi } from "vitest";
import { createEventParser, generateReportStream } from "./reportStream";

const sse = (event, data) => `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;

// a fetch Response whose body arrives in the given pieces
const streamResponse = (pieces, { status = 200, type = "text/event-stream" } = {}) => {
  const encoder = new TextEncoder();
  const body = new ReadableStream({
    start(controller) {
      for (const piece of pieces) controller.enqueue(encoder.encode(piece));
      controller.close();
    }
  });
  return new Response(body, { status, headers: { "content-type": type } });
};

afterEach(() => vi.unstubAllGlobals());

describe("createEventParser", () => {
  it("joins events split across chunks and ignores keep-alive comments", () => {
    const parse = createEventParser();
    const text = `: keep-alive\n\n${sse("start", { a: 1 })}${sse("section", { key: "matchScore", value: 72 })}`;
    const cut = text.length - 10;
    expect(parse(text.slice(0, cut))).toEqual([{ event: "start", data: { a: 1 } }]);
    expect(parse(text.slice(cut))).toEqual([{ event: "section", data: { key: "matchScore", value: 72 } }]);
  });
});

describe("generateReportStream", () => {
  const payload = { resume: null, selfDescription: "", jobDescription: "Backend role" };

  it("passes progress events on and resolves with the done data", async () => {
    const all = sse("start", { usage: { used: 1 } }) + sse("section", { key: "matchScore", value: 72 }) + sse("done", { interviewReport: { _id: "r1" } });
    const fetchMock = vi.fn(async () => streamResponse([all.slice(0, 30), all.slice(30, 90), all.slice(90)]));
    vi.stubGlobal("fetch", fetchMock);
    const seen = [];

    const result = await generateReportStream(payload, (e) => seen.push(e.event));

    expect(result).toEqual({ interviewReport: { _id: "r1" } });
    expect(seen).toEqual(["start", "section"]);
    const [, init] = fetchMock.mock.calls[0];
    expect(init.headers.Accept).toBe("text/event-stream");
    expect(init.credentials).toBe("include");
  });

  it("turns an error event into an axios-shaped error", async () => {
    vi.stubGlobal("fetch", async () => streamResponse([sse("start", {}), sse("error", { status: 503, code: "AI_CAPACITY", message: "busy" })]));
    const err = await generateReportStream(payload).catch((e) => e);
    expect(err.response).toEqual({ status: 503, data: { status: 503, code: "AI_CAPACITY", message: "busy" } });
  });

  it("reads a plain JSON error from before the stream started", async () => {
    vi.stubGlobal("fetch", async () =>
      new Response(JSON.stringify({ code: "DAILY_LIMIT", message: "You've used all 10 reports for today." }), {
        status: 429,
        headers: { "content-type": "application/json" }
      })
    );
    const err = await generateReportStream(payload).catch((e) => e);
    expect(err.response.status).toBe(429);
    expect(err.response.data.code).toBe("DAILY_LIMIT");
  });

  it("fails clearly if the connection ends before the report is ready", async () => {
    vi.stubGlobal("fetch", async () => streamResponse([sse("start", {})]));
    const err = await generateReportStream(payload).catch((e) => e);
    expect(err.response.data.message).toMatch(/closed before the report was ready/);
  });
});
