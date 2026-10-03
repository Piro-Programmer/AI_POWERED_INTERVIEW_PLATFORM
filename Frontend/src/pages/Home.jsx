import { Link } from "react-router-dom";
import { useAuth } from "../features/auth/hooks/useAuth";
import AppSidebar from "../components/AppSidebar";

const Home = () => {
  const { user } = useAuth();
  const firstName = user?.username?.split(" ")[0];

  return (
    <main className="workspace-page">
      <AppSidebar />

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
            <Link className="button secondary-button" to="/reports">Your reports</Link>
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
          <p className="eyebrow">Your reports</p>
          <h3>Every job you’ve prepped for, in one place.</h3>
          <p>
            Come back to any report, pick up the plan where you left off, or practise the same role again.{" "}
            <Link className="text-link" to="/reports">Open your reports →</Link>
          </p>
        </section>
      </section>
    </main>
  );
};

export default Home;
