import { afterEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import AnswerCard from "./AnswerCard";
import FeedbackPanel from "./FeedbackPanel";

const question = {
  key: "technical-0",
  kind: "technical",
  index: 0,
  question: "How would you find and fix slow re-renders?",
  intention: "Measure before optimising.",
  suggestedAnswer: "Profile, memoise, batch."
};

const feedback = {
  score: 8.5,
  criteria: { structure: 5, specificity: 4, relevance: 5, clarity: 4 },
  verdict: "Clear and specific.",
  strengths: ["You measured first."],
  improvements: ["Name the metric you'd watch."],
  strongerAnswer: "Lead with the profiler result."
};

afterEach(() => {
  delete window.webkitSpeechRecognition;
});

describe("AnswerCard", () => {
  it("hides the mic where the browser has no speech recognition", () => {
    render(<AnswerCard question={question} position="Q1 of 5" onSubmit={vi.fn()} onSkip={vi.fn()} />);
    expect(screen.queryByRole("button", { name: /Speak/ })).not.toBeInTheDocument();
  });

  it("shows the mic where speech recognition exists", () => {
    window.webkitSpeechRecognition = class {};
    render(<AnswerCard question={question} position="Q1 of 5" onSubmit={vi.fn()} onSkip={vi.fn()} />);
    expect(screen.getByRole("button", { name: /Speak/ })).toBeInTheDocument();
  });

  it("needs 20 characters before sending, then sends the trimmed typed answer", async () => {
    const onSubmit = vi.fn();
    const user = userEvent.setup();
    render(<AnswerCard question={question} position="Q1 of 5" onSubmit={onSubmit} onSkip={vi.fn()} />);

    const send = screen.getByRole("button", { name: "Get feedback" });
    await user.type(screen.getByLabelText("Your answer"), "Too short");
    expect(send).toBeDisabled();

    await user.type(screen.getByLabelText("Your answer"), " but now it is long enough.  ");
    expect(send).toBeEnabled();
    await user.click(send);

    expect(onSubmit).toHaveBeenCalledWith({
      answer: "Too short but now it is long enough.",
      durationSeconds: expect.any(Number),
      inputMode: "typed"
    });
  });

  it("blocks sending when the daily reviews are used up", async () => {
    const user = userEvent.setup();
    render(
      <AnswerCard
        question={question}
        position="Q1 of 5"
        initialAnswer="A perfectly long enough answer here."
        blockedReason="You’ve used today’s 30 answer reviews."
        onSubmit={vi.fn()}
        onSkip={vi.fn()}
      />
    );
    expect(screen.getByRole("button", { name: "Get feedback" })).toBeDisabled();
    expect(screen.getByText(/used today’s 30 answer reviews/)).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Skip" }));
  });
});

describe("FeedbackPanel", () => {
  it("shows the score, criteria, strengths and fixes", () => {
    render(<FeedbackPanel feedback={feedback} question={question} onRetry={vi.fn()} onNext={vi.fn()} />);

    expect(screen.getByLabelText("Score 8.5 out of 10")).toBeInTheDocument();
    expect(screen.getByText("Clear and specific.")).toBeInTheDocument();
    expect(screen.getByText("Structure").parentElement).toHaveTextContent("5/5");
    expect(screen.getByText("You measured first.")).toBeInTheDocument();
    expect(screen.getByText("Name the metric you'd watch.")).toBeInTheDocument();
  });

  it("folds the stronger answer until asked, and wires the actions", async () => {
    const onRetry = vi.fn();
    const onNext = vi.fn();
    const user = userEvent.setup();
    render(<FeedbackPanel feedback={feedback} question={question} onRetry={onRetry} onNext={onNext} />);

    const fold = screen.getByRole("button", { name: /A stronger version of your answer/ });
    expect(fold).toHaveAttribute("aria-expanded", "false");
    await user.click(fold);
    expect(fold).toHaveAttribute("aria-expanded", "true");

    await user.click(screen.getByRole("button", { name: "Try again" }));
    await user.click(screen.getByRole("button", { name: /Next question/ }));
    expect(onRetry).toHaveBeenCalledTimes(1);
    expect(onNext).toHaveBeenCalledTimes(1);
  });

  it("hides actions when showing an older attempt", () => {
    render(<FeedbackPanel feedback={feedback} question={question} title="Your last attempt" />);
    expect(screen.queryByRole("button", { name: "Try again" })).not.toBeInTheDocument();
  });
});
