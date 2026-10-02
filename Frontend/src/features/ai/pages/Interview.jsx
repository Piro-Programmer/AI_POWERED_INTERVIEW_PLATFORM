import React, { useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { generateReport } from "../services/interview.api";
import "../interview.scss";
import Wordmark from "../../../components/Wordmark";
import ReadingSheet from "../components/ReadingSheet";
import ReportView from "../components/ReportView";

const Interview = () => {
  const [resume, setResume] = useState(null);
  const [selfDescription, setSelfDescription] = useState("");
  const [jobDescription, setJobDescription] = useState("");

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [report, setReport] = useState(null);
  const [submittedJD, setSubmittedJD] = useState("");
  const outputRef = useRef(null);

  const inputStats = useMemo(() => {
    const jdWords = jobDescription.trim() ? jobDescription.trim().split(/\s+/).length : 0;
    const profileWords = selfDescription.trim() ? selfDescription.trim().split(/\s+/).length : 0;

    return [
      { label: "Resume", value: resume ? "Attached" : "Optional" },
      { label: "Profile words", value: profileWords },
      { label: "JD words", value: jdWords }
    ];
  }, [resume, selfDescription, jobDescription]);

  // Bring the reading state, then the finished report, into view.
  useEffect(() => {
    if (loading || report) {
      outputRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  }, [loading, report]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");

    if (!jobDescription.trim()) {
      setError("Job description is required.");
      return;
    }

    setSubmittedJD(jobDescription.trim());
    setLoading(true);
    setReport(null);
    try {
      const data = await generateReport({ resume, selfDescription, jobDescription });
      setReport(data.interviewReport);
    } catch (err) {
      setError(
        err.response?.data?.message ||
        "Failed to generate report. Please try again."
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="interview-lab">
      <aside className="lab-sidebar">
        <Wordmark />
        <nav className="lab-nav" aria-label="Interview workflow">
          <a href="#inputs" className="lab-nav__item lab-nav__item--active">Inputs</a>
          <a href="#report" className="lab-nav__item">Report</a>
          <a href="#prep-plan" className="lab-nav__item">Prep Plan</a>
        </nav>
        <div className="lab-sidebar__note">
          <strong>What you'll get</strong>
          <span>Five technical and three behavioral questions, your skill gaps, and a five-day plan.</span>
        </div>
      </aside>

      <section className="lab-main">
        <header className="lab-header">
          <div>
            <p className="eyebrow">New report</p>
            <h1>Mark up a <span className="hl">job description</span>.</h1>
            <p>
              Paste the posting and tell us a little about yourself. Gemini reads both and writes the
              questions you're likely to get, with the reasoning behind each.
            </p>
          </div>
          <Link to="/dashboard" className="button secondary-button">Back to your desk</Link>
        </header>

        <section className="lab-grid" id="inputs">
          <form className="generator-panel" onSubmit={handleSubmit}>
            <div className="panel-heading">
              <div>
                <p className="eyebrow">Step 1</p>
                <h2>The inputs</h2>
              </div>
            </div>

            <label className="file-drop" htmlFor="resume">
              <input
                id="resume"
                type="file"
                accept="application/pdf"
                onChange={(e) => setResume(e.target.files?.[0] || null)}
              />
              <span className="file-drop__icon">PDF</span>
              <span>
                <strong>{resume ? resume.name : "Upload resume PDF"}</strong>
                <small>{resume ? "Attached. We'll read the text from it." : "Optional · PDF up to 3MB"}</small>
              </span>
            </label>

            <div className="input-group">
              <label htmlFor="self">About you</label>
              <textarea
                id="self"
                rows={4}
                placeholder="A few lines: what you've built, your stack, and the role you want next."
                value={selfDescription}
                onChange={(e) => setSelfDescription(e.target.value)}
              />
            </div>

            <div className="input-group">
              <label htmlFor="jd">The job description (required)</label>
              <textarea
                id="jd"
                rows={8}
                placeholder="Paste the whole posting, including the nice-to-haves."
                value={jobDescription}
                onChange={(e) => setJobDescription(e.target.value)}
              />
            </div>

            {error && <p className="error">{error}</p>}

            <button className="button primary-button" disabled={loading}>
              {loading ? "Writing your report…" : report ? "Generate a new report" : "Generate report"}
            </button>
          </form>

          <aside className="readiness-panel">
            <div className="panel-heading">
              <div>
                <p className="eyebrow">As you type</p>
                <h2>What we have so far</h2>
              </div>
            </div>
            <div className="setup-metrics">
              {inputStats.map((item) => (
                <div key={item.label}>
                  <span>{item.label}</span>
                  <strong>{item.value}</strong>
                </div>
              ))}
            </div>
            <div className="signal-card">
              <span className="signal-card__bar" />
              <div>
                <strong>Sharper input, sharper questions</strong>
                <p>A real posting and a profile that names actual projects beats a polished paragraph.</p>
              </div>
            </div>
          </aside>
        </section>

        <div className="lab-output" ref={outputRef}>
          {loading && <ReadingSheet text={submittedJD} />}

          {!report && !loading && (
            <section className="empty-report">
              <p className="eyebrow">Step 2</p>
              <h2>Your report will appear here.</h2>
              <p>
                Questions with the intent behind them, where you're thin, and a five-day plan to fix it.
              </p>
            </section>
          )}

          {report && !loading && <ReportView report={report} />}
        </div>
      </section>
    </main>
  );
};

export default Interview;
