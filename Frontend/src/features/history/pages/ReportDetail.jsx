import { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import AppSidebar from "../../../components/AppSidebar";
import ReportView from "../../ai/components/ReportView";
import { deleteReport, getReport } from "../../ai/services/interview.api";
import "../history.scss";

const ReportDetail = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const [report, setReport] = useState(null);
  const [error, setError] = useState(null);

  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let cancelled = false;
    getReport(id)
      .then((data) => {
        if (!cancelled) setReport(data.interviewReport);
      })
      .catch((err) => {
        if (!cancelled) setError(err.response?.status === 404 ? "missing" : "failed");
      });
    return () => {
      cancelled = true;
    };
  }, [id, attempt]);

  const load = () => {
    setError(null);
    setReport(null);
    setAttempt((n) => n + 1);
  };

  const practiseAgain = () =>
    navigate("/interview", { state: { jobDescription: report?.jobDescription || "" } });

  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState("");

  const remove = async () => {
    if (!window.confirm("Delete this report and its practice answers? This can't be undone.")) return;
    setDeleting(true);
    setDeleteError("");
    try {
      await deleteReport(id);
      navigate("/reports", { replace: true });
    } catch (err) {
      setDeleteError(err.response?.data?.message || "We couldn't delete this report. Try again.");
      setDeleting(false);
    }
  };

  return (
    <main className="workspace-page">
      <AppSidebar />

      <section className="workspace-main history">
        <div className="detail__bar">
          <Link className="text-link" to="/reports">← All reports</Link>
          {report && (
            <div className="detail__actions">
              <button type="button" className="button secondary-button" onClick={practiseAgain}>
                New report for this role
              </button>
              <button type="button" className="button danger-button" onClick={remove} disabled={deleting}>
                {deleting ? "Deleting…" : "Delete report"}
              </button>
            </div>
          )}
        </div>

        {deleteError && <p className="detail__error" role="alert">{deleteError}</p>}

        {!report && !error && <p className="page-loading page-loading--inline">opening your report…</p>}

        {error === "missing" && (
          <div className="history__empty">
            <p className="hand">This report doesn’t exist, or it belongs to another account.</p>
            <Link className="button primary-button" to="/reports">Back to your reports</Link>
          </div>
        )}

        {error === "failed" && (
          <div className="history__notice" role="alert">
            <p>
              <strong>We couldn’t load this report.</strong> If the site hasn’t been used for a while, the server may
              still be waking up.
            </p>
            <button type="button" className="button secondary-button" onClick={load}>Try again</button>
          </div>
        )}

        {report && <ReportView report={report} />}
      </section>
    </main>
  );
};

export default ReportDetail;
