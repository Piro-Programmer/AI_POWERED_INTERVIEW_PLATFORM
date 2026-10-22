import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import request from "supertest";
import { createUser } from "./helpers.js";

vi.mock("../src/services/ai.service.js", () => ({ default: vi.fn(), evaluateAnswer: vi.fn() }));
// per-IP limits read X-Forwarded-For here, as behind Vercel, so each test can be
// its own network instead of all sharing one allowance
process.env.TRUST_PROXY_HOPS = "1";
const { default: app } = await import("../src/app.js");
const { default: passwordResetModel } = await import("../src/models/passwordReset.model.js");
const { resetMailTokenCache } = await import("../src/services/mail.service.js");

const login = (email, password) => request(app).post("/api/auth/login").send({ email, password });
let testIp = 0;
const forgot = (email, ip = `10.0.0.${testIp}`) =>
  request(app).post("/api/auth/forgot-password").set("X-Forwarded-For", ip).send({ email });
const reset = (token, password) => request(app).post("/api/auth/reset-password").send({ token, password });

// Google's token and Gmail send endpoints are replaced by a stub that records
// each email, decoded from the raw MIME message the Gmail API receives
const TOKEN_URL = "https://oauth2.googleapis.com/token";
const SEND_URL = "https://gmail.googleapis.com/gmail/v1/users/me/messages/send";
const GMAIL_ENV = {
  GOOGLE_CLIENT_ID: "client-id",
  GOOGLE_CLIENT_SECRET: "client-secret",
  GOOGLE_REFRESH_TOKEN: "refresh-token",
  EMAIL_FROM: "Interview Lab <sender@example.test>"
};

let sent;
let tokenCalls;
const json = (body, status = 200) => new Response(JSON.stringify(body), { status });

/** One sent email: headers and the decoded text/plain part. */
function decode(raw) {
  const mime = Buffer.from(raw, "base64url").toString("utf8");
  const header = (name) => mime.match(new RegExp(`^${name}: (.*)$`, "m"))?.[1];
  const textPart = mime.split(/--alt_\w+/).find((p) => p.includes("text/plain"));
  const text = Buffer.from(textPart.split("\r\n\r\n")[1].trim(), "base64").toString("utf8");
  return { from: header("From"), to: header("To"), subject: header("Subject"), text, mime };
}
const lastLink = () => sent.at(-1).text.match(/https?:\/\/\S+reset-password\?token=([\w-]+)/)?.[1];

beforeEach(() => {
  testIp += 1;
  sent = [];
  tokenCalls = [];
  resetMailTokenCache();
  Object.assign(process.env, GMAIL_ENV, { APP_URL: "https://app.example.test" });
  vi.stubGlobal("fetch", vi.fn(async (url, init) => {
    if (url === TOKEN_URL) {
      tokenCalls.push(Object.fromEntries(new URLSearchParams(init.body)));
      return json({ access_token: "access-1", expires_in: 3600 });
    }
    if (url === SEND_URL) {
      sent.push({ authorization: init.headers.Authorization, ...decode(JSON.parse(init.body).raw) });
      return json({ id: "msg_1" });
    }
    throw new Error(`unexpected fetch ${url}`);
  }));
});

afterEach(() => {
  vi.unstubAllGlobals();
  for (const name of [...Object.keys(GMAIL_ENV), "APP_URL"]) delete process.env[name];
});

describe("forgot password", () => {
  it("emails a one-time link through the Gmail API, storing only a hash of the token", async () => {
    const user = await createUser({ username: "ana", email: "ana@example.test" });

    const res = await forgot("ana@example.test");
    expect(res.status).toBe(200);
    expect(res.body.message).toMatch(/If an account exists/);

    expect(tokenCalls).toEqual([
      { client_id: "client-id", client_secret: "client-secret", refresh_token: "refresh-token", grant_type: "refresh_token" }
    ]);
    expect(sent).toHaveLength(1);
    expect(sent[0]).toMatchObject({
      authorization: "Bearer access-1",
      from: "Interview Lab <sender@example.test>",
      to: "ana@example.test",
      subject: "Reset your Interview Lab password"
    });
    expect(sent[0].mime).toContain("text/html");
    expect(sent[0].text).toContain("https://app.example.test/reset-password?token=");

    const token = lastLink();
    const stored = await passwordResetModel.findOne({ user: user._id }).lean();
    expect(stored.tokenHash).not.toContain(token);
    expect(stored.tokenHash).toMatch(/^[a-f0-9]{64}$/);
    expect(stored.expiresAt.getTime() - Date.now()).toBeGreaterThan(29 * 60 * 1000);
  });

  it("answers the same for an unknown email and sends nothing", async () => {
    await createUser({ email: "real@example.test" });
    const known = await forgot("real@example.test");
    const unknown = await forgot("nobody@example.test");
    expect(unknown.status).toBe(known.status);
    expect(unknown.body).toEqual(known.body);
    expect(sent).toHaveLength(1);
  });

  it("still answers the same when the email provider fails", async () => {
    await createUser({ email: "flaky@example.test" });
    vi.stubGlobal("fetch", vi.fn(async () => new Response("down", { status: 500 })));
    const res = await forgot("flaky@example.test");
    expect(res.status).toBe(200);
    expect(res.body.message).toMatch(/If an account exists/);
  });

  it("reuses the access token for the next email", async () => {
    await createUser({ email: "twice@example.test" });
    await forgot("twice@example.test");
    await forgot("twice@example.test");
    expect(sent).toHaveLength(2);
    expect(tokenCalls).toHaveLength(1);
  });

  it("still answers the same when Google refuses the refresh token", async () => {
    await createUser({ email: "revoked@example.test" });
    vi.stubGlobal("fetch", vi.fn(async () => json({ error: "invalid_grant" }, 400)));
    const res = await forgot("revoked@example.test");
    expect(res.status).toBe(200);
    expect(res.body.message).toMatch(/If an account exists/);
  });

  it("says so when email isn't set up", async () => {
    delete process.env.GOOGLE_REFRESH_TOKEN;
    const res = await forgot("anyone@example.test");
    expect(res.status).toBe(503);
    expect(res.body.code).toBe("EMAIL_DISABLED");
    expect(sent).toHaveLength(0);
  });

  it("limits requests per email address", async () => {
    await createUser({ email: "flood@example.test" });
    for (let i = 0; i < 3; i++) expect((await forgot("flood@example.test", `10.1.0.${i}`)).status).toBe(200);
    const fourth = await forgot(" Flood@Example.test", "10.1.0.9");
    expect(fourth.status).toBe(429);
    expect(sent).toHaveLength(3);
  });
});

describe("reset password", () => {
  it("sets the new password, signs out every session, and the link works only once", async () => {
    const user = await createUser({ email: "bo@example.test" });
    const oldSession = (await login("bo@example.test", "right-password")).headers["set-cookie"][0].split(";")[0];

    await forgot("bo@example.test");
    const token = lastLink();

    const res = await reset(token, "brand-new-9");
    expect(res.status).toBe(200);

    expect((await login("bo@example.test", "right-password")).status).toBe(400);
    expect((await login("bo@example.test", "brand-new-9")).status).toBe(200);
    expect((await request(app).get("/api/auth/get-me").set("Cookie", oldSession)).status).toBe(401);

    const again = await reset(token, "another-pass-9");
    expect(again.status).toBe(400);
    expect(again.body.code).toBe("RESET_INVALID");
    expect(await passwordResetModel.countDocuments({ user: user._id })).toBe(0);
  });

  it("a newer request replaces the older link", async () => {
    await createUser({ email: "cy@example.test" });
    await forgot("cy@example.test");
    const first = lastLink();
    await forgot("cy@example.test");
    const second = lastLink();

    expect((await reset(first, "brand-new-9")).status).toBe(400);
    expect((await reset(second, "brand-new-9")).status).toBe(200);
  });

  it("rejects an expired link, a weak password, and made-up tokens", async () => {
    const user = await createUser({ email: "di@example.test" });
    await forgot("di@example.test");
    const token = lastLink();

    expect((await reset(token, "short1")).body.message).toMatch(/at least 8/);
    expect(await passwordResetModel.countDocuments({ user: user._id })).toBe(1); // a weak password doesn't use up the link

    await passwordResetModel.updateOne({ user: user._id }, { $set: { expiresAt: new Date(Date.now() - 1000) } });
    expect((await reset(token, "brand-new-9")).body.code).toBe("RESET_INVALID");

    expect((await reset("x".repeat(43), "brand-new-9")).status).toBe(400);
    expect((await reset({ $ne: "" }, "brand-new-9")).status).toBe(400);
    expect((await login("di@example.test", "right-password")).status).toBe(200);
  });
});
