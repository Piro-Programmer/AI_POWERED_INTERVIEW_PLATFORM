import { useEffect, useMemo, useState } from "react";
import MarkupSheet from "../../../components/MarkupSheet";
import { markup } from "../../landing/markup";

// Shown while Gemini works: the candidate's own job description being read,
// with the quick in-browser markup appearing as it goes, and an honest timer
// instead of a fake progress bar.
const ReadingSheet = ({ text }) => {
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
          <strong>Gemini is reading the role against your profile.</strong> It writes the questions, answers,
          gaps and plan in one go, so give it a minute or so.
        </p>
        <span className="reading__timer">{seconds}s</span>
      </div>
      <MarkupSheet
        result={result}
        className="sheet--scanning"
        label="While you wait · a first pass at your job description"
        emptyText="Nothing in our quick list matched. Gemini reads the whole thing in context."
      />
    </section>
  );
};

export default ReadingSheet;
