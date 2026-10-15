import { useEffect, useMemo, useState } from "react";
import MarkupSheet from "../../../components/MarkupSheet";
import { markup } from "../../landing/markup";
import LiveSections from "./LiveSections";

// Shown while the AI works: the candidate's own job description being read,
// with the quick in-browser markup appearing as it goes, and an honest timer
// instead of a fake progress bar.
const ReadingSheet = ({ text, live }) => {
  const result = useMemo(() => markup(text), [text]);
  const [seconds, setSeconds] = useState(0);

  useEffect(() => {
    const started = Date.now();
    const timer = setInterval(() => setSeconds(Math.floor((Date.now() - started) / 1000)), 1000);
    return () => clearInterval(timer);
  }, []);

  return (
    <section className="reading" aria-live="polite" aria-busy="true">
      <div className="reading__status">
        <span className="reading__dot" aria-hidden="true" />
        <p>
          <strong>The AI is reading the role against your profile.</strong> Each part appears below as soon as it’s
          written; the full report opens when everything has been checked.
        </p>
        <span className="reading__timer">{seconds}s</span>
      </div>
      {live && <LiveSections sections={live.sections} attempt={live.attempt} />}
      <MarkupSheet
        result={result}
        className="sheet--scanning"
        label="While you wait · a first pass at your job description"
        emptyText="Nothing in our quick list matched. The AI reads the whole thing in context."
      />
    </section>
  );
};

export default ReadingSheet;
