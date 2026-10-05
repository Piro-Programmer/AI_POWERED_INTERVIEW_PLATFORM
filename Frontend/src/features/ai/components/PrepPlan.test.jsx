import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, fireEvent, render, screen } from "@testing-library/react";
import PrepPlan from "./PrepPlan";
import { saveProgress } from "../services/interview.api";

vi.mock("../services/interview.api", () => ({ saveProgress: vi.fn() }));

const plan = [
  { day: 1, focus: "Profiling", tasks: ["Profile a page", "Fix re-renders"] },
  { day: 2, focus: "GraphQL", tasks: ["Write resolvers", "Explain N+1"] }
];

// let the debounce fire and the save promise settle
const flushSave = async () => {
  await act(async () => {
    vi.advanceTimersByTime(700);
  });
  await act(async () => {});
};

beforeEach(() => {
  vi.useFakeTimers();
  saveProgress.mockReset();
  saveProgress.mockResolvedValue({});
});

afterEach(() => {
  vi.useRealTimers();
});

describe("PrepPlan", () => {
  it("starts from the ticks saved on the account", () => {
    render(<PrepPlan plan={plan} reportId="r1" savedTasks={["1-0"]} />);
    expect(screen.getByLabelText("Write resolvers")).toBeChecked();
    expect(screen.getByText(/of 4 tasks done/)).toHaveTextContent("1 of 4 tasks done");
  });

  it("batches quick clicks into one save, then says it's saved", async () => {
    render(<PrepPlan plan={plan} reportId="r1" savedTasks={[]} />);

    fireEvent.click(screen.getByLabelText("Profile a page"));
    fireEvent.click(screen.getByLabelText("Fix re-renders"));
    expect(screen.getByText("saving…")).toBeInTheDocument();
    expect(saveProgress).not.toHaveBeenCalled();

    await flushSave();

    expect(saveProgress).toHaveBeenCalledTimes(1);
    expect(saveProgress).toHaveBeenCalledWith("r1", ["0-0", "0-1"]);
    expect(screen.getByText("saved to your account")).toBeInTheDocument();
    // a finished day gets crossed off
    expect(screen.getByText("Day 1").closest("li")).toHaveClass("is-complete");
  });

  it("uploads browser-only ticks once for reports from before saved progress", async () => {
    localStorage.setItem("plan:old", JSON.stringify(["0-1"]));
    render(<PrepPlan plan={plan} reportId="old" />);

    await act(async () => {});
    expect(saveProgress).toHaveBeenCalledTimes(1);
    expect(saveProgress).toHaveBeenCalledWith("old", ["0-1"]);
    expect(screen.getByLabelText("Fix re-renders")).toBeChecked();
  });

  it("keeps the ticks and offers a retry when saving fails", async () => {
    saveProgress.mockRejectedValueOnce(new Error("offline"));
    render(<PrepPlan plan={plan} reportId="r1" savedTasks={[]} />);

    fireEvent.click(screen.getByLabelText("Explain N+1"));
    await flushSave();

    expect(screen.getByText(/couldn’t save to your account/)).toBeInTheDocument();
    expect(screen.getByLabelText("Explain N+1")).toBeChecked();
    expect(JSON.parse(localStorage.getItem("plan:r1"))).toEqual(["1-1"]);

    fireEvent.click(screen.getByRole("button", { name: "retry" }));
    await act(async () => {});
    expect(saveProgress).toHaveBeenCalledTimes(2);
    expect(screen.getByText("saved to your account")).toBeInTheDocument();
  });
});
