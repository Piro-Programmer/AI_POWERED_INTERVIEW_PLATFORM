import { useEffect, useRef } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../features/auth/hooks/useAuth";
import Wordmark from "../components/Wordmark";
import LiveMarkup from "../features/landing/components/LiveMarkup";
import "../features/landing/landing.scss";

const REPO_URL = "https://github.com/Piro-Programmer/AI_POWERED_INTERVIEW_PLATFORM";

const PLAN_TASKS = [
  "Model the shipments schema in GraphQL and write 3 resolvers",
  "Explain N+1 out loud in under a minute",
  "Rewrite one project bullet around a number",
];

// Adds .is-in to [data-reveal] elements the first time they scroll into view.
const useReveal = (rootRef) => {
  useEffect(() => {
    const targets = rootRef.current?.querySelectorAll("[data-reveal]") ?? [];
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add("is-in");
            observer.unobserve(entry.target);
          }
        });
      },
      { threshold: 0.2, rootMargin: "0px 0px -8% 0px" }
    );
    targets.forEach((el) => observer.observe(el));
    return () => observer.disconnect();
  }, [rootRef]);
};

const Landing = () => {
  const { user } = useAuth();
  const rootRef = useRef(null);
  useReveal(rootRef);

  const startTo = user ? "/interview" : "/register";

  return (
    <div className="landing" ref={rootRef}>
      <header className="topbar">
        <Wordmark />
        <nav className="topbar__nav" aria-label="Sections">
          <a href="#try">Try it</a>
          <a href="#report">What you get</a>
          <a href="#how">How it works</a>
        </nav>
        <div className="topbar__actions">
          {user ? (
            <Link className="button primary-button" to="/dashboard">Open your desk</Link>
          ) : (
            <>
              <Link className="topbar__signin" to="/login">Sign in</Link>
              <Link className="button primary-button" to="/register">Create account</Link>
            </>
          )}
        </div>
      </header>

      <main>
        <section className="hero">
          <p className="eyebrow">For anyone with an interview coming up</p>
          <h1>
            Every job description is a list of <span className="hl-draw">interview questions</span> in disguise.
          </h1>
          <div className="hero__row">
            <p className="hero__lede">
              Paste one in. Interview Lab marks it up the way a hiring manager reads it: the skills they’ll test,
              the questions they’ll ask, and the lines worth reading twice.
            </p>
            <div className="hero__actions">
              <Link className="button primary-button" to={startTo}>Prep for a real role</Link>
              <a className="button secondary-button" href="#try">Try the demo</a>
            </div>
          </div>
          <p className="hero__aside" aria-hidden="true">
            it’s live: hover a mark
            <svg viewBox="0 0 60 70" width="44" height="52">
              <path d="M10 4 C 40 10, 52 30, 34 58" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" />
              <path d="M24 50 L 33 60 L 42 49" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </p>
        </section>

        <section className="try" id="try">
          <LiveMarkup ctaTo={startTo} />
        </section>

        <section className="specimen" id="report">
          <header className="section-head" data-reveal>
            <p className="eyebrow">§ 02 · What comes back</p>
            <h2>A working document, not a pep talk.</h2>
            <p>
              The full report reads your resume against the role and gives you something to practise from. Here’s
              an excerpt from one.
            </p>
          </header>

          <div className="specimen__spread">
            <figure className="score" data-reveal>
              <div className="score__num">
                72
                <svg className="score__ring" viewBox="0 0 220 140" preserveAspectRatio="none" aria-hidden="true">
                  <path
                    pathLength="1"
                    d="M40 34 C 90 4, 200 10, 206 64 C 212 118, 70 136, 22 96 C -2 74, 18 40, 92 22"
                  />
                </svg>
              </div>
              <figcaption>
                <span className="eyebrow">Match score / 100</span>
                <p>A good foundation, with two gaps worth a weekend each.</p>
              </figcaption>
            </figure>

            <div className="excerpt">
              <article className="excerpt__item" data-reveal>
                <span className="eyebrow">Q.03 · technical</span>
                <h3>Your tracking page re-renders on every location ping. How would you fix it?</h3>
                <dl>
                  <dt>Why they ask</dt>
                  <dd>The job description mentions performance twice and 5x traffic. They want to see you measure before you optimise.</dd>
                  <dt>How to answer</dt>
                  <dd>Profile first, then memoise the list rows, batch the updates, and move the ping into a subscription. End with the number you’d watch.</dd>
                </dl>
              </article>

              <article className="excerpt__item" data-reveal>
                <span className="eyebrow">Skill gaps</span>
                <ul className="gaps">
                  <li><span className="gap gap--high">GraphQL</span><em>high: no project uses it yet</em></li>
                  <li><span className="gap gap--medium">Testing</span><em>medium: unit tests, no end-to-end</em></li>
                  <li><span className="gap gap--low">Docker</span><em>low: listed as nice to have</em></li>
                </ul>
              </article>

              <article className="excerpt__item" data-reveal>
                <span className="eyebrow">Day 2 of 5 · Close the GraphQL gap</span>
                <ul className="plan">
                  {PLAN_TASKS.map((task) => (
                    <li key={task}>
                      <label>
                        <input type="checkbox" />
                        <span>{task}</span>
                      </label>
                    </li>
                  ))}
                </ul>
              </article>
            </div>
          </div>
        </section>

        <section className="how" id="how">
          <header className="section-head" data-reveal>
            <p className="eyebrow">§ 03 · How it works</p>
            <h2>Four steps. About ten minutes.</h2>
          </header>
          <ol className="steps">
            <li data-reveal>
              <span className="steps__n">i.</span>
              <h3>Paste the job description</h3>
              <p>The real one, from the posting. The more specific it is, the sharper the questions.</p>
            </li>
            <li data-reveal>
              <span className="steps__n">ii.</span>
              <h3>Add your resume</h3>
              <p>A PDF, plus a few lines about what you’ve built. Optional, but it’s how the gaps get personal.</p>
            </li>
            <li data-reveal>
              <span className="steps__n">iii.</span>
              <h3>Read the markup</h3>
              <p>Eight questions with the intent behind each, your match score, and where you’re thin.</p>
            </li>
            <li data-reveal>
              <span className="steps__n">iv.</span>
              <h3>Work the plan</h3>
              <p>Five evenings, each with a focus and a short list of tasks. Reports are saved to your account.</p>
            </li>
          </ol>
        </section>

        <section className="candid" data-reveal>
          <div>
            <p className="eyebrow">What it will do</p>
            <ul>
              <li>Show you which lines of the posting are really interview questions.</li>
              <li>Give you answer outlines to rewrite in your own words.</li>
              <li>Hand you a plan that fits around a day job.</li>
            </ul>
          </div>
          <div>
            <p className="eyebrow">What it won’t</p>
            <ul className="candid__wont">
              <li>Write a script for you to memorise.</li>
              <li>Treat a keyword match as a hiring decision.</li>
              <li>Promise you the job. It’s practice, not a cheat code.</li>
            </ul>
          </div>
        </section>

        <section className="closing">
          <h2 data-reveal>
            Most of your interview is already written down. <em>It’s in the job description.</em>
          </h2>
          <Link className="button closing__cta" to={startTo}>Mark up my first one</Link>
        </section>
      </main>

      <footer className="footer">
        <Wordmark />
        <p>Built with React, Express, MongoDB and Gemini.</p>
        <a className="text-link" href={REPO_URL} target="_blank" rel="noreferrer">Source on GitHub</a>
      </footer>
    </div>
  );
};

export default Landing;
