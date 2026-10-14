import { describe, expect, it, vi } from "vitest";
import request from "supertest";
import { authCookie, createReport, createUser } from "./helpers.js";

vi.mock("../src/services/ai.service.js", () => ({ default: vi.fn(), evaluateAnswer: vi.fn() }));
const { default: app } = await import("../src/app.js");

const list = (user, query = {}) =>
  request(app).get("/api/interview").query(query).set("Cookie", authCookie(user));

const titles = (res) => res.body.reports.map((r) => r.title);

// 5 plan days x 2 tasks = 10 tasks per fake report
const seed = async (user) => {
  const day = (n) => new Date(Date.UTC(2026, 8, n));
  await createReport(user, { title: "Backend (C++) Developer", matchScore: 85, createdAt: day(5), completedTasks: ["0-0"] });
  await createReport(user, {
    title: "Frontend Engineer",
    matchScore: 62,
    createdAt: day(4),
    completedTasks: ["0-0", "0-1", "1-0", "1-1", "2-0", "2-1", "3-0", "3-1", "4-0", "4-1"]
  });
  await createReport(user, { title: "Data Analyst", matchScore: 41, createdAt: day(3), jobDescription: "SQL and Tableau." });
};

describe("GET /api/interview (history page)", () => {
  it("returns a page newest first, with totals and stats over all reports", async () => {
    const user = await createUser();
    await seed(user);
    await createReport(await createUser()); // someone else's

    const res = await list(user, { limit: 2 });
    expect(res.status).toBe(200);
    expect(titles(res)).toEqual(["Backend (C++) Developer", "Frontend Engineer"]);
    expect(res.body).toMatchObject({ page: 1, pageSize: 2, total: 3, hasMore: true, stats: { count: 3, average: 63, best: 85 } });
    expect(res.body.reports[0]).toMatchObject({ planTaskCount: 10, completedCount: 1, status: "in-progress", technicalCount: 5 });

    const next = await list(user, { limit: 2, page: 2 });
    expect(titles(next)).toEqual(["Data Analyst"]);
    expect(next.body.hasMore).toBe(false);
  });

  it("sorts by score", async () => {
    const user = await createUser();
    await seed(user);
    expect(titles(await list(user, { sort: "low" }))).toEqual(["Data Analyst", "Frontend Engineer", "Backend (C++) Developer"]);
    expect(titles(await list(user, { sort: "high" }))[0]).toBe("Backend (C++) Developer");
    expect(titles(await list(user, { sort: "oldest" }))[0]).toBe("Data Analyst");
  });

  it("searches title and job description, treating the query as plain text", async () => {
    const user = await createUser();
    await seed(user);

    expect(titles(await list(user, { q: "tableau" }))).toEqual(["Data Analyst"]);
    expect(titles(await list(user, { q: "(C++)" }))).toEqual(["Backend (C++) Developer"]);
    const none = await list(user, { q: ".*" });
    expect(none.body).toMatchObject({ reports: [], total: 0 });
    // stats still describe everything, so the header doesn't change while searching
    expect(none.body.stats.count).toBe(3);
  });

  it("filters by plan progress", async () => {
    const user = await createUser();
    await seed(user);
    expect(titles(await list(user, { status: "done" }))).toEqual(["Frontend Engineer"]);
    expect(titles(await list(user, { status: "not-started" }))).toEqual(["Data Analyst"]);
    expect(titles(await list(user, { status: "in-progress", q: "backend" }))).toEqual(["Backend (C++) Developer"]);
  });

  it("clamps bad paging input and ignores unknown sorts and statuses", async () => {
    const user = await createUser();
    await seed(user);
    const res = await list(user, { limit: 999, page: -3, sort: "nope", status: "weird" });
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ page: 1, pageSize: 50, total: 3 });
    expect(titles(res)[0]).toBe("Backend (C++) Developer");

    const arrays = await request(app).get("/api/interview?q[$ne]=x&sort[]=high").set("Cookie", authCookie(user));
    expect(arrays.status).toBe(200);
    expect(arrays.body.total).toBe(3);
  });

  it("returns an empty first page with empty stats", async () => {
    const res = await list(await createUser());
    expect(res.body).toMatchObject({ reports: [], total: 0, hasMore: false, stats: { count: 0, average: null, best: null } });
  });
});
