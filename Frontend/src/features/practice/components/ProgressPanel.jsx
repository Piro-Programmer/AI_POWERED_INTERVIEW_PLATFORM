import { CRITERIA_LABELS, formatScore, scoreBand } from "../practice.utils";

const KIND_LABELS = { technical: "Technical", behavioral: "Behavioral" };

const W = 320;
const H = 120;
const PAD = { top: 10, right: 12, bottom: 22, left: 26 };

const shortDay = (day) =>
  new Date(`${day}T00:00:00Z`).toLocaleDateString([], { month: "short", day: "numeric", timeZone: "UTC" });

/** Daily average score (0-10) as a pen line, one point per practice day. */
export const TrendChart = ({ trend }) => {
  const innerW = W - PAD.left - PAD.right;
  const innerH = H - PAD.top - PAD.bottom;
  const x = (i) => PAD.left + (trend.length === 1 ? innerW / 2 : (i / (trend.length - 1)) * innerW);
  const y = (score) => PAD.top + innerH - (score / 10) * innerH;
  const points = trend.map((d, i) => `${x(i).toFixed(1)},${y(d.average).toFixed(1)}`).join(" ");

  const first = trend[0];
  const last = trend[trend.length - 1];
  const label =
    trend.length === 1
      ? `Average score ${formatScore(first.average)} out of 10 on ${shortDay(first.day)}`
      : `Average score went from ${formatScore(first.average)} on ${shortDay(first.day)} to ${formatScore(last.average)} on ${shortDay(last.day)}, over ${trend.length} practice days`;

  return (
    <svg className="trend" viewBox={`0 0 ${W} ${H}`} role="img" aria-label={label}>
      {[0, 5, 10].map((tick) => (
        <g key={tick}>
          <line className="trend__grid" x1={PAD.left} x2={W - PAD.right} y1={y(tick)} y2={y(tick)} />
          <text className="trend__tick" x={PAD.left - 6} y={y(tick) + 3} textAnchor="end">{tick}</text>
        </g>
      ))}
      {/* the "re-drill" line: below this an answer counts as weak */}
      <line className="trend__weak" x1={PAD.left} x2={W - PAD.right} y1={y(6)} y2={y(6)} />
      {trend.length > 1 && <polyline className="trend__line" points={points} />}
      {trend.map((d, i) => (
        <circle key={d.day} className={`trend__dot trend__dot--${scoreBand(d.average)}`} cx={x(i)} cy={y(d.average)} r="3.5">
          <title>{`${shortDay(d.day)}: ${formatScore(d.average)}/10 over ${d.attempts} ${d.attempts === 1 ? "answer" : "answers"}`}</title>
        </circle>
      ))}
      <text className="trend__tick" x={x(0)} y={H - 6} textAnchor={trend.length === 1 ? "middle" : "start"}>
        {shortDay(first.day)}
      </text>
      {trend.length > 1 && (
        <text className="trend__tick" x={x(trend.length - 1)} y={H - 6} textAnchor="end">{shortDay(last.day)}</text>
      )}
    </svg>
  );
};

/** Bars for each criterion's average (1-5), the weakest one marked. */
export const CriteriaBars = ({ criteria, weakest }) => (
  <ul className="criteria-bars">
    {Object.entries(CRITERIA_LABELS)
      .filter(([key]) => typeof criteria[key] === "number")
      .map(([key, label]) => (
        <li key={key} className={key === weakest ? "is-weakest" : ""}>
          <span>
            {label}
            {key === weakest && <em>work on this</em>}
          </span>
          <span className="criteria-bars__track" aria-hidden="true">
            <span style={{ width: `${(criteria[key] / 5) * 100}%` }} />
          </span>
          <strong>{formatScore(criteria[key])}<small>/5</small></strong>
        </li>
      ))}
  </ul>
);

/** All-time practice progress for one report (from /practice/progress). */
const ProgressPanel = ({ progress }) => {
  if (!progress?.attempts) return null;
  const { attempts, average, byKind, criteria, weakest, trend } = progress;

  return (
    <section className="progress-panel" aria-labelledby="progress-heading">
      <div className="progress-panel__head">
        <p className="eyebrow">Progress over time</p>
        <h3 id="progress-heading">
          {attempts} {attempts === 1 ? "answer" : "answers"} reviewed · average <strong>{formatScore(average)}</strong>/10
        </h3>
        <p className="progress-panel__kinds">
          {Object.entries(byKind).map(([kind, k]) => (
            <span key={kind} className={kind === weakest?.kind ? "is-weakest" : ""}>
              {KIND_LABELS[kind] || kind} {formatScore(k.average)} <small>({k.attempts})</small>
            </span>
          ))}
        </p>
      </div>
      <div className="progress-panel__body">
        {trend.length > 0 && (
          <figure>
            <figcaption className="eyebrow">Daily average, last 30 days</figcaption>
            <TrendChart trend={trend} />
          </figure>
        )}
        <figure>
          <figcaption className="eyebrow">By criterion</figcaption>
          <CriteriaBars criteria={criteria} weakest={weakest?.criterion} />
        </figure>
      </div>
    </section>
  );
};

export default ProgressPanel;
