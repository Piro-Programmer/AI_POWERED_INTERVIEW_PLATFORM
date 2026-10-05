import { useEffect, useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import AppSidebar from "../../../components/AppSidebar";
import { getPracticeSummary, getReport, submitPracticeAnswer } from "../../ai/services/interview.api";
import { cleanTitle } from "../../history/history.utils";
import AnswerCard from "../components/AnswerCard";
import FeedbackPanel from "../components/FeedbackPanel";
import QuestionStrip from "../components/QuestionStrip";
import { formatScore, isWeak, listQuestions, nextQuestion, practiceQueue } from "../practice.utils";
import "../../ai/report.scss";
import "../../history/history.scss";
import "../practice.scss";

const resetTime = (iso) => new Date(iso).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });

const Practice = () => {
  const { id } = useParams();
  const [report, setReport] = useState(null);
  const [stats, setStats] = useState({});
  const [reviewUsage, setReviewUsage] = useState(null);
  const [loadError, setLoadError] = useState(null);
  const [attempt, setAttempt] = useState(0);

  const [weakOnly, setWeakOnly] = useState(false);
  const [currentKey, setCurrentKey] = useState(null);
  const [skipped, setSkipped] = useState(() => new Set());
  const [round, setRound] = useState(0); // bumps to give the answer card a fresh attempt
  const [draft, setDraft] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [feedback, setFeedback] = useState(null); // review of the answer just submitted
  const [showLast, setShowLast] = useState(false);

  useEffect(() => {
    let cancelled = false;
    Promise.all([getReport(id), getPracticeSummary(id)])
      .then(([reportData, summary]) => {
        if (cancelled) return;
        setReport(reportData.interviewReport);
        setStats(summary.questions || {});
        setReviewUsage(summary.reviewUsage || null);
      })
      .catch((err) => {
        if (!cancelled) setLoadError(err.response?.status === 404 ? "missing" : "failed");
      });
    return () => {
      cancelled = true;
    };
  }, [id, attempt]);

  const questions = useMemo(() => listQuestions(report, stats), [report, stats]);

  const answered = questions.filter((q) => q.bestScore !== null);
  const average = answered.length
    ? answered.reduce((sum, q) => sum + q.bestScore, 0) / answered.length
    : null;
  const weakCount = questions.filter(isWeak).length;

  // Leaving re-drill mode automatically once nothing is weak any more
  const reDrilling = weakOnly && weakCount > 0;
  const queue = useMemo(() => practiceQueue(questions, { weakOnly: reDrilling }), [questions, reDrilling]);
  const current = questions.find((q) => q.key === currentKey) || queue[0] || questions[0] || null;
  const outOfReviews = reviewUsage?.remaining === 0;

  const goTo = (key) => {
    setCurrentKey(key);
    setFeedback(null);
    setShowLast(false);
    setError("");
    setDraft("");
    setRound((r) => r + 1);
  };

  const goNext = (markSkipped = false) => {
    let nextSkipped = skipped;
    if (markSkipped && current) {
      nextSkipped = new Set(skipped).add(current.key);
      setSkipped(nextSkipped);
    }
    const next = nextQuestion(queue, current?.key, nextSkipped);
    if (!next) return;
    if (nextSkipped.size >= queue.length - 1) setSkipped(new Set());
    goTo(next.key);
  };

  const retry = () => {
    setFeedback(null);
    setError("");
    setRound((r) => r + 1);
  };

  const submit = async ({ answer, durationSeconds, inputMode }) => {
    if (!current) return;
    // pin it: the queue reorders once the score comes back
    setCurrentKey(current.key);
    setBusy(true);
    setError("");
    setDraft(answer);
    try {
      const data = await submitPracticeAnswer(id, {
        kind: current.kind,
        index: current.index,
        answer,
        durationSeconds,
        inputMode
      });
      const score = data.attempt.feedback.score;
      setFeedback(data.attempt.feedback);
      setReviewUsage(data.usage);
      setStats((prev) => {
        const old = prev[current.key];
        return {
          ...prev,
          [current.key]: {
            attempts: (old?.attempts || 0) + 1,
            bestScore: Math.max(old?.bestScore ?? 0, score),
            lastScore: score,
            latest: data.attempt
          }
        };
      });
    } catch (err) {
      const data = err.response?.data;
      if (data?.code === "DAILY_LIMIT" && data.usage) {
        setReviewUsage(data.usage);
        setError(`${data.message} More at ${resetTime(data.usage.resetsAt)}.`);
      } else {
        setError(data?.message || "Couldn't review that answer. Please try again.");
      }
    } finally {
      setBusy(false);
    }
  };

  const position = current
    ? `Q${current.index + 1} of ${current.kind === "technical" ? report.technicalQuestions.length : report.behavioralQuestions.length}`
    : "";

  return (
    <main className="workspace-page">
      <AppSidebar />

      <section className="workspace-main history practice">
        <div className="detail__bar">
          <Link className="text-link" to={`/reports/${id}`}>← Back to the report</Link>
          {reviewUsage && (
            <p className={`practice__quota ${outOfReviews ? "is-empty" : ""}`}>
              Reviews left today: <strong>{reviewUsage.remaining} of {reviewUsage.limit}</strong>
            </p>
          )}
        </div>

        {!report && !loadError && <p className="page-loading page-loading--inline">laying out your questions…</p>}

        {loadError === "missing" && (
          <div className="history__empty">
            <p className="hand">This report doesn’t exist, or it belongs to another account.</p>
            <Link className="button primary-button" to="/reports">Back to your reports</Link>
          </div>
        )}

        {loadError === "failed" && (
          <div className="history__notice" role="alert">
            <p><strong>We couldn’t load practice mode.</strong> The server may still be waking up.</p>
            <button
              type="button"
              className="button secondary-button"
              onClick={() => {
                setLoadError(null);
                setAttempt((n) => n + 1);
              }}
            >
              Try again
            </button>
          </div>
        )}

        {report && current && (
          <>
            <header className="practice__head">
              <p className="eyebrow">Practice · {cleanTitle(report.title)}</p>
              <h2>Answer out loud, then get honest feedback.</h2>
              <p className="history__stats">
                {answered.length} of {questions.length} answered
                {average !== null && <> · average best <strong>{formatScore(Math.round(average * 10) / 10)}</strong></>}
                {weakCount > 0 && <> · {weakCount} to re-drill</>}
              </p>
            </header>

            <div className="practice__strip">
              <QuestionStrip questions={questions} currentKey={current.key} onSelect={goTo} />
              <div className="history__filters" role="group" aria-label="Which questions to practise">
                <button
                  type="button"
                  className={`chip ${!reDrilling ? "is-on" : ""}`}
                  aria-pressed={!reDrilling}
                  onClick={() => setWeakOnly(false)}
                >
                  All questions
                </button>
                <button
                  type="button"
                  className={`chip ${reDrilling ? "is-on" : ""}`}
                  aria-pressed={reDrilling}
                  disabled={weakCount === 0}
                  onClick={() => {
                    setWeakOnly(true);
                    const first = practiceQueue(questions, { weakOnly: true })[0];
                    if (first && first.key !== current.key) goTo(first.key);
                  }}
                >
                  Re-drill weak ones ({weakCount})
                </button>
              </div>
            </div>

            <AnswerCard
              key={`${current.key}-${round}`}
              question={current}
              position={position}
              initialAnswer={draft}
              busy={busy}
              locked={Boolean(feedback)}
              blockedReason={
                outOfReviews
                  ? `You’ve used today’s ${reviewUsage.limit} answer reviews. More at ${resetTime(reviewUsage.resetsAt)}.`
                  : ""
              }
              onSubmit={submit}
              onSkip={() => goNext(true)}
            />

            {error && <p className="error practice__error" role="alert">{error}</p>}

            {feedback && (
              <FeedbackPanel feedback={feedback} question={current} onRetry={retry} onNext={() => goNext(false)} />
            )}

            {!feedback && current.latest && (
              <div className="practice__last">
                <p>
                  Last time: <strong>{formatScore(current.lastScore)}/10</strong> · best {formatScore(current.bestScore)} ·{" "}
                  {current.attempts} {current.attempts === 1 ? "attempt" : "attempts"}
                  <button type="button" className="qset__all" onClick={() => setShowLast((s) => !s)}>
                    {showLast ? "hide feedback" : "show feedback"}
                  </button>
                </p>
                {showLast && (
                  <FeedbackPanel feedback={current.latest.feedback} question={current} title="Your last attempt" />
                )}
              </div>
            )}
          </>
        )}
      </section>
    </main>
  );
};

export default Practice;
