import { afterEach, describe, expect, it, vi } from "vitest";

// Fresh module per test: the "server is awake" flag is module state.
// Imported before fake timers start, so module loading runs on real time.
const loadApi = async () => {
  vi.resetModules();
  const api = await import("./api");
  vi.useFakeTimers();
  return api;
};

const respondAfter = (ms, status = 200) => (config) =>
  new Promise((resolve, reject) =>
    setTimeout(() => {
      const response = { data: {}, status, statusText: "", headers: {}, config };
      if (status < 400) resolve(response);
      else reject(Object.assign(new Error("HTTP error"), { config, response }));
    }, ms)
  );

afterEach(() => vi.useRealTimers());

describe("server wake-up notice", () => {
  it("flags a slow first request as waking, and clears it once the server answers", async () => {
    const { default: api, isServerWaking, SLOW_MS } = await loadApi();
    api.defaults.adapter = respondAfter(SLOW_MS + 5000);

    const request = api.get("/api/auth/get-me");
    await vi.advanceTimersByTimeAsync(SLOW_MS + 10);
    expect(isServerWaking()).toBe(true);

    await vi.advanceTimersByTimeAsync(5000);
    await request;
    expect(isServerWaking()).toBe(false);
  });

  it("treats an error status as awake, and never flags slow requests after that", async () => {
    const { default: api, isServerWaking, SLOW_MS } = await loadApi();

    api.defaults.adapter = respondAfter(10, 401);
    const first = api.get("/api/auth/get-me").catch(() => {});
    await vi.advanceTimersByTimeAsync(20);
    await first;

    // e.g. a long AI generation: real work, not a cold start
    api.defaults.adapter = respondAfter(SLOW_MS * 5);
    const slow = api.post("/api/interview");
    await vi.advanceTimersByTimeAsync(SLOW_MS * 2);
    expect(isServerWaking()).toBe(false);
    await vi.advanceTimersByTimeAsync(SLOW_MS * 3);
    await slow;
  });
});
