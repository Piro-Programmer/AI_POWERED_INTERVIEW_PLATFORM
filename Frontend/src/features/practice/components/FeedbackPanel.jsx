import { useState } from "react";
import Fold from "../../ai/components/Fold";
import { formatScore, scoreBand } from "../practice.utils";

const CRITERIA = [
  ["structure", "Structure"],
  ["specificity", "Specificity"],
  ["relevance", "Relevance"],
  ["clarity", "Clarity"]
];

const LOOP = "M110 12 C 190 12, 212 52, 208 76 C 202 116, 150 132, 106 130 C 50 128, 12 108, 14 70 C 16 34, 60 12, 110 12";

// Same pen loop as the report's match score, closing as far as score / max.
export const PenDial = ({ score, max = 10, caption }) => (
  <figure className="dial dial--small" aria-label={`Score ${formatScore(score)} out of ${max}`}>
    <div className="dial__num" aria-hidden="true">
      {formatScore(score)}
      <svg className="dial__ring" viewBox="0 0 220 140" preserveAspectRatio="none">
        <path className="dial__track" pathLength="1" d={LOOP} />
        <path className="dial__stroke" pathLength="1" style={{ "--gap": 1 - score / max }} d={LOOP} />
      </svg>
    </div>
    {caption && (
      <figcaption>
        <span className="eyebrow">{caption}</span>
      </figcaption>
    )}
  </figure>
);

/** AI review of one answer. Actions are hidden when showing an older attempt. */
const FeedbackPanel = ({ feedback, question, onRetry, onNext, title = "Feedback" }) => {
  const [open, setOpen] = useState(() => new Set());
  const toggle = (key) =>
    setOpen((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });

  return (
    <section className={`feedback feedback--${scoreBand(feedback.score)}`} aria-live="polite">
      <div className="feedback__head">
        <PenDial score={feedback.score} caption="score / 10" />
        <div>
          <p className="eyebrow">{title}</p>
          <p className="feedback__verdict">{feedback.verdict}</p>
          <ul className="criteria">
            {CRITERIA.map(([key, label]) => (
              <li key={key}>
                <span>{label}</span>
                <span className="criteria__bar" aria-hidden="true">
                  {[1, 2, 3, 4, 5].map((n) => (
                    <i key={n} className={n <= (feedback.criteria?.[key] || 0) ? "is-on" : ""} />
                  ))}
                </span>
                <strong>{feedback.criteria?.[key] ?? "–"}/5</strong>
              </li>
            ))}
          </ul>
        </div>
      </div>

      <div className="feedback__notes">
        <div>
          <p className="eyebrow">What worked</p>
          <ul className="feedback__strengths">
            {feedback.strengths?.map((s, i) => <li key={i}>{s}</li>)}
          </ul>
        </div>
        <div>
          <p className="eyebrow">Fix next time</p>
          <ol className="feedback__improvements">
            {feedback.improvements?.map((s, i) => <li key={i}>{s}</li>)}
          </ol>
        </div>
      </div>

      <div className="qset feedback__folds">
        <Fold index="→" question="A stronger version of your answer" open={open.has("stronger")} onToggle={() => toggle("stronger")}>
          <p className="feedback__stronger">{feedback.strongerAnswer}</p>
        </Fold>
        {question && (
          <Fold index="→" question="What the report suggested" open={open.has("report")} onToggle={() => toggle("report")}>
            <dl>
              <dt>Why they ask</dt>
              <dd>{question.intention}</dd>
              <dt>How to answer</dt>
              <dd>{question.suggestedAnswer}</dd>
            </dl>
          </Fold>
        )}
      </div>

      {(onRetry || onNext) && (
        <div className="feedback__actions">
          {onRetry && <button type="button" className="button secondary-button" onClick={onRetry}>Try again</button>}
          {onNext && <button type="button" className="button primary-button" onClick={onNext}>Next question →</button>}
        </div>
      )}
    </section>
  );
};

export default FeedbackPanel;
