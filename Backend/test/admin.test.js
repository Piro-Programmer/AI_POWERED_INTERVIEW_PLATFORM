import { describe, expect, it, vi } from "vitest";
import request from "supertest";
import { authCookie, createReport, createUser, fakeFeedback } from "./helpers.js";

vi.mock("../src/services/ai.service.js", () => ({ default: vi.fn(), evaluateAnswer: vi.fn() }));
const { default: app } = await import("../src/app.js");
const { default: userModel } = await import("../src/models/user.model.js");
const { default: interviewReportModel } = await import("../src/models/interviewReport.model.js");
const { default: practiceAttemptModel } = await import("../src/models/practiceAttempt.model.js");

const createAdmin = async (overrides) => {
  const user = await createUser(overrides);
  await userModel.updateOne({ _id: user._id }, { $set: { role: "admin" } });
  return user;
};
const as = (user) => ({ get: (url) => request(app).get(url).set("Cookie", authCookie(user)), del: (url) => request(app).delete(url).set("Cookie", authCookie(user)) });

describe("who is an admin", () => {
  it("only the database decides: signing up with role admin is ignored", async () => {
    const res = await request(app)
      .post("/api/auth/register")
      .send({ username: "sneaky", email: "sneaky@example.test", password: "pass-1234", role: "admin" });
    expect(res.status).toBe(201);
    expect((await userModel.findOne({ email: "sneaky@example.test" }).lean()).role).toBe("user");
  });

  it("get-me reports the role, and a role change applies to an existing session at once", async () => {
    const user = await createUser();
    const cookie = authCookie(user);
    expect((await request(app).get("/api/auth/get-me").set("Cookie", cookie)).body.user.role).toBe("user");
    expect((await request(app).get("/api/admin/stats").set("Cookie", cookie)).status).toBe(403);

    await userModel.updateOne({ _id: user._id }, { $set: { role: "admin" } });
    expect((await request(app).get("/api/auth/get-me").set("Cookie", cookie)).body.user.role).toBe("admin");
    expect((await request(app).get("/api/admin/stats").set("Cookie", cookie)).status).toBe(200);
  });

  it.each(["/api/admin/stats", "/api/admin/users", "/api/admin/audit"])("%s: 401 signed out, 403 for a normal user", async (url) => {
    expect((await request(app).get(url)).status).toBe(401);
    const res = await as(await createUser()).get(url);
    expect(res.status).toBe(403);
    expect(res.body.message).toBe("Admins only.");
  });
});

describe("admin pages", () => {
  it("stats: totals, last 7 days, shared reports and today's AI usage", async () => {
    const admin = await createAdmin();
    const user = await createUser();
    await createReport(user, { shareToken: "s".repeat(32) });
    await createReport(user, { createdAt: new Date("2025-01-01") });

    const res = await as(admin).get("/api/admin/stats");
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({
      users: { total: 2, admins: 1, last7Days: 2 },
      reports: { total: 2, last7Days: 1, shared: 1 },
      practiceAttempts: { total: 0 }
    });
    expect(res.body.ai.day).toMatchObject({ requests: 0, tokens: 0 });
  });

  it("users: newest first, searchable, with counts and no password hashes", async () => {
    const admin = await createAdmin({ username: "boss" });
    const ana = await createUser({ username: "ana", email: "ana@example.test" });
    const report = await createReport(ana);
    await practiceAttemptModel.create({
      user: ana._id, report: report._id, kind: "technical", questionIndex: 0, answer: "x", feedback: fakeFeedback()
    });

    const all = await as(admin).get("/api/admin/users");
    expect(all.status).toBe(200);
    expect(all.body.users.map((u) => u.username)).toEqual(["ana", "boss"]);
    expect(all.body.users[0]).toMatchObject({ email: "ana@example.test", role: "user", reportCount: 1, practiceCount: 1 });
    expect(all.body.users[0].joinedAt).toBeTruthy();
    expect(JSON.stringify(all.body)).not.toMatch(/password|\$2[aby]\$/);

    const found = await as(admin).get("/api/admin/users?q=ANA@");
    expect(found.body.users.map((u) => u.username)).toEqual(["ana"]);
    expect((await as(admin).get("/api/admin/users?q=.*")).body.total).toBe(0);
  });

  it("delete user: removes them and their data, logs it, and leaves others alone", async () => {
    const admin = await createAdmin({ username: "boss" });
    const victim = await createUser({ username: "spammer", email: "spam@example.test" });
    await createReport(victim);
    const bystander = await createUser();
    await createReport(bystander);

    const res = await as(admin).del(`/api/admin/users/${victim._id}`);
    expect(res.status).toBe(200);
    expect(await userModel.exists({ _id: victim._id })).toBeNull();
    expect(await interviewReportModel.countDocuments({ user: victim._id })).toBe(0);
    expect(await interviewReportModel.countDocuments({ user: bystander._id })).toBe(1);

    // their session no longer works
    expect((await request(app).get("/api/auth/get-me").set("Cookie", authCookie(victim))).status).toBe(401);

    const audit = await as(admin).get("/api/admin/audit");
    expect(audit.body.entries[0]).toMatchObject({
      action: "delete-user",
      adminName: "boss",
      details: { username: "spammer", email: "spam@example.test", reportCount: 1, practiceCount: 0 }
    });
  });

  it("won't delete yourself, another admin, or a missing user", async () => {
    const admin = await createAdmin();
    const otherAdmin = await createAdmin();

    expect((await as(admin).del(`/api/admin/users/${admin._id}`)).status).toBe(400);
    expect((await as(admin).del(`/api/admin/users/${otherAdmin._id}`)).status).toBe(403);
    expect((await as(admin).del("/api/admin/users/000000000000000000000000")).status).toBe(404);
    expect((await as(admin).del("/api/admin/users/nope")).status).toBe(404);
    expect(await userModel.countDocuments()).toBe(2);
  });

  it("a normal user can't delete anyone", async () => {
    const victim = await createUser();
    expect((await as(await createUser()).del(`/api/admin/users/${victim._id}`)).status).toBe(403);
    expect(await userModel.exists({ _id: victim._id })).toBeTruthy();
  });
});
