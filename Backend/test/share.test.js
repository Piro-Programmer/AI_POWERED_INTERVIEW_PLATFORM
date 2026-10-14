import { describe, expect, it, vi } from "vitest";
import request from "supertest";
import { authCookie, createReport, createUser } from "./helpers.js";

vi.mock("../src/services/ai.service.js", () => ({ default: vi.fn(), evaluateAnswer: vi.fn() }));
const { default: app } = await import("../src/app.js");

const share = (user, id) => request(app).post(`/api/interview/${id}/share`).set("Cookie", authCookie(user));
const unshare = (user, id) => request(app).delete(`/api/interview/${id}/share`).set("Cookie", authCookie(user));
const open = (token) => request(app).get(`/api/shared/${token}`);

describe("report share links", () => {
  it("shares a report read-only, without the owner's private fields, until it's revoked", async () => {
    const owner = await createUser();
    const report = await createReport(owner, { completedTasks: ["0-0"] });

    const on = await share(owner, report._id);
    expect(on.status).toBe(200);
    expect(on.body.shareToken).toMatch(/^[A-Za-z0-9_-]{32}$/);

    // sharing again keeps the same link
    expect((await share(owner, report._id)).body.shareToken).toBe(on.body.shareToken);

    // the owner sees it on their report
    const own = await request(app).get(`/api/interview/${report._id}`).set("Cookie", authCookie(owner));
    expect(own.body.interviewReport.shareToken).toBe(on.body.shareToken);

    // anyone with the link, signed in or not
    const shared = await open(on.body.shareToken);
    expect(shared.status).toBe(200);
    expect(shared.headers["x-robots-tag"]).toMatch(/noindex/);
    expect(shared.headers["cache-control"]).toBe("no-store");
    expect(shared.body.report).toMatchObject({ title: report.title, matchScore: 72 });
    expect(shared.body.report.technicalQuestions).toHaveLength(5);
    for (const field of ["_id", "user", "selfDescription", "resume", "completedTasks", "shareToken"]) {
      expect(shared.body.report).not.toHaveProperty(field);
    }

    expect((await unshare(owner, report._id)).status).toBe(200);
    expect((await open(on.body.shareToken)).status).toBe(404);

    // a new share is a new link; the old one stays dead
    const again = await share(owner, report._id);
    expect(again.body.shareToken).not.toBe(on.body.shareToken);
    expect((await open(on.body.shareToken)).status).toBe(404);
  });

  it("only the owner can share or unshare", async () => {
    const owner = await createUser();
    const stranger = await createUser();
    const report = await createReport(owner);

    expect((await share(stranger, report._id)).status).toBe(404);
    expect((await unshare(stranger, report._id)).status).toBe(404);
    expect((await request(app).post(`/api/interview/${report._id}/share`)).status).toBe(401);
    expect((await share(owner, "nope")).status).toBe(404);
  });

  it("unknown or malformed links are a 404", async () => {
    expect((await open("x".repeat(32))).status).toBe(404);
    expect((await open("not-a-token")).status).toBe(404);
    expect((await open("$where")).status).toBe(404);
  });
});
