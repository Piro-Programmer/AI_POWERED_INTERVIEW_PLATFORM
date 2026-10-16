// The report's parts, filled in as the AI finishes each one. A preview only:
// the saved report replaces it when everything has been checked.
const PARTS = [
  { key: "matchScore", label: "Match score" },
  { key: "technicalQuestions", label: "Technical questions" },
  { key: "behavioralQuestions", label: "Behavioral questions" },
  { key: "skillGaps", label: "Skill gaps" },
  { key: "preparationPlan", label: "Preparation plan" }
];

const preview = (key, value) => {
  if (key === "matchScore") return <strong className="live__score">{Math.round(Number(value) || 0)}</strong>;
  if (!Array.isArray(value)) return null;
  if (key === "skillGaps") {
    return (
      <ul className="live__gaps">
        {value.map((g, i) => (
          <li key={i} className={`gap-tag gap-tag--${g.severity}`}>{g.skill}</li>
        ))}
      </ul>
    );
  }
  const lines = key === "preparationPlan" ? value.map((d, i) => `Day ${d.day ?? i + 1}: ${d.focus}`) : value.map((q) => q.question);
  return (
    <ol className="live__lines">
      {lines.map((line, i) => (
        <li key={i}>{line}</li>
      ))}
    </ol>
  );
};

const LiveSections = ({ sections, attempt }) => {
  const done = PARTS.filter((p) => p.key in sections).length;

  return (
    <section className="live" aria-label="Report progress">
      <p className="live__count" aria-live="polite">
        {done} of {PARTS.length} parts written
        {attempt > 1 && <span className="live__retry"> · the first draft didn’t check out, so the AI is writing it again</span>}
      </p>
      <ol className="live__parts">
        {PARTS.map(({ key, label }) => {
          const ready = key in sections;
          return (
            <li key={key} className={ready ? "is-ready" : ""}>
              <span className="live__mark" aria-hidden="true">{ready ? "✓" : ""}</span>
              <div>
                <span className="live__label">
                  {label}
                  <span className="sr-only">{ready ? " (done)" : " (writing)"}</span>
                </span>
                {ready && preview(key, sections[key])}
              </div>
            </li>
          );
        })}
      </ol>
    </section>
  );
};

export default LiveSections;
