import React, { useState } from "react";
import { Link } from "react-router-dom";
import { generateReport } from "../services/interview.api";
import "../interview.scss";

const severityClass = (s) => `severity severity--${s}`;

const Interview = () => {
  const [resume, setResume] = useState(null);
  const [selfDescription, setSelfDescription] = useState("");
  const [jobDescription, setJobDescription] = useState("");

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [report, setReport] = useState(null);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");

    if (!jobDescription.trim()) {
      setError("Job description is required.");
      return;
    }

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
    <main className="interview-page">
      <header className="interview-header">
        <h1>AI Interview Prep</h1>
        <Link to="/" className="link">← Home</Link>
      </header>

      <form className="interview-form" onSubmit={handleSubmit}>
        <div className="input-group">
          <label htmlFor="resume">Resume (PDF)</label>
          <input
            id="resume"
            type="file"
            accept="application/pdf"
            onChange={(e) => setResume(e.target.files?.[0] || null)}
          />
        </div>

        <div className="input-group">
          <label htmlFor="self">About you (optional)</label>
          <textarea
            id="self"
            rows={3}
            placeholder="A short summary of your experience, goals, etc."
            value={selfDescription}
            onChange={(e) => setSelfDescription(e.target.value)}
          />
        </div>

        <div className="input-group">
          <label htmlFor="jd">Job description *</label>
          <textarea
            id="jd"
            rows={6}
            placeholder="Paste the job description here…"
            value={jobDescription}
            onChange={(e) => setJobDescription(e.target.value)}
          />
        </div>

        {error && <p className="error">{error}</p>}

        <button className="button primary-button" disabled={loading}>
          {loading ? "Generating…" : "Generate Report"}
        </button>
      </form>

      {loading && (
        <p className="hint">Analyzing your profile against the role — this can take a moment.</p>
      )}

      {report && (
        <section className="report">
          <div className="report-top">
            <h2>{report.title || "Interview Report"}</h2>
            <div className="score">
              <span className="score-num">{report.matchScore}</span>
              <span className="score-label">match</span>
            </div>
          </div>

          <div className="report-block">
            <h3>Technical Questions</h3>
            {report.technicalQuestions?.map((q, i) => (
              <article key={`tech-${i}`} className="qa">
                <p className="q">Q{i + 1}. {q.question}</p>
                <p className="meta"><strong>Why they ask:</strong> {q.intention}</p>
                <p className="meta"><strong>How to answer:</strong> {q.answer}</p>
              </article>
            ))}
          </div>

          <div className="report-block">
            <h3>Behavioral Questions</h3>
            {report.behavioralQuestions?.map((q, i) => (
              <article key={`beh-${i}`} className="qa">
                <p className="q">Q{i + 1}. {q.question}</p>
                <p className="meta"><strong>Why they ask:</strong> {q.intention}</p>
                <p className="meta"><strong>How to answer:</strong> {q.answer}</p>
              </article>
            ))}
          </div>

          <div className="report-block">
            <h3>Skill Gaps</h3>
            <ul className="skill-gaps">
              {report.skillGaps?.map((g, i) => (
                <li key={`gap-${i}`}>
                  <span>{g.skill}</span>
                  <span className={severityClass(g.severity)}>{g.severity}</span>
                </li>
              ))}
            </ul>
          </div>

          <div className="report-block">
            <h3>Preparation Plan</h3>
            {report.preparationPlan?.map((d, i) => (
              <article key={`day-${i}`} className="plan-day">
                <p className="q">Day {d.day}: {d.focus}</p>
                <ul>
                  {d.tasks?.map((t, j) => <li key={`task-${i}-${j}`}>{t}</li>)}
                </ul>
              </article>
            ))}
          </div>
        </section>
      )}
    </main>
  );
};

export default Interview;
