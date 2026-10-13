import { describe, expect, it, vi } from "vitest";
import request from "supertest";
import { authCookie, createReport, createUser, fakeFeedback } from "./helpers.js";

vi.mock("../src/services/ai.service.js", () => ({ default: vi.fn(), evaluateAnswer: vi.fn() }));
const { default: app } = await import("../src/app.js");
const { default: userModel } = await import("../src/models/user.model.js");
const { default: interviewReportModel } = await import("../src/models/interviewReport.model.js");
const { default: practiceAttemptModel } = await import("../src/models/practiceAttempt.model.js");
const { default: aiUsageModel } = await import("../src/models/aiUsage.model.js");

const login = (email, password) => request(app).post("/api/auth/login").send({ email, password });
const cookieFrom = (res) => res.headers["set-cookie"]?.find((c) => c.startsWith("token="))?.split(";")[0];
const getMe = (cookie) => request(app).get("/api/auth/get-me").set("Cookie", cookie);
const changePassword = (cookie, body) => request(app).patch("/api/auth/password").set("Cookie", cookie).send(body);
const deleteAccount = (cookie, body) => request(app).delete("/api/auth/account").set("Cookie", cookie).send(body);

// iat has one-second resolution: make sure "earlier" sessions really are earlier
const nextSecond = () => new Promise((r) => setTimeout(r, 1100));

describe("PATCH /api/auth/password", () => {
  it("changes the password, keeps this session and signs out the others", async () => {
    await createUser({ email: "pat@example.test" });
    const other = cookieFrom(await login("pat@example.test", "right-password"));
    await nextSecond(); // otherwise both logins get the identical token
    const current = cookieFrom(await login("pat@example.test", "right-password"));
    await nextSecond();

    const res = await changePassword(current, { currentPassword: "right-password", newPassword: "new-pass-123" });
    expect(res.status).toBe(200);

    const fresh = cookieFrom(res);
    expect(fresh).toBeTruthy();
    expect((await getMe(fresh)).status).toBe(200);
    expect((await getMe(current)).status).toBe(401);
    const otherDevice = await getMe(other);
    expect(otherDevice.status).toBe(401);
    expect(otherDevice.body.message).toMatch(/session has ended/);

    expect((await login("pat@example.test", "right-password")).status).toBe(400);
    expect((await login("pat@example.test", "new-pass-123")).status).toBe(200);
  });

  it.each([
    ["a wrong current password", { currentPassword: "nope-1234", newPassword: "new-pass-123" }, 401, /incorrect/],
    ["a weak new password", { currentPassword: "right-password", newPassword: "short1" }, 400, /at least 8/],
    ["the same password again", { currentPassword: "new-pass-123", newPassword: "new-pass-123" }, 400, /different/],
    ["missing fields", {}, 400, /current password/],
    ["a NoSQL object", { currentPassword: { $gt: "" }, newPassword: "new-pass-123" }, 400, /current password/]
  ])("rejects %s and keeps the old password", async (_label, body, status, message) => {
    const user = await createUser();
    const res = await changePassword(authCookie(user), body);
    expect(res.status).toBe(status);
    expect(res.body.message).toMatch(message);
    expect((await login(user.email, "right-password")).status).toBe(200);
  });

  it("locks after 10 wrong current passwords", async () => {
    const user = await createUser();
    const cookie = authCookie(user);
    for (let i = 0; i < 10; i++) {
      expect((await changePassword(cookie, { currentPassword: "wrong-123", newPassword: "new-pass-123" })).status).toBe(401);
    }
    const locked = await changePassword(cookie, { currentPassword: "right-password", newPassword: "new-pass-123" });
    expect(locked.status).toBe(429);
  });

  it("requires a signed-in user", async () => {
    expect((await request(app).patch("/api/auth/password").send({})).status).toBe(401);
  });
});

describe("DELETE /api/auth/account", () => {
  it("deletes the user and all their data, ends every session, and leaves other users alone", async () => {
    const user = await createUser({ email: "del@example.test" });
    const otherSession = cookieFrom(await login("del@example.test", "right-password"));
    const report = await createReport(user);
    await practiceAttemptModel.create({
      user: user._id, report: report._id, kind: "technical", questionIndex: 0, answer: "x", feedback: fakeFeedback()
    });
    await aiUsageModel.create({ user: user._id, day: "2026-10-13", kind: "report", count: 1 });

    const bystander = await createUser();
    await createReport(bystander);

    const cookie = authCookie(user);
    const res = await deleteAccount(cookie, { password: "right-password" });
    expect(res.status).toBe(200);
    expect(res.headers["set-cookie"][0]).toMatch(/^token=;/);

    expect(await userModel.exists({ _id: user._id })).toBeNull();
    expect(await interviewReportModel.countDocuments({ user: user._id })).toBe(0);
    expect(await practiceAttemptModel.countDocuments({ user: user._id })).toBe(0);
    expect(await aiUsageModel.countDocuments({ user: user._id })).toBe(0);

    expect((await getMe(cookie)).status).toBe(401);
    expect((await getMe(otherSession)).status).toBe(401);
    expect((await login("del@example.test", "right-password")).status).toBe(400);

    expect(await interviewReportModel.countDocuments({ user: bystander._id })).toBe(1);
  });

  it("needs the right password", async () => {
    const user = await createUser();
    const wrong = await deleteAccount(authCookie(user), { password: "nope-1234" });
    expect(wrong.status).toBe(401);
    const missing = await deleteAccount(authCookie(user), {});
    expect(missing.status).toBe(400);
    expect(await userModel.exists({ _id: user._id })).toBeTruthy();
  });
});
