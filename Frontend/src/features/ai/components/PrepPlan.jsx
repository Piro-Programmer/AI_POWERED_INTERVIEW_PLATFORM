import { useEffect, useState } from "react";

const read = (key) => {
  if (!key) return [];
  try {
    return JSON.parse(localStorage.getItem(key)) || [];
  } catch {
    return [];
  }
};

// The five-day plan as a checklist. Ticks are remembered in this browser only.
const PrepPlan = ({ plan = [], storageKey }) => {
  const [done, setDone] = useState(() => new Set(read(storageKey)));

  useEffect(() => {
    if (!storageKey) return;
    try {
      localStorage.setItem(storageKey, JSON.stringify([...done]));
    } catch {
      // storage blocked: ticks just won't survive a reload
    }
  }, [done, storageKey]);

  const toggle = (id) =>
    setDone((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

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
            <button type="button" className="plan-progress__reset" onClick={() => setDone(new Set())}>
              reset
            </button>
          )}
        </p>
      </div>

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
