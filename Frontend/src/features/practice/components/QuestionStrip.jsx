import { formatScore, scoreBand } from "../practice.utils";

/** All questions as chips: label plus best score, colored by how it went. */
const QuestionStrip = ({ questions, currentKey, onSelect }) => (
  <ol className="q-strip" aria-label="Questions">
    {questions.map((q) => (
      <li key={q.key}>
        <button
          type="button"
          className={`q-chip q-chip--${scoreBand(q.bestScore)} ${q.key === currentKey ? "is-current" : ""}`}
          aria-current={q.key === currentKey ? "true" : undefined}
          title={q.question}
          onClick={() => onSelect(q.key)}
        >
          <span className="q-chip__label">{q.label}</span>
          <span className="q-chip__score">{q.bestScore === null ? "–" : formatScore(q.bestScore)}</span>
        </button>
      </li>
    ))}
  </ol>
);

export default QuestionStrip;
