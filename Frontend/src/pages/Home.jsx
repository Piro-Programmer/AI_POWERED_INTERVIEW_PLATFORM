import { Link } from "react-router-dom";
import { useAuth } from "../features/auth/hooks/useAuth";

const Home = () => {
  const { user, handleLogout } = useAuth();

  return (
    <main className="workspace-page">
      <aside className="workspace-sidebar">
        <div className="brand-mark">
          <span>IP</span>
        </div>
        <div>
          <p className="eyebrow">Interview Lab</p>
          <h1>AI Interview Prep</h1>
        </div>
        <nav className="side-nav" aria-label="Main navigation">
          <Link className="side-nav__item side-nav__item--active" to="/">Overview</Link>
          <Link className="side-nav__item" to="/interview">New Report</Link>
        </nav>
        <div className="sidebar-profile">
          <span className="avatar">{user?.username?.slice(0, 1)?.toUpperCase() || "U"}</span>
          <div>
            <strong>{user?.username || "Candidate"}</strong>
            <small>Readiness workspace</small>
          </div>
        </div>
        <button className="ghost-button" onClick={handleLogout}>Logout</button>
      </aside>

      <section className="workspace-main">
        <header className="workspace-hero">
          <div>
            <p className="eyebrow">Role-specific preparation engine</p>
            <h2>Turn any resume and job description into a focused interview plan.</h2>
            <p>
              Generate technical questions, behavioral prompts, skill gaps, and a practical prep sprint
              in one structured report.
            </p>
            <div className="hero-actions">
              <Link className="button primary-button" to="/interview">Create Interview Report</Link>
              <a className="button secondary-button" href="#workflow">View Workflow</a>
            </div>
          </div>
          <div className="hero-metric-panel" aria-label="Platform highlights">
            <div>
              <span className="metric-value">5+</span>
              <span className="metric-label">Technical questions</span>
            </div>
            <div>
              <span className="metric-value">3</span>
              <span className="metric-label">Behavioral rounds</span>
            </div>
            <div>
              <span className="metric-value">5d</span>
              <span className="metric-label">Prep roadmap</span>
            </div>
          </div>
        </header>

        <section className="insight-grid" id="workflow">
          <article className="insight-card">
            <span className="insight-number">01</span>
            <h3>Candidate Signal</h3>
            <p>Resume text and self description give the AI enough context to personalize the questions.</p>
          </article>
          <article className="insight-card">
            <span className="insight-number">02</span>
            <h3>Role Match</h3>
            <p>The job description becomes the benchmark for match score, gaps, and preparation focus.</p>
          </article>
          <article className="insight-card">
            <span className="insight-number">03</span>
            <h3>Interview Pack</h3>
            <p>The final report is organized into questions, intent, suggested answers, and daily tasks.</p>
          </article>
        </section>

        <section className="proof-panel">
          <div>
            <p className="eyebrow">Recruiter-facing polish</p>
            <h3>Built like a SaaS dashboard, not a class assignment.</h3>
          </div>
          <div className="proof-list">
            <span>Protected auth flow</span>
            <span>PDF parsing</span>
            <span>Structured Gemini output</span>
            <span>MongoDB reports</span>
          </div>
        </section>
      </section>
    </main>
  );
};

export default Home;
