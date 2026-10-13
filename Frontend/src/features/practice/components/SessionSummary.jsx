import { CRITERIA_LABELS, formatScore, questionName } from "../practice.utils";
import { PenDial } from "./FeedbackPanel";

const KIND_WORDS = { technical: "technical", behavioral: "behavioral" };

/** End-of-session recap: what was answered this visit and what to work on next. */
const SessionSummary = ({ summary, onContinue, onRedrill, weakCount }) => (
  <section className="session-summary" aria-labelledby="session-heading">
    <PenDial score={summary.average} caption="session average" />
    <div>
      <p className="eyebrow">Session done</p>
      <h3 id="session-heading">
        {summary.questions === summary.answered
          ? `You answered ${summary.answered} ${summary.answered === 1 ? "question" : "questions"}.`
          : `You gave ${summary.answered} answers across ${summary.questions} questions.`}
      </h3>
      <ul className="session-summary__facts">
        <li>
          Best: <strong>{questionName(summary.best)}</strong> at {formatScore(summary.best.score)}/10
        </li>
        {summary.worst && (
          <li>
            Lowest: <strong>{questionName(summary.worst)}</strong> at {formatScore(summary.worst.score)}/10
          </li>
        )}
        {summary.weakestKind && (
          <li>
            Weakest area: <strong>{KIND_WORDS[summary.weakestKind]}</strong> questions (
            {Object.entries(summary.kindAverages)
              .map(([kind, avg]) => `${KIND_WORDS[kind]} ${formatScore(avg)}`)
              .join(" vs ")}
            )
          </li>
        )}
        {summary.weakestCriterion && (
          <li>
            Work on next: <strong>{CRITERIA_LABELS[summary.weakestCriterion].toLowerCase()}</strong>
          </li>
        )}
      </ul>
      <div className="session-summary__actions">
        {weakCount > 0 && (
          <button type="button" className="button primary-button" onClick={onRedrill}>
            Re-drill weak ones ({weakCount})
          </button>
        )}
        <button type="button" className="button secondary-button" onClick={onContinue}>
          Keep practising
        </button>
      </div>
    </div>
  </section>
);

export default SessionSummary;
