import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import Wordmark from "../../../components/Wordmark";
import ReportView from "../../ai/components/ReportView";
import { getSharedReport } from "../../ai/services/interview.api";
import "../share.scss";

// Shared links are private by intent: keep them out of search results.
const useNoIndex = () =>
  useEffect(() => {
    const meta = document.createElement("meta");
    meta.name = "robots";
    meta.content = "noindex, nofollow";
    document.head.appendChild(meta);
    return () => meta.remove();
  }, []);

/** A report opened through its read-only share link. No sign-in needed. */
const SharedReport = () => {
  const { token } = useParams();
  const [report, setReport] = useState(null);
  const [error, setError] = useState(null);
  useNoIndex();

  useEffect(() => {
    let cancelled = false;
    getSharedReport(token)
      .then((data) => {
        if (!cancelled) setReport(data.report);
      })
      .catch((err) => {
        if (!cancelled) setError(err.response?.status === 404 ? "missing" : "failed");
      });
    return () => {
      cancelled = true;
    };
  }, [token]);

  return (
    <main className="shared-page">
      <header className="shared-page__bar">
        <Wordmark />
        <p>
          <span className="shared-page__badge">Read-only</span> Shared from Interview Lab ·{" "}
          <Link className="text-link" to="/">Make your own</Link>
        </p>
      </header>

      <section className="shared-page__main">
        {!report && !error && <p className="page-loading page-loading--inline">opening the shared report…</p>}

        {error === "missing" && (
          <div className="shared-page__empty">
            <p className="hand">This link doesn’t work any more. The owner may have stopped sharing it.</p>
            <Link className="button primary-button" to="/">Go to Interview Lab</Link>
          </div>
        )}

        {error === "failed" && (
          <p className="shared-page__empty" role="alert">
            We couldn’t load this report. If the site hasn’t been used for a while, the server may still be waking up;
            try again in a minute.
          </p>
        )}

        {report && <ReportView report={report} eyebrow="Shared report" />}
      </section>
    </main>
  );
};

export default SharedReport;
