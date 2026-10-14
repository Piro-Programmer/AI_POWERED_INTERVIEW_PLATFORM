import { beforeEach, describe, expect, it, vi } from "vitest";
import { screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import Reports from "./Reports";
import { getMyReports } from "../../ai/services/interview.api";
import { renderWithApp } from "../../../test/renderWithApp";

vi.mock("../../ai/services/interview.api", () => ({ getMyReports: vi.fn() }));

const summary = (id, title, score, completedCount, created) => ({
  _id: id,
  title: `Interview Report - ${title}`,
  createdAt: created,
  matchScore: score,
  jobDescription: `We're hiring a ${title}.`,
  skillGaps: [{ skill: "GraphQL", severity: "high" }],
  technicalCount: 5,
  behavioralCount: 3,
  planDays: 5,
  planTaskCount: 10,
  completedCount,
  status: completedCount >= 10 ? "done" : completedCount > 0 ? "in-progress" : "not-started"
});

const ALL = [
  summary("a1", "Backend Developer", 85, 4, "2026-10-03T10:00:00Z"),
  summary("a2", "Frontend Engineer", 62, 10, "2026-09-28T10:00:00Z"),
  summary("a3", "Data Analyst", 41, 0, "2026-09-20T10:00:00Z")
];

const SORTS = {
  newest: (a, b) => b.createdAt.localeCompare(a.createdAt),
  low: (a, b) => a.matchScore - b.matchScore
};

// A small stand-in for the server: same parameters, same response shape.
const fakeServer = (reports) => async ({ page = 1, limit = 20, sort = "newest", q, status } = {}) => {
  const rows = reports
    .filter((r) => !q || `${r.title} ${r.jobDescription}`.toLowerCase().includes(q.toLowerCase()))
    .filter((r) => !status || r.status === status)
    .sort(SORTS[sort]);
  const scores = reports.map((r) => r.matchScore);
  return {
    reports: rows.slice((page - 1) * limit, page * limit),
    page,
    pageSize: limit,
    total: rows.length,
    hasMore: page * limit < rows.length,
    stats: {
      count: reports.length,
      average: reports.length ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length) : null,
      best: reports.length ? Math.max(...scores) : null
    }
  };
};

const titles = () => screen.getAllByRole("heading", { level: 3 }).map((h) => h.textContent);

beforeEach(() => {
  getMyReports.mockReset();
  getMyReports.mockImplementation(fakeServer(ALL));
});

const renderPage = () =>
  renderWithApp(<Reports />, { path: "/reports", user: { username: "Test", email: "t@example.test" } });

describe("Report history", () => {
  it("lists reports newest first with stats and plan progress", async () => {
    renderPage();
    expect(await screen.findByText("Backend Developer")).toBeInTheDocument();
    expect(titles()).toEqual(["Backend Developer", "Frontend Engineer", "Data Analyst"]);
    expect(screen.getByText(/3 reports/)).toHaveTextContent("3 reports · average match 63 · best 85");
    expect(screen.getByText("4 of 10 tasks · plan in progress")).toBeInTheDocument();
    expect(screen.getByText("plan not started")).toBeInTheDocument();
    expect(screen.getByText("Showing 3 of 3")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Load more" })).not.toBeInTheDocument();
  });

  it("asks the server to search, sort and filter", async () => {
    const user = userEvent.setup();
    renderPage();
    await screen.findByText("Backend Developer");

    await user.type(screen.getByRole("searchbox"), "analyst");
    await vi.waitFor(() => expect(titles()).toEqual(["Data Analyst"]));
    expect(getMyReports).toHaveBeenLastCalledWith(expect.objectContaining({ q: "analyst", page: 1 }));
    await user.clear(screen.getByRole("searchbox"));
    await vi.waitFor(() => expect(titles()).toHaveLength(3));

    await user.selectOptions(screen.getByRole("combobox"), "low");
    await vi.waitFor(() => expect(titles()).toEqual(["Data Analyst", "Frontend Engineer", "Backend Developer"]));

    const filters = screen.getByRole("group", { name: "Filter by plan progress" });
    await user.click(within(filters).getByRole("button", { name: "Plan done" }));
    await vi.waitFor(() => expect(titles()).toEqual(["Frontend Engineer"]));
    expect(getMyReports).toHaveBeenLastCalledWith(expect.objectContaining({ status: "done", sort: "low" }));
  });

  it("loads more pages on request", async () => {
    const many = Array.from({ length: 25 }, (_, i) =>
      summary(`m${i}`, `Role ${String(i).padStart(2, "0")}`, 50, 0, `2026-09-${String(30 - i).padStart(2, "0")}T10:00:00Z`)
    );
    getMyReports.mockImplementation(fakeServer(many));
    const user = userEvent.setup();
    renderPage();

    await screen.findByText("Role 00");
    expect(titles()).toHaveLength(20);
    expect(screen.getByText("Showing 20 of 25")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Load more" }));
    await screen.findByText("Role 24");
    expect(titles()).toHaveLength(25);
    expect(screen.queryByRole("button", { name: "Load more" })).not.toBeInTheDocument();
  });

  it("shows an empty state when there are no reports", async () => {
    getMyReports.mockImplementation(fakeServer([]));
    renderPage();
    expect(await screen.findByRole("link", { name: "Create your first report" })).toBeInTheDocument();
  });

  it("shows an error with a working retry", async () => {
    getMyReports.mockRejectedValueOnce({ response: { data: { message: "Failed to fetch interview reports" } } });
    const user = userEvent.setup();
    renderPage();

    expect(await screen.findByRole("alert")).toHaveTextContent("Failed to fetch interview reports");
    await user.click(screen.getByRole("button", { name: "Try again" }));
    expect(await screen.findByText("Backend Developer")).toBeInTheDocument();
  });
});
