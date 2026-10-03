import { useCallback, useEffect, useRef, useState } from "react";
import { saveProgress } from "../services/interview.api";

const SAVE_DELAY = 600;

const read = (key) => {
  if (!key) return [];
  try {
    return JSON.parse(localStorage.getItem(key)) || [];
  } catch {
    return [];
  }
};

const SAVE_TEXT = { saving: "saving…", saved: "saved to your account" };

// The five-day plan as a checklist. Ticks are saved to the user's account (a
// moment after the last click) and cached in this browser as a fallback.
const PrepPlan = ({ plan = [], reportId, savedTasks }) => {
  const storageKey = reportId ? `plan:${reportId}` : null;

  // Reports from before progress was saved have no savedTasks field at all;
  // for those, start from this browser's ticks and copy them up once.
  const needsUpload = useRef(reportId && !Array.isArray(savedTasks) && read(storageKey).length > 0);
  const [done, setDone] = useState(() =>
    new Set(Array.isArray(savedTasks) ? savedTasks : read(storageKey))
  );
  const [saveState, setSaveState] = useState("idle");
  const pending = useRef(null);
  const timer = useRef(null);

  useEffect(() => {
    if (!storageKey) return;
    try {
      localStorage.setItem(storageKey, JSON.stringify([...done]));
    } catch {
      // storage blocked: the account copy still has the ticks
    }
  }, [done, storageKey]);

  const flush = useCallback(async () => {
    const ids = pending.current;
    if (!ids || !reportId) return;
    pending.current = null;
    try {
      await saveProgress(reportId, ids);
      if (!pending.current) setSaveState("saved");
    } catch {
      pending.current ??= ids;
      setSaveState("error");
    }
  }, [reportId]);

  const scheduleSave = (next) => {
    if (!reportId) return;
    pending.current = [...next];
    setSaveState("saving");
    clearTimeout(timer.current);
    timer.current = setTimeout(flush, SAVE_DELAY);
  };

  // One-time upload of browser-only ticks, and a last save if the page is
  // left before the debounce fires.
  useEffect(() => {
    if (needsUpload.current) {
      needsUpload.current = false;
      pending.current = read(storageKey);
      flush();
    }
    return () => {
      clearTimeout(timer.current);
      if (pending.current && reportId) saveProgress(reportId, pending.current).catch(() => {});
    };
  }, [flush, reportId, storageKey]);

  const update = (next) => {
    setDone(next);
    scheduleSave(next);
  };

  const toggle = (id) => {
    const next = new Set(done);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    update(next);
  };

  const retry = () => {
    pending.current = [...done];
    setSaveState("saving");
    flush();
  };

  const total = plan.reduce((sum, day) => sum + (day.tasks?.length || 0), 0);
  const count = plan.reduce(
    (sum, day, i) => sum + (day.tasks || []).filter((_, j) => done.has(`${i}-${j}`)).length,
    0
  );

  return (
    <div className="plan-board">
      <div className="plan-progress" aria-live="polite">
        <div className="plan-progress__bar">
          <span style={{ width: total ? `${(count / total) * 100}%` : 0 }} />
        </div>
        <p>
          <strong>{count}</strong> of {total} tasks done
          {count > 0 && (
            <button type="button" className="plan-progress__reset" onClick={() => update(new Set())}>
              reset
            </button>
          )}
        </p>
      </div>
      {saveState !== "idle" && (
        <p className={`plan-save plan-save--${saveState}`}>
          {saveState === "error" ? (
            <>
              couldn’t save to your account ·{" "}
              <button type="button" className="plan-progress__reset" onClick={retry}>retry</button>
            </>
          ) : (
            SAVE_TEXT[saveState]
          )}
        </p>
      )}

      <ol className="plan-days">
        {plan.map((day, i) => {
          const tasks = day.tasks || [];
          const complete = tasks.length > 0 && tasks.every((_, j) => done.has(`${i}-${j}`));
          return (
            <li key={`day-${i}`} className={`plan-day ${complete ? "is-complete" : ""}`}>
              <span className="plan-day__label">Day {day.day ?? i + 1}</span>
              <div>
                <h4>{day.focus}</h4>
                <ul>
                  {tasks.map((task, j) => {
                    const id = `${i}-${j}`;
                    return (
                      <li key={id}>
                        <label>
                          <input type="checkbox" checked={done.has(id)} onChange={() => toggle(id)} />
                          <span>{task}</span>
                        </label>
                      </li>
                    );
                  })}
                </ul>
              </div>
            </li>
          );
        })}
      </ol>
    </div>
  );
};

export default PrepPlan;
