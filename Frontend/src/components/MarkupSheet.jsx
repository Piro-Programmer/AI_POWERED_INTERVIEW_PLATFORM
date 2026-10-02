import { useCallback, useLayoutEffect, useMemo, useRef, useState } from "react";
import "./markup-sheet.scss";

const KIND_LABEL = { skill: "Likely question", people: "Behavioral", signal: "Read between the lines", mine: "Your mark" };
const WIDE = "(min-width: 900px)";
const PEEK_WIDTH = 288;
const LINE = 14; // marks whose tops are within this many px count as one line

const delayFor = (order) => `${Math.min(350 + order * 110, 3200)}ms`;

const DEFAULT_LEGEND = [
  { kind: "skill", label: "skill" },
  { kind: "people", label: "people" },
  { kind: "signal", label: "subtext" },
];

const NoteBody = ({ kind, label, children }) => (
  <div>
    <span className="note__kind">{label ?? KIND_LABEL[kind]}</span>
    <p>{children}</p>
  </div>
);

// One job description, marked up: highlights in the text, numbered notes in the
// margin, and a hover note for marks that didn't make the margin. Remount it
// (key={text}) to replay the drawing animation.
const MarkupSheet = ({
  result,
  label,
  legend = DEFAULT_LEGEND,
  className = "",
  emptyText = "Nothing here matched our list. The full report doesn't rely on keywords — it reads the role in context.",
}) => {
  const { segments, notes } = result;
  const bodyRef = useRef(null);
  const notesRef = useRef(null);
  const [active, setActive] = useState(null);
  const [peek, setPeek] = useState(null);
  const [mine, setMine] = useState([]);

  const noteByKey = useMemo(() => new Map(notes.map((note) => [note.key, note])), [notes]);
  const marginNotes = useMemo(() => notes.filter((note) => note.n), [notes]);
  const firstOrder = useMemo(() => {
    const map = new Map();
    segments.forEach((seg) => {
      if (typeof seg !== "string" && seg.first) map.set(seg.key, seg.order);
    });
    return map;
  }, [segments]);

  // On wide screens each note sits level with its first highlight, pushed down
  // only as far as it needs to clear the note above. On narrow screens the
  // notes fall back to a normal list under the text.
  const layout = useCallback(() => {
    const body = bodyRef.current;
    const column = notesRef.current;
    if (!body || !column) return;

    const items = [...column.children];
    if (!window.matchMedia(WIDE).matches) {
      items.forEach((li) => {
        li.style.top = "";
      });
      column.style.minHeight = "";
      return;
    }

    const anchored = items.map((li, i) => {
      const fixed = li.dataset.top;
      const mark = fixed == null && body.querySelector(`mark[data-n="${li.dataset.n}"]`);
      return { li, i, anchor: fixed != null ? Number(fixed) : mark ? mark.offsetTop : 0 };
    });
    anchored.sort((a, b) => Math.round(a.anchor / LINE) - Math.round(b.anchor / LINE) || a.i - b.i);

    let floor = 0;
    anchored.forEach(({ li, anchor }) => {
      const top = Math.max(anchor - 2, floor);
      li.style.top = `${top}px`;
      floor = top + li.offsetHeight + 12;
    });
    column.style.minHeight = `${floor}px`;
  }, []);

  useLayoutEffect(() => {
    layout();
    const observer = new ResizeObserver(layout);
    observer.observe(bodyRef.current);
    document.fonts?.ready.then(layout);
    return () => observer.disconnect();
  }, [layout, mine]);

  const enterMark = (seg, el) => {
    setActive(seg.key);
    if (seg.n) {
      setPeek(null);
      return;
    }
    const maxLeft = Math.max(0, bodyRef.current.clientWidth - PEEK_WIDTH - 12);
    setPeek({ key: seg.key, top: el.offsetTop + el.offsetHeight + 4, left: Math.min(el.offsetLeft, maxLeft) });
  };

  const leaveMark = () => {
    setActive(null);
    setPeek(null);
  };

  // Readers can mark the sheet themselves: select a phrase, get a note.
  const handleSelect = () => {
    const selection = window.getSelection();
    if (!selection || selection.isCollapsed || !selection.rangeCount) return;
    const phrase = selection.toString().replace(/\s+/g, " ").trim();
    if (phrase.length < 3 || phrase.length > 80) return;

    const range = selection.getRangeAt(0);
    const body = bodyRef.current;
    if (!body.contains(range.commonAncestorContainer)) return;

    const top = range.getBoundingClientRect().top - body.getBoundingClientRect().top;
    setMine((prev) => [
      ...prev.filter((m) => m.phrase.toLowerCase() !== phrase.toLowerCase()).slice(-2),
      { id: `${phrase}-${prev.length}-${top}`, phrase, top },
    ]);
  };

  const peekNote = peek && noteByKey.get(peek.key);
  const extra = notes.length - marginNotes.length;

  return (
    <div className={`sheet ${className}`}>
      <div className="sheet__head">
        <span className="eyebrow">{label}</span>
        <span className="sheet__legend" aria-hidden="true">
          {legend.map((item) => (
            <span key={item.kind}><i className={`swatch swatch--${item.kind}`} /> {item.label}</span>
          ))}
        </span>
      </div>

      <div className="sheet__grid">
        <div
          className="sheet__body"
          ref={bodyRef}
          onMouseUp={handleSelect}
          onKeyUp={handleSelect}
          onTouchEnd={() => setTimeout(handleSelect, 0)}
        >
          {segments.map((seg, i) =>
            typeof seg === "string" ? (
              seg
            ) : (
              <mark
                key={i}
                data-n={seg.first && seg.n ? seg.n : undefined}
                className={[
                  "mk",
                  `mk--${seg.kind}`,
                  seg.first ? "" : "mk--repeat",
                  active === seg.key ? "is-active" : "",
                ].join(" ")}
                style={{ "--d": delayFor(seg.order) }}
                onMouseEnter={(e) => enterMark(seg, e.currentTarget)}
                onMouseLeave={leaveMark}
                onClick={(e) => enterMark(seg, e.currentTarget)}
              >
                {seg.text}
                {seg.first && seg.n && <sup>{seg.n}</sup>}
              </mark>
            )
          )}

          {peekNote && (
            <div className="peek" style={{ top: peek.top, left: peek.left, width: PEEK_WIDTH }} role="tooltip">
              <NoteBody kind={peekNote.kind} label={peekNote.label}>{peekNote.text}</NoteBody>
            </div>
          )}
        </div>

        <ol className="sheet__notes" ref={notesRef} aria-label="Margin notes">
          {marginNotes.map((note) => (
            <li
              key={note.key}
              data-n={note.n}
              className={`note note--${note.kind} ${active === note.key ? "is-active" : ""}`}
              style={{ "--d": delayFor((firstOrder.get(note.key) ?? 0) + 1.5) }}
              onMouseEnter={() => setActive(note.key)}
              onMouseLeave={() => setActive(null)}
            >
              <span className="note__n">{note.n}</span>
              <NoteBody kind={note.kind} label={note.label}>{note.text}</NoteBody>
            </li>
          ))}
          {mine.map((m) => (
            <li key={m.id} data-top={m.top} className="note note--mine">
              <span className="note__n">✎</span>
              <NoteBody kind="mine">
                “{m.phrase}” — expect them to ask for one real example of this. Draft it in two sentences.
              </NoteBody>
            </li>
          ))}
        </ol>
      </div>

      {notes.length === 0 ? (
        <p className="sheet__empty">{emptyText}</p>
      ) : (
        extra > 0 && (
          <p className="sheet__more">
            + {extra} more {extra === 1 ? "mark" : "marks"} without a margin note. Hover one to read it.
          </p>
        )
      )}
    </div>
  );
};

export default MarkupSheet;
