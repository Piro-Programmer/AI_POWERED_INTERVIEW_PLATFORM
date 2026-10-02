import { Link } from "react-router-dom";
import { useAuth } from "../features/auth/hooks/useAuth";
import Wordmark from "../components/Wordmark";

const Home = () => {
  const { user, handleLogout } = useAuth();
  const firstName = user?.username?.split(" ")[0];

  return (
    <main className="workspace-page">
      <aside className="workspace-sidebar">
        <Wordmark />
        <nav className="side-nav" aria-label="Main navigation">
          <Link className="side-nav__item side-nav__item--active" to="/dashboard">Your desk</Link>
          <Link className="side-nav__item" to="/interview">New report</Link>
        </nav>
        <div className="sidebar-profile">
          <span className="avatar">{user?.username?.slice(0, 1)?.toUpperCase() || "U"}</span>
          <div>
            <strong>{user?.username || "Candidate"}</strong>
            <small>{user?.email}</small>
          </div>
        </div>
        <button className="ghost-button" onClick={handleLogout}>Sign out</button>
      </aside>

      <section className="workspace-main">
        <header className="workspace-hero">
          <p className="eyebrow">{firstName ? `Hi ${firstName},` : "Hi,"}</p>
          <h2>Got a job description? <span className="hl">Let’s mark it up.</span></h2>
          <p>
            Paste the posting, add your resume if you have it, and you’ll get eight likely questions with the
            intent behind each, your gaps, and a five-day plan.
          </p>
          <div className="hero-actions">
            <Link className="button primary-button" to="/interview">Start a new report</Link>
          </div>
        </header>

        <section className="insight-grid" aria-label="Tips for a sharper report">
          <article className="insight-card">
            <span className="insight-number">tip i.</span>
            <h3>Paste the whole posting</h3>
            <p>Responsibilities, requirements and the “nice to haves”. The questions get sharper with every line.</p>
          </article>
          <article className="insight-card">
            <span className="insight-number">tip ii.</span>
            <h3>Write the profile like you’d say it</h3>
            <p>Three or four lines: what you’ve built, the stack, and what you want next. Skip the adjectives.</p>
          </article>
          <article className="insight-card">
            <span className="insight-number">tip iii.</span>
            <h3>Rewrite every answer</h3>
            <p>The suggested answers are outlines. Put your own project and your own numbers in them before you practise.</p>
          </article>
        </section>

        <section className="proof-panel">
          <p className="eyebrow">Coming soon</p>
          <h3>Your past reports, in one place.</h3>
          <p>Every report you generate is already saved to your account. A list of them is next on the build list.</p>
        </section>
      </section>
    </main>
  );
};

export default Home;
