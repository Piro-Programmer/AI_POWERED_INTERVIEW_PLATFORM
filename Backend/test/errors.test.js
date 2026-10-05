import { describe, expect, it, vi } from "vitest";
import request from "supertest";

vi.mock("../src/services/ai.service.js", () => ({ default: vi.fn(), evaluateAnswer: vi.fn() }));
const { default: app } = await import("../src/app.js");

describe("app-wide behaviour", () => {
  it("health check answers ok", async () => {
    const res = await request(app).get("/api/health");
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ status: "ok" });
  });

  it("unknown API routes get a JSON 404", async () => {
    const res = await request(app).get("/api/does-not-exist");
    expect(res.status).toBe(404);
    expect(res.body).toEqual({ message: "Not found" });
  });

  it("bodies over 100 KB get a JSON 413", async () => {
    const res = await request(app).post("/api/auth/login").send({ email: "a@example.test", password: "x".repeat(120_000) });
    expect(res.status).toBe(413);
    expect(res.body.message).toBe("Request is too large.");
  });

  it("malformed JSON gets a JSON 400", async () => {
    const res = await request(app).post("/api/auth/login").set("Content-Type", "application/json").send("{not json");
    expect(res.status).toBe(400);
    expect(res.body.message).toBe("Request body isn't valid JSON.");
  });

  it("sets security and rate-limit headers", async () => {
    const res = await request(app).get("/api/does-not-exist");
    expect(res.headers["x-content-type-options"]).toBe("nosniff");
    expect(res.headers["x-frame-options"]).toBe("SAMEORIGIN");
    expect(res.headers["ratelimit-policy"]).toBeTruthy();
    expect(res.headers["x-powered-by"]).toBeUndefined();
  });

  it("allows the configured frontend origin with credentials", async () => {
    const res = await request(app).get("/api/health").set("Origin", "http://localhost:5173");
    expect(res.headers["access-control-allow-origin"]).toBe("http://localhost:5173");
    expect(res.headers["access-control-allow-credentials"]).toBe("true");

    const evil = await request(app).get("/api/health").set("Origin", "https://evil.example");
    expect(evil.headers["access-control-allow-origin"]).toBeUndefined();
  });
});
