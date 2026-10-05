import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import MarkupSheet from "../../../components/MarkupSheet";
import { gapMarkup } from "../gapMarkup";
import ScoreDial from "./ScoreDial";
import Fold from "./Fold";
import PrepPlan from "./PrepPlan";
import "../report.scss";

const GAP_LEGEND = [
  { kind: "gap-high", label: "high" },
  { kind: "gap-medium", label: "medium" },
  { kind: "gap-low", label: "low" },
];

const cleanTitle = (title = "") => title.replace(/^Interview Report\s*-\s*/i, "").trim() || "Interview report";

const formatDate = (value) => {
  const date = value ? new Date(value) : null;
  return date && !Number.isNaN(date.getTime())
    ? date.toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" })
    : null;
};

const QuestionSet = ({ items = [], prefix, open, setOpen }) => {
  const keys = items.map((_, i) => `${prefix}-${i}`);
  const allOpen = keys.length > 0 && keys.every((k) => open.has(k));

  const toggle = (key) =>
    setOpen((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });

  const toggleAll = () =>
    setOpen((prev) => {
      const next = new Set(prev);
      keys.forEach((k) => (allOpen ? next.delete(k) : next.add(k)));
      return next;
    });

  return (
    <>
      <div className="qset__bar">
        <p className="hand">Answer each one out loud before you open it.</p>
        <button type="button" className="qset__all" onClick={toggleAll}>
          {allOpen ? "Fold all" : "Open all"}
        </button>
      </div>
      <div className="qset">
        {items.map((q, i) => (
          <Fold
            key={keys[i]}
            index={String(i + 1).padStart(2, "0")}
            question={q.question}
            open={open.has(keys[i])}
            onToggle={() => toggle(keys[i])}
          >
            <dl>
              <dt>Why they ask</dt>
              <dd>{q.intention}</dd>
              <dt>How to answer</dt>
              <dd>{q.answer}</dd>
            </dl>
          </Fold>
        ))}
      </div>
    </>
  );
};

const ReportView = ({ report }) => {
  const [open, setOpen] = useState(() => new Set());

  const gaps = useMemo(
    () => gapMarkup(report.jobDescription, report.skillGaps, report.preparationPlan),
    [report.jobDescription, report.skillGaps, report.preparationPlan]
  );

  const technical = report.technicalQuestions || [];
  const behavioral = report.behavioralQuestions || [];
  const plan = report.preparationPlan || [];
  const date = formatDate(report.createdAt);

  return (
    <section className="report" id="report">
      <header className="report__hero">
        <div>
          <p className="eyebrow">Your report{date ? ` · ${date}` : ""}</p>
          <h2>{cleanTitle(report.title)}</h2>
          <p className="report__summary">
            {technical.length} technical and {behavioral.length} behavioral questions,{" "}
            {report.skillGaps?.length || 0} gaps to close, and a {plan.length}-day plan.
          </p>
          <nav className="report__jump" aria-label="Report sections">
            <a href="#gaps">Gaps</a>
            <a href="#technical">Technical</a>
            <a href="#behavioral">Behavioral</a>
            <a href="#prep-plan">Plan</a>
          </nav>
          {report._id && (
            <Link className="button primary-button report__practice" to={`/reports/${report._id}/practice`}>
              Practise these questions →
            </Link>
          )}
        </div>
        <ScoreDial score={report.matchScore} />
      </header>

      <section className="report__section" id="gaps">
        <div className="report__head">
          <p className="eyebrow">01 · Where you’re thin</p>
          <h3>Your gaps, marked on the posting itself.</h3>
        </div>
        {report.jobDescription ? (
          <MarkupSheet
            key={report._id || report.jobDescription}
            result={gaps}
            legend={GAP_LEGEND}
            label="The job description you pasted"
            emptyText="None of your gaps are named word for word in the posting. They’re listed below."
          />
        ) : null}
        {gaps.unmatched.length > 0 && (
          <div className="gap-extra">
            <p className="eyebrow">Not named in the posting, but implied by it</p>
            <ul>
              {gaps.unmatched.map((note) => (
                <li key={note.key} className={`gap-extra__item gap-extra__item--${note.severity}`}>
                  <span className="gap-extra__skill">{note.skill}</span>
                  <span className="gap-extra__sev">{note.severity}</span>
                  <p>{note.text}</p>
                </li>
              ))}
            </ul>
          </div>
        )}
      </section>

      <section className="report__section" id="technical">
        <div className="report__head">
          <p className="eyebrow">02 · Technical</p>
          <h3>What they’ll ask about the work.</h3>
        </div>
        <QuestionSet items={technical} prefix="tech" open={open} setOpen={setOpen} />
      </section>

      <section className="report__section" id="behavioral">
        <div className="report__head">
          <p className="eyebrow">03 · Behavioral</p>
          <h3>What they’ll ask about you.</h3>
        </div>
        <QuestionSet items={behavioral} prefix="beh" open={open} setOpen={setOpen} />
      </section>

      <section className="report__section" id="prep-plan">
        <div className="report__head">
          <p className="eyebrow">04 · The plan</p>
          <h3>{plan.length} evenings, one focus each.</h3>
        </div>
        <PrepPlan plan={plan} reportId={report._id} savedTasks={report.completedTasks} />
      </section>
    </section>
  );
};

export default ReportView;
