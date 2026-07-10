import React, { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { generateReport } from "../services/interview.api";
import "../interview.scss";

const severityClass = (severity) => `severity severity--${severity}`;

const scoreLabel = (score) => {
  if (score >= 80) return "Strong match";
  if (score >= 60) return "Good foundation";
  if (score >= 40) return "Needs focus";
  return "High improvement area";
};

const Interview = () => {
  const [resume, setResume] = useState(null);
  const [selfDescription, setSelfDescription] = useState("");
  const [jobDescription, setJobDescription] = useState("");

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [report, setReport] = useState(null);

  const inputStats = useMemo(() => {
    const jdWords = jobDescription.trim() ? jobDescription.trim().split(/\s+/).length : 0;
    const profileWords = selfDescription.trim() ? selfDescription.trim().split(/\s+/).length : 0;

    return [
      { label: "Resume", value: resume ? "Attached" : "Optional" },
      { label: "Profile words", value: profileWords },
      { label: "JD words", value: jdWords }
    ];
  }, [resume, selfDescription, jobDescription]);

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
    <main className="interview-lab">
      <aside className="lab-sidebar">
        <Link to="/" className="brand-link">
          <span className="brand-mark">IP</span>
          <span>Interview Lab</span>
        </Link>
        <nav className="lab-nav" aria-label="Interview workflow">
          <a href="#inputs" className="lab-nav__item lab-nav__item--active">Inputs</a>
          <a href="#report" className="lab-nav__item">Report</a>
          <a href="#prep-plan" className="lab-nav__item">Prep Plan</a>
        </nav>
        <div className="lab-sidebar__note">
          <strong>Output contract</strong>
          <span>5 technical questions, 3 behavioral questions, skill gaps, and a 5-day sprint.</span>
        </div>
      </aside>

      <section className="lab-main">
        <header className="lab-header">
          <div>
            <p className="eyebrow">AI-powered readiness workspace</p>
            <h1>Generate a recruiter-grade interview report.</h1>
            <p>
              Feed the platform your candidate signal and job target. The report turns it into
              interview questions, intent, answers, gaps, and focused practice.
            </p>
          </div>
          <Link to="/" className="button secondary-button">Back to Overview</Link>
        </header>

        <section className="lab-grid" id="inputs">
          <form className="generator-panel" onSubmit={handleSubmit}>
            <div className="panel-heading">
              <div>
                <p className="eyebrow">Step 01</p>
                <h2>Candidate inputs</h2>
              </div>
              <span className="status-pill">Secure session</span>
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
                <small>{resume ? "Ready for parsing" : "Optional, max 3MB from backend limit"}</small>
              </span>
            </label>

            <div className="input-group">
              <label htmlFor="self">Candidate profile</label>
              <textarea
                id="self"
                rows={4}
                placeholder="Summarize experience, target role, projects, tech stack, and goals."
                value={selfDescription}
                onChange={(e) => setSelfDescription(e.target.value)}
              />
            </div>

            <div className="input-group">
              <label htmlFor="jd">Target job description *</label>
              <textarea
                id="jd"
                rows={8}
                placeholder="Paste the full job description here."
                value={jobDescription}
                onChange={(e) => setJobDescription(e.target.value)}
              />
            </div>

            {error && <p className="error">{error}</p>}

            <button className="button primary-button" disabled={loading}>
              {loading ? "Generating report..." : "Generate Interview Report"}
            </button>
          </form>

          <aside className="readiness-panel">
            <div className="panel-heading">
              <div>
                <p className="eyebrow">Live setup</p>
                <h2>Input quality</h2>
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
                <strong>Best recruiter impression</strong>
                <p>Use a real JD and a concise project-focused profile to make the report feel credible.</p>
              </div>
            </div>
            {loading && (
              <div className="analysis-loader">
                <span />
                <div>
                  <strong>Analyzing candidate-role fit</strong>
                  <p>Gemini is building a structured report.</p>
                </div>
              </div>
            )}
          </aside>
        </section>

        {!report && !loading && (
          <section className="empty-report">
            <p className="eyebrow">Step 02</p>
            <h2>Your generated assessment will appear here.</h2>
            <p>
              The final report is designed like a hiring-readiness dashboard with question banks,
              skill gaps, and a preparation sprint.
            </p>
          </section>
        )}

        {report && (
          <section className="report-dashboard" id="report">
            <div className="report-hero">
              <div>
                <p className="eyebrow">Generated assessment</p>
                <h2>{report.title || "Interview Report"}</h2>
                <p>{scoreLabel(report.matchScore)} based on the provided candidate signal and role target.</p>
              </div>
              <div className="score-orbit" style={{ "--score": `${report.matchScore || 0}%` }}>
                <span>{report.matchScore}</span>
                <small>match score</small>
              </div>
            </div>

            <div className="report-metrics">
              <div>
                <span>Technical</span>
                <strong>{report.technicalQuestions?.length || 0}</strong>
              </div>
              <div>
                <span>Behavioral</span>
                <strong>{report.behavioralQuestions?.length || 0}</strong>
              </div>
              <div>
                <span>Skill gaps</span>
                <strong>{report.skillGaps?.length || 0}</strong>
              </div>
              <div>
                <span>Prep days</span>
                <strong>{report.preparationPlan?.length || 0}</strong>
              </div>
            </div>

            <div className="report-columns">
              <section className="report-block report-block--wide">
                <div className="section-title">
                  <p className="eyebrow">Question bank</p>
                  <h3>Technical Questions</h3>
                </div>
                {report.technicalQuestions?.map((q, i) => (
                  <article key={`tech-${i}`} className="qa-card">
                    <span className="qa-index">{String(i + 1).padStart(2, "0")}</span>
                    <div>
                      <h4>{q.question}</h4>
                      <p><strong>Why they ask:</strong> {q.intention}</p>
                      <p><strong>How to answer:</strong> {q.answer}</p>
                    </div>
                  </article>
                ))}
              </section>

              <section className="report-block">
                <div className="section-title">
                  <p className="eyebrow">Risk radar</p>
                  <h3>Skill Gaps</h3>
                </div>
                <ul className="skill-gaps">
                  {report.skillGaps?.map((gap, i) => (
                    <li key={`gap-${i}`}>
                      <span>{gap.skill}</span>
                      <span className={severityClass(gap.severity)}>{gap.severity}</span>
                    </li>
                  ))}
                </ul>
              </section>
            </div>

            <section className="report-block">
              <div className="section-title">
                <p className="eyebrow">Culture and ownership</p>
                <h3>Behavioral Questions</h3>
              </div>
              <div className="behavior-grid">
                {report.behavioralQuestions?.map((q, i) => (
                  <article key={`beh-${i}`} className="behavior-card">
                    <span>Round {i + 1}</span>
                    <h4>{q.question}</h4>
                    <p><strong>Intent:</strong> {q.intention}</p>
                    <p><strong>Answer:</strong> {q.answer}</p>
                  </article>
                ))}
              </div>
            </section>

            <section className="report-block" id="prep-plan">
              <div className="section-title">
                <p className="eyebrow">Execution plan</p>
                <h3>Five-Day Preparation Sprint</h3>
              </div>
              <div className="timeline">
                {report.preparationPlan?.map((day, i) => (
                  <article key={`day-${i}`} className="timeline-item">
                    <span className="timeline-day">Day {day.day}</span>
                    <div>
                      <h4>{day.focus}</h4>
                      <ul>
                        {day.tasks?.map((task, j) => (
                          <li key={`task-${i}-${j}`}>{task}</li>
                        ))}
                      </ul>
                    </div>
                  </article>
                ))}
              </div>
            </section>
          </section>
        )}
      </section>
    </main>
  );
};

export default Interview;
