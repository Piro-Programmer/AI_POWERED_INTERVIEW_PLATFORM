import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import MarkupSheet from "./MarkupSheet";
import { markup } from "../markup";
import { SAMPLES } from "../samples";

const MAX_CHARS = 6000;
const plural = (count, word) => `${count} ${word}${count === 1 ? "" : "s"}`;

const LiveMarkup = ({ ctaTo }) => {
  const [tab, setTab] = useState(SAMPLES[0].id);
  const [draft, setDraft] = useState("");
  const [own, setOwn] = useState("");

  const sample = SAMPLES.find((s) => s.id === tab);
  const text = sample ? sample.text : own;
  const result = useMemo(() => markup(text), [text]);
  const editing = !sample && !own;

  const tabs = [...SAMPLES.map((s) => ({ id: s.id, label: s.label })), { id: "own", label: "Paste your own" }];

  return (
    <div className="live">
      <div className="live__tabs" role="tablist" aria-label="Job description to mark up">
        {tabs.map((t) => (
          <button
            key={t.id}
            role="tab"
            type="button"
            aria-selected={tab === t.id}
            className={`live__tab ${tab === t.id ? "is-on" : ""} ${t.id === "own" ? "live__tab--own" : ""}`}
            onClick={() => setTab(t.id)}
          >
            {t.label}
          </button>
        ))}
      </div>

      {editing ? (
        <form
          className="sheet sheet--paste"
          onSubmit={(e) => {
            e.preventDefault();
            if (draft.trim()) setOwn(draft.trim());
          }}
        >
          <div className="sheet__head">
            <span className="eyebrow">Your job description</span>
            <span className="eyebrow">{draft.length} / {MAX_CHARS}</span>
          </div>
          <textarea
            className="paste-box"
            value={draft}
            maxLength={MAX_CHARS}
            onChange={(e) => setDraft(e.target.value)}
            placeholder="Paste the job description you're applying for. It stays in your browser."
            rows={10}
            autoFocus
          />
          <div className="paste-actions">
            <button className="button primary-button" disabled={!draft.trim()}>
              Mark it up
            </button>
            <span className="hand-note">nothing gets sent anywhere</span>
          </div>
        </form>
      ) : (
        <>
          <MarkupSheet
            key={text}
            result={result}
            label={sample ? `Job description · ${sample.label}, ${sample.company}` : "Job description · yours"}
          />
          {!sample && (
            <button type="button" className="ghost-button live__repaste" onClick={() => setOwn("")}>
              Edit or paste a different one
            </button>
          )}
        </>
      )}

      {!editing && (
        <div className="live__tally">
          <p>
            <strong>{plural(result.tally.skill, "skill")}</strong> to prep ·{" "}
            <strong>{plural(result.tally.people, "behavioral prompt")}</strong> ·{" "}
            <strong>{plural(result.tally.signal, "line")}</strong> worth reading twice
          </p>
          <Link className="text-link" to={ctaTo}>
            Get the full report: answers, gaps and a 5-day plan →
          </Link>
        </div>
      )}

      <p className="live__fineprint">
        This preview is simple keyword matching, so it’s instant and runs entirely in your browser. Select any
        phrase on the page to add your own mark. The full report reads your resume against the role with Gemini.
      </p>
    </div>
  );
};

export default LiveMarkup;
