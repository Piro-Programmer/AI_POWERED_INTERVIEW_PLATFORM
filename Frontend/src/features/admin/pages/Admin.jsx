import { useCallback, useEffect, useRef, useState } from "react";
import AppSidebar from "../../../components/AppSidebar";
import { useAuth } from "../../auth/hooks/useAuth";
import { formatDate } from "../../history/history.utils";
import { deleteUser, getAdminStats, getAuditLog, listUsers } from "../admin.api";
import "../admin.scss";

const errorMessage = (err, fallback) => err?.response?.data?.message || fallback;
const number = (n) => (typeof n === "number" ? n.toLocaleString() : "–");
const percent = (used, limit) => (limit ? Math.min(100, Math.round((used / limit) * 100)) : 0);

const Meter = ({ label, used, limit }) => (
  <div className="admin-meter">
    <div className="admin-meter__label">
      <span>{label}</span>
      <span>
        {number(used)} / {number(limit)}
      </span>
    </div>
    <span className="admin-meter__track" aria-hidden="true">
      <span style={{ width: `${percent(used, limit)}%` }} />
    </span>
  </div>
);

const Stats = ({ stats }) => (
  <section className="admin-stats" aria-label="Site totals">
    <div className="admin-card">
      <span className="eyebrow">Users</span>
      <strong>{number(stats.users.total)}</strong>
      <small>+{number(stats.users.last7Days)} this week · {number(stats.users.admins)} admin</small>
    </div>
    <div className="admin-card">
      <span className="eyebrow">Reports</span>
      <strong>{number(stats.reports.total)}</strong>
      <small>+{number(stats.reports.last7Days)} this week · {number(stats.reports.shared)} shared</small>
    </div>
    <div className="admin-card">
      <span className="eyebrow">Practice answers</span>
      <strong>{number(stats.practiceAttempts.total)}</strong>
    </div>
    <div className="admin-card admin-card--wide">
      <span className="eyebrow">AI usage, whole site</span>
      <Meter label="Tokens this minute" used={stats.ai.minute.tokens} limit={stats.ai.minute.tokenLimit} />
      <Meter label="Tokens today" used={stats.ai.day.tokens} limit={stats.ai.day.tokenLimit} />
      <Meter label="Requests today" used={stats.ai.day.requests} limit={stats.ai.day.requestLimit} />
    </div>
  </section>
);

const Admin = () => {
  const { user } = useAuth();
  const isAdmin = user?.role === "admin";

  const [stats, setStats] = useState(null);
  const [audit, setAudit] = useState([]);
  const [users, setUsers] = useState(null);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(false);
  const [query, setQuery] = useState("");
  const [q, setQ] = useState("");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [busyId, setBusyId] = useState(null);
  const latest = useRef(0);

  // search once typing pauses
  useEffect(() => {
    const timer = setTimeout(() => setQ(query.trim()), 300);
    return () => clearTimeout(timer);
  }, [query]);

  const loadOverview = useCallback(() => {
    Promise.all([getAdminStats(), getAuditLog()])
      .then(([s, a]) => {
        setStats(s);
        setAudit(a.entries || []);
      })
      .catch((err) => setError(errorMessage(err, "Couldn't load the admin overview.")));
  }, []);

  const loadUsers = useCallback(
    async (pageToLoad) => {
      const request = ++latest.current;
      try {
        const data = await listUsers({ page: pageToLoad, q });
        if (request !== latest.current) return;
        setUsers((prev) => (pageToLoad === 1 || !prev ? data.users : [...prev, ...data.users]));
        setTotal(data.total);
        setPage(pageToLoad);
        setHasMore(data.hasMore);
      } catch (err) {
        if (request === latest.current) setError(errorMessage(err, "Couldn't load users."));
      }
    },
    [q]
  );

  useEffect(() => {
    if (isAdmin) loadOverview();
  }, [isAdmin, loadOverview]);

  useEffect(() => {
    if (isAdmin) loadUsers(1);
  }, [isAdmin, loadUsers]);

  const remove = async (target) => {
    const ok = window.confirm(
      `Delete ${target.username} (${target.email}), their ${target.reportCount} reports and ${target.practiceCount} practice answers? This can't be undone.`
    );
    if (!ok) return;
    setBusyId(target._id);
    setError("");
    setNotice("");
    try {
      const data = await deleteUser(target._id);
      setNotice(data.message);
      setUsers((prev) => prev.filter((u) => u._id !== target._id));
      setTotal((n) => n - 1);
      loadOverview();
    } catch (err) {
      setError(errorMessage(err, "Couldn't delete that user."));
    } finally {
      setBusyId(null);
    }
  };

  if (!isAdmin) {
    return (
      <main className="workspace-page">
        <AppSidebar />
        <section className="workspace-main">
          <p className="hand">This page is for admins only.</p>
        </section>
      </main>
    );
  }

  return (
    <main className="workspace-page">
      <AppSidebar />

      <section className="workspace-main admin">
        <header className="admin__head">
          <p className="eyebrow">Admin</p>
          <h2>The whole site at a glance.</h2>
        </header>

        {error && <p className="auth-error" role="alert">{error}</p>}
        {notice && <p className="admin__notice" role="status">{notice}</p>}

        {stats ? <Stats stats={stats} /> : !error && <p className="page-loading page-loading--inline">counting…</p>}

        <section className="admin__section" aria-labelledby="users-heading">
          <div className="admin__section-head">
            <h3 id="users-heading">Users {users && <small>({number(total)})</small>}</h3>
            <label className="admin__search">
              <span className="sr-only">Search users</span>
              <input type="search" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Username or email" />
            </label>
          </div>

          {users && users.length === 0 && <p className="admin__empty">No users match that.</p>}

          {users && users.length > 0 && (
            <div className="admin-table__wrap">
              <table className="admin-table">
                <thead>
                  <tr>
                    <th scope="col">User</th>
                    <th scope="col">Joined</th>
                    <th scope="col">Reports</th>
                    <th scope="col">Practice</th>
                    <th scope="col"><span className="sr-only">Actions</span></th>
                  </tr>
                </thead>
                <tbody>
                  {users.map((u) => (
                    <tr key={u._id}>
                      <td>
                        <strong>{u.username}</strong>
                        {u.role === "admin" && <span className="admin-badge">admin</span>}
                        <small>{u.email}</small>
                      </td>
                      <td>{formatDate(u.joinedAt)}</td>
                      <td>{number(u.reportCount)}</td>
                      <td>{number(u.practiceCount)}</td>
                      <td>
                        {u.role !== "admin" && String(u._id) !== String(user.id) && (
                          <button
                            type="button"
                            className="button danger-button admin-table__delete"
                            onClick={() => remove(u)}
                            disabled={busyId === u._id}
                          >
                            {busyId === u._id ? "Deleting…" : "Delete"}
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {hasMore && (
            <button type="button" className="button secondary-button admin__more" onClick={() => loadUsers(page + 1)}>
              Load more
            </button>
          )}
        </section>

        <section className="admin__section" aria-labelledby="audit-heading">
          <h3 id="audit-heading">Audit log</h3>
          {audit.length === 0 ? (
            <p className="admin__empty">No admin actions yet.</p>
          ) : (
            <ol className="admin-audit">
              {audit.map((e) => (
                <li key={e._id}>
                  <time dateTime={e.createdAt}>{new Date(e.createdAt).toLocaleString()}</time>
                  <span>
                    <strong>{e.adminName || "admin"}</strong> deleted <strong>{e.details?.username}</strong> ({e.details?.email}) with{" "}
                    {e.details?.reportCount ?? 0} reports and {e.details?.practiceCount ?? 0} practice answers
                  </span>
                </li>
              ))}
            </ol>
          )}
        </section>
      </section>
    </main>
  );
};

export default Admin;
