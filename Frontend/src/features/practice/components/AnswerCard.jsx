import { useEffect, useRef, useState } from "react";
import { useSpeechToText } from "../useSpeechToText";
import { formatClock } from "../practice.utils";

const MIN_ANSWER = 20;
const MAX_ANSWER = 4000;
const TARGET_SECONDS = 120;

/**
 * One question to answer: timer, textarea, optional voice input.
 * Remount it (key) to start a fresh attempt.
 */
const AnswerCard = ({ question, position, initialAnswer = "", busy, locked, blockedReason, onSubmit, onSkip }) => {
  // locked: this attempt was reviewed; "Try again" remounts the card for a new one
  const frozen = busy || locked;
  const [answer, setAnswer] = useState(initialAnswer);
  const [startedAt, setStartedAt] = useState(null);
  const [now, setNow] = useState(() => Date.now());
  const [usedVoice, setUsedVoice] = useState(false);
  const textareaRef = useRef(null);

  const markStarted = () => setStartedAt((t) => t ?? Date.now());

  const speech = useSpeechToText({
    onFinal: (text) => {
      if (!text) return;
      markStarted();
      setUsedVoice(true);
      setAnswer((prev) => (prev.trim() ? `${prev.trimEnd()} ${text}` : text).slice(0, MAX_ANSWER));
    }
  });

  // The clock starts with the first word, typed or spoken
  useEffect(() => {
    if (!startedAt || frozen) return;
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, [startedAt, frozen]);

  useEffect(() => {
    textareaRef.current?.focus();
  }, []);

  // The interval stops while frozen, so the clock stays where the answer was sent
  const elapsed = startedAt ? (now - startedAt) / 1000 : 0;
  const trimmed = answer.trim();
  const tooShort = trimmed.length < MIN_ANSWER;

  const submit = (e) => {
    e.preventDefault();
    if (tooShort || frozen || blockedReason) return;
    speech.stop();
    setNow(Date.now());
    onSubmit({
      answer: trimmed,
      durationSeconds: startedAt ? Math.round((Date.now() - startedAt) / 1000) : 0,
      inputMode: usedVoice ? "voice" : "typed"
    });
  };

  return (
    <form className="answer-card" onSubmit={submit}>
      <div className="answer-card__head">
        <p className="eyebrow">
          {question.kind === "technical" ? "Technical" : "Behavioral"} · {position}
        </p>
        <div
          className={`answer-clock ${elapsed > TARGET_SECONDS * 1.5 ? "is-long" : ""}`}
          title="Aim for about two minutes, like a real interview answer"
        >
          <span className="answer-clock__bar" aria-hidden="true">
            <span style={{ width: `${Math.min(elapsed / TARGET_SECONDS, 1) * 100}%` }} />
          </span>
          <span className="answer-clock__time">{formatClock(elapsed)} / 2:00</span>
        </div>
      </div>

      <h3 className="answer-card__question">{question.question}</h3>
      {question.kind === "behavioral" && (
        <p className="hand answer-card__hint">Tip: situation → task → what you did → result.</p>
      )}

      <label className="sr-only" htmlFor="practice-answer">Your answer</label>
      <textarea
        id="practice-answer"
        ref={textareaRef}
        className="answer-card__input"
        rows={7}
        maxLength={MAX_ANSWER}
        value={answer}
        disabled={frozen}
        placeholder="Answer as you would out loud: what you'd do, why, and one real example."
        onChange={(e) => {
          markStarted();
          setAnswer(e.target.value);
        }}
      />
      {speech.listening && (
        <p className="answer-card__interim" aria-live="polite">
          <span className="rec-dot" aria-hidden="true" /> listening… {speech.interim}
        </p>
      )}
      {speech.error && <p className="answer-card__error">{speech.error}</p>}

      <div className="answer-card__bar">
        <span className={`answer-card__count ${tooShort ? "is-short" : ""}`}>
          {trimmed.length} / {MAX_ANSWER.toLocaleString("en-US")}
          {tooShort && trimmed.length > 0 && ` · at least ${MIN_ANSWER}`}
        </span>
        {!locked && (
        <div className="answer-card__actions">
          {speech.supported && (
            <button
              type="button"
              className={`mic-button ${speech.listening ? "is-on" : ""}`}
              onClick={speech.listening ? speech.stop : speech.start}
              disabled={busy}
              aria-pressed={speech.listening}
              title="Uses your browser's speech recognition"
            >
              {speech.listening ? "■ Stop" : "● Speak"}
            </button>
          )}
          <button type="button" className="ghost-button" onClick={onSkip} disabled={busy}>
            Skip
          </button>
          <button className="button primary-button" disabled={busy || tooShort || Boolean(blockedReason)}>
            {busy ? "Reviewing…" : "Get feedback"}
          </button>
        </div>
        )}
      </div>
      {blockedReason && <p className="limit-note">{blockedReason}</p>}
    </form>
  );
};

export default AnswerCard;
