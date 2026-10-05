import { describe, expect, it, vi } from "vitest";
import request from "supertest";
import { createUser } from "./helpers.js";

vi.mock("../src/services/ai.service.js", () => ({ default: vi.fn(), evaluateAnswer: vi.fn() }));
const { default: app } = await import("../src/app.js");

const login = (body) => request(app).post("/api/auth/login").send(body);
const cookieFrom = (res) => res.headers["set-cookie"]?.find((c) => c.startsWith("token="))?.split(";")[0];

describe("register", () => {
  it("creates an account and signs the user in", async () => {
    const res = await request(app)
      .post("/api/auth/register")
      .send({ username: "priya", email: "priya@example.test", password: "pw-123456" });

    expect(res.status).toBe(201);
    expect(res.body.user).toMatchObject({ username: "priya", email: "priya@example.test" });
    expect(res.body.user.password).toBeUndefined();
    expect(cookieFrom(res)).toMatch(/^token=/);
    expect(res.headers["set-cookie"][0]).toMatch(/HttpOnly/);
  });

  it("rejects an email or username that's already taken", async () => {
    await createUser({ username: "sam", email: "sam@example.test" });
    const res = await request(app)
      .post("/api/auth/register")
      .send({ username: "sam", email: "other@example.test", password: "pw" });
    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/already exists/);
  });

  it.each([
    ["missing fields", {}],
    ["object instead of string", { username: { $gt: "" }, email: "x@example.test", password: "pw" }],
    ["blank username", { username: "   ", email: "x@example.test", password: "pw" }]
  ])("returns 400 for %s", async (_label, body) => {
    const res = await request(app).post("/api/auth/register").send(body);
    expect(res.status).toBe(400);
  });
});

describe("login", () => {
  it("signs in with the right password", async () => {
    await createUser({ email: "ana@example.test" });
    const res = await login({ email: "ana@example.test", password: "right-password" });
    expect(res.status).toBe(200);
    expect(cookieFrom(res)).toBeTruthy();
  });

  it("rejects a wrong password without saying which part was wrong", async () => {
    await createUser({ email: "ben@example.test" });
    const res = await login({ email: "ben@example.test", password: "nope" });
    expect(res.status).toBe(400);
    expect(res.body.message).toBe("Invalid email or password");
  });

  it.each([
    ["no body", {}],
    ["missing password", { email: "a@example.test" }],
    ["NoSQL operator as email", { email: { $gt: "" }, password: "x" }]
  ])("returns 400 for %s", async (_label, body) => {
    const res = await login(body);
    expect(res.status).toBe(400);
  });

  it("locks an account for 15 minutes after 10 failed attempts, without blocking others", async () => {
    await createUser({ email: "target@example.test" });
    for (let i = 0; i < 10; i++) {
      expect((await login({ email: "target@example.test", password: "wrong" })).status).toBe(400);
    }

    // even the right password is refused now; email matching ignores case/spaces
    const locked = await login({ email: " Target@Example.test", password: "right-password" });
    expect(locked.status).toBe(429);
    expect(locked.body.message).toMatch(/Too many sign-in attempts for this account\. Try again in 15 minutes\./);

    await createUser({ email: "bystander@example.test" });
    const other = await login({ email: "bystander@example.test", password: "right-password" });
    expect(other.status).toBe(200);
  });
});

describe("session", () => {
  it("get-me returns the user for a valid cookie, 401 without one", async () => {
    await createUser({ username: "cara", email: "cara@example.test" });
    const cookie = cookieFrom(await login({ email: "cara@example.test", password: "right-password" }));

    const me = await request(app).get("/api/auth/get-me").set("Cookie", cookie);
    expect(me.status).toBe(200);
    expect(me.body.user.username).toBe("cara");

    expect((await request(app).get("/api/auth/get-me")).status).toBe(401);
  });

  it("logout blacklists the token so it can't be reused", async () => {
    await createUser({ email: "dev@example.test" });
    const cookie = cookieFrom(await login({ email: "dev@example.test", password: "right-password" }));

    expect((await request(app).get("/api/auth/logout").set("Cookie", cookie)).status).toBe(200);
    const reused = await request(app).get("/api/auth/get-me").set("Cookie", cookie);
    expect(reused.status).toBe(401);
  });
});

describe("register rate limit", () => {
  it("allows 10 sign-ups per network per hour", async () => {
    // earlier tests in this file already used some; fill up to the limit
    let status = 201;
    let created = 0;
    while (status !== 429 && created < 20) {
      const res = await request(app)
        .post("/api/auth/register")
        .send({ username: `bulk${created}`, email: `bulk${created}@example.test`, password: "pw" });
      status = res.status;
      if (status === 429) expect(res.body.message).toMatch(/Too many accounts created from your network/);
      created += 1;
    }
    expect(status).toBe(429);
  });
});
