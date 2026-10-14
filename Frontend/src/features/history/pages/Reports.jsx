import { useCallback, useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import AppSidebar from "../../../components/AppSidebar";
import { getMyReports } from "../../ai/services/interview.api";
import { cleanTitle, firstLine, formatDate, planDone, planStatus } from "../history.utils";
import "../history.scss";

const FILTERS = [
  { id: "all", label: "All" },
  { id: "not-started", label: "Not started" },
  { id: "in-progress", label: "In progress" },
  { id: "done", label: "Plan done" },
];

const STATUS_TEXT = { "not-started": "plan not started", "in-progress": "plan in progress", done: "plan done" };

// Small pen loop drawn as far as the score, like the report's big dial.
const MiniDial = ({ score }) => {
  const value = Math.max(0, Math.min(100, Math.round(Number(score) || 0)));
  return (
    <div className="mini-dial" aria-label={`Match score ${value} out of 100`}>
      <svg viewBox="0 0 120 80" preserveAspectRatio="none" aria-hidden="true">
        <path
          className="mini-dial__track"
          pathLength="1"
          d="M60 6 C 104 6, 116 28, 114 42 C 110 66, 82 75, 58 74 C 28 73, 6 62, 7 40 C 8 19, 32 6, 60 6"
        />
        <path
          className="mini-dial__stroke"
          pathLength="1"
          style={{ "--gap": 1 - value / 100 }}
          d="M60 6 C 104 6, 116 28, 114 42 C 110 66, 82 75, 58 74 C 28 73, 6 62, 7 40 C 8 19, 32 6, 60 6"
        />
      </svg>
      <span>{value}</span>
    </div>
  );
};

const SkeletonRows = () => (
  <ol className="ledger" aria-hidden="true">
    {[0, 1, 2].map((i) => (
      <li key={i} className="ledger__row ledger__row--skeleton">
        <span className="skeleton skeleton--dial" />
        <div>
          <span className="skeleton skeleton--short" />
          <span className="skeleton skeleton--title" />
          <span className="skeleton skeleton--line" />
        </div>
      </li>
    ))}
  </ol>
);

const PAGE_SIZE = 20;

// Account progress when the report has it; older reports fall back to this browser.
const withProgress = (r) => {
  const done = Math.min(r.completedCount ?? planDone(r._id), r.planTaskCount || 0);
  return { ...r, done, status: planStatus(done, r.planTaskCount || 0) };
};

/** `value`, but only once it has stopped changing for `ms`. */
const useDebounced = (value, ms) => {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), ms);
    return () => clearTimeout(timer);
  }, [value, ms]);
  return debounced;
};

const Reports = () => {
  const [items, setItems] = useState(null); // null until the first page arrives
  const [stats, setStats] = useState(null);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [query, setQuery] = useState("");
  const [sort, setSort] = useState("newest");
  const [filter, setFilter] = useState("all");
  const [attempt, setAttempt] = useState(0);

  const q = useDebounced(query.trim(), 300);
  const latest = useRef(0); // only the newest request may update the list

  const fetchPage = useCallback(
    async (pageToLoad) => {
      const request = ++latest.current;
      setLoading(true);
      setError("");
      try {
        const data = await getMyReports({
          page: pageToLoad,
          limit: PAGE_SIZE,
          sort,
          q: q || undefined,
          status: filter === "all" ? undefined : filter
        });
        if (request !== latest.current) return;
        const rows = (data.reports || []).map(withProgress);
        setItems((prev) => (pageToLoad === 1 || !prev ? rows : [...prev, ...rows]));
        setStats(data.stats || null);
        setTotal(data.total ?? rows.length);
        setPage(pageToLoad);
        setHasMore(Boolean(data.hasMore));
      } catch (err) {
        if (request === latest.current) setError(err.response?.data?.message || "We couldn't load your reports.");
      } finally {
        if (request === latest.current) setLoading(false);
      }
    },
    [sort, q, filter]
  );

  // A new search, sort or filter starts again from page 1
  useEffect(() => {
    fetchPage(1);
  }, [fetchPage, attempt]);

  const load = () => {
    setItems(null);
    setAttempt((n) => n + 1);
  };

  const hasAny = (stats?.count || 0) > 0;
  const visible = items || [];

  return (
    <main className="workspace-page">
      <AppSidebar />

      <section className="workspace-main history">
        <header className="history__head">
          <div>
            <p className="eyebrow">Your reports</p>
            <h2>Every job you’ve prepped for.</h2>
            {hasAny && (
              <p className="history__stats">
                {stats.count} {stats.count === 1 ? "report" : "reports"}
                {stats.average !== null && <> · average match <strong>{stats.average}</strong></>}
                {stats.best !== null && <> · best <strong>{stats.best}</strong></>}
              </p>
            )}
          </div>
          <Link className="button primary-button" to="/interview">New report</Link>
        </header>

        {hasAny && (
          <div className="history__tools">
            <label className="history__search">
              <span className="eyebrow">Search</span>
              <input
                type="search"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Role, company or skill"
              />
            </label>
            <label className="history__sort">
              <span className="eyebrow">Sort</span>
              <select value={sort} onChange={(e) => setSort(e.target.value)}>
                <option value="newest">Newest first</option>
                <option value="oldest">Oldest first</option>
                <option value="high">Highest match</option>
                <option value="low">Lowest match</option>
              </select>
            </label>
            <div className="history__filters" role="group" aria-label="Filter by plan progress">
              {FILTERS.map((f) => (
                <button
                  key={f.id}
                  type="button"
                  className={`chip ${filter === f.id ? "is-on" : ""}`}
                  aria-pressed={filter === f.id}
                  onClick={() => setFilter(f.id)}
                >
                  {f.label}
                </button>
              ))}
            </div>
          </div>
        )}

        {error && (
          <div className="history__notice" role="alert">
            <p>
              <strong>{error}</strong> If the site hasn’t been used for a while, the server may still be waking up.
            </p>
            <button type="button" className="button secondary-button" onClick={load}>Try again</button>
          </div>
        )}

        {!error && items === null && <SkeletonRows />}

        {stats && !hasAny && (
          <div className="history__empty">
            <p className="hand">Nothing here yet. Your first report is one job description away.</p>
            <Link className="button primary-button" to="/interview">Create your first report</Link>
          </div>
        )}

        {hasAny && items !== null && !loading && visible.length === 0 && (
          <p className="history__none">No reports match that. Try a different search or filter.</p>
        )}

        {visible.length > 0 && (
          <ol className="ledger">
            {visible.map((r) => {
              const total = r.planTaskCount || 0;
              return (
                <li key={r._id}>
                  <Link className="ledger__row" to={`/reports/${r._id}`}>
                    <MiniDial score={r.matchScore} />
                    <div className="ledger__main">
                      <span className="eyebrow">{formatDate(r.createdAt)}</span>
                      <h3>{cleanTitle(r.title)}</h3>
                      <p className="ledger__jd">{firstLine(r.jobDescription)}</p>
                      {r.skillGaps.length > 0 && (
                        <ul className="ledger__gaps" aria-label="Skill gaps">
                          {r.skillGaps.slice(0, 3).map((g, i) => (
                            <li key={i} className={`gap-tag gap-tag--${g.severity}`}>{g.skill}</li>
                          ))}
                          {r.skillGaps.length > 3 && <li className="gap-tag gap-tag--more">+{r.skillGaps.length - 3}</li>}
                        </ul>
                      )}
                    </div>
                    <div className="ledger__meta">
                      <p>
                        {r.technicalCount} technical · {r.behavioralCount} behavioral · {r.skillGaps.length} gaps
                      </p>
                      <div className={`ledger__progress ledger__progress--${r.status}`}>
                        <span className="ledger__bar">
                          <span style={{ width: total ? `${(r.done / total) * 100}%` : 0 }} />
                        </span>
                        <small>
                          {r.status === "not-started" ? STATUS_TEXT[r.status] : `${r.done} of ${total} tasks · ${STATUS_TEXT[r.status]}`}
                        </small>
                      </div>
                    </div>
                  </Link>
                </li>
              );
            })}
          </ol>
        )}

        {items !== null && visible.length > 0 && (
          <div className="history__more">
            <p>
              Showing {visible.length} of {total}
            </p>
            {hasMore && (
              <button type="button" className="button secondary-button" onClick={() => fetchPage(page + 1)} disabled={loading}>
                {loading ? "Loading…" : "Load more"}
              </button>
            )}
          </div>
        )}
      </section>
    </main>
  );
};

export default Reports;
