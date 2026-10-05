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
  completedCount
});

const titles = () => screen.getAllByRole("heading", { level: 3 }).map((h) => h.textContent);

beforeEach(() => {
  getMyReports.mockReset();
  getMyReports.mockResolvedValue({
    reports: [
      summary("a1", "Backend Developer", 85, 4, "2026-10-03T10:00:00Z"),
      summary("a2", "Frontend Engineer", 62, 10, "2026-09-28T10:00:00Z"),
      summary("a3", "Data Analyst", 41, 0, "2026-09-20T10:00:00Z")
    ]
  });
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
  });

  it("searches, sorts and filters", async () => {
    const user = userEvent.setup();
    renderPage();
    await screen.findByText("Backend Developer");

    await user.type(screen.getByRole("searchbox"), "analyst");
    expect(titles()).toEqual(["Data Analyst"]);
    await user.clear(screen.getByRole("searchbox"));

    await user.selectOptions(screen.getByRole("combobox"), "low");
    expect(titles()).toEqual(["Data Analyst", "Frontend Engineer", "Backend Developer"]);

    const filters = screen.getByRole("group", { name: "Filter by plan progress" });
    await user.click(within(filters).getByRole("button", { name: "Plan done" }));
    expect(titles()).toEqual(["Frontend Engineer"]);
  });

  it("shows an empty state when there are no reports", async () => {
    getMyReports.mockResolvedValue({ reports: [] });
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
