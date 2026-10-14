import { Link } from "react-router-dom";
import Wordmark from "../components/Wordmark";
import "./privacy.scss";

const REPO_URL = "https://github.com/Piro-Programmer/AI_POWERED_INTERVIEW_PLATFORM";

// Plain-language summary of what the app stores. Keep it in step with the
// models in Backend/src/models when what's saved changes.
const Privacy = () => (
  <main className="privacy">
    <header className="privacy__bar">
      <Wordmark />
      <Link className="text-link" to="/">Back to Interview Lab</Link>
    </header>

    <article className="privacy__body">
      <p className="eyebrow">Privacy · last updated 14 October 2026</p>
      <h1>What we keep, and for how long.</h1>
      <p className="privacy__lede">
        Interview Lab is a personal project, not a company. It keeps only what it needs to show you your own reports,
        and you can delete all of it yourself at any time.
      </p>

      <section>
        <h2>What’s stored</h2>
        <dl>
          <dt>Your account</dt>
          <dd>
            Username, email address, and your password as a one-way hash (bcrypt). Nobody, including us, can read
            your password.
          </dd>
          <dt>Your reports</dt>
          <dd>
            The job description and the “about you” text you entered, the generated questions, skill gaps and plan,
            and which plan tasks you’ve ticked.
          </dd>
          <dt>Your practice</dt>
          <dd>Each practice answer you submit, with its score and feedback.</dd>
          <dt>Usage counters</dt>
          <dd>How many AI reports and reviews you used each day, to enforce the daily limit. Deleted after 7 days.</dd>
        </dl>
      </section>

      <section>
        <h2>What’s not stored</h2>
        <ul>
          <li>
            <strong>Your resume.</strong> The PDF is read in memory, its text is sent to the AI to write your report,
            and then it’s discarded. Neither the file nor its text is saved.
          </li>
          <li><strong>Tracking.</strong> No analytics, no advertising, no tracking cookies.</li>
        </ul>
      </section>

      <section>
        <h2>Cookies</h2>
        <p>
          One cookie, <code>token</code>, keeps you signed in. It can’t be read by scripts on the page, and it expires
          after one day. When you sign out, that session is invalidated on the server too.
        </p>
      </section>

      <section>
        <h2>Who else handles your data</h2>
        <ul>
          <li>
            <strong>The AI provider</strong> (Groq, or Google Gemini as a fallback) receives the job description,
            your “about you” text, your resume text and your practice answers to generate reports and feedback. Their
            own privacy terms apply to that processing.
          </li>
          <li><strong>Hosting:</strong> Vercel serves the website, Render runs the server, and a hosted MongoDB database stores the data above.</li>
          <li><strong>Google Fonts</strong> delivers the typefaces, so your browser contacts Google when the page loads.</li>
        </ul>
      </section>

      <section>
        <h2>The site admin</h2>
        <p>
          The person running the site can see your username, email address, when you joined, and how many reports
          and practice answers you have, so they can remove spam or abuse. Not the content of your reports or
          answers. Deleting an account from the admin page is logged.
        </p>
      </section>

      <section>
        <h2>Share links</h2>
        <p>
          If you share a report, anyone with the link can read that report: the job description, questions, gaps
          and plan. Not your profile, your plan progress or your practice. Turning sharing off kills the link at
          once.
        </p>
      </section>

      <section>
        <h2>Deleting your data</h2>
        <ul>
          <li><strong>One report:</strong> open it and choose “Delete report”. Its practice answers go with it.</li>
          <li>
            <strong>Everything:</strong> go to <Link className="text-link" to="/account">Account</Link> → “Delete
            account”. Your account, every report, every practice answer and your usage history are removed, and all
            your sessions end.
          </li>
        </ul>
      </section>

      <section>
        <h2>Questions</h2>
        <p>
          Open an issue on{" "}
          <a className="text-link" href={`${REPO_URL}/issues`} target="_blank" rel="noreferrer">GitHub</a>. The source
          code is public, so you can also check exactly what’s stored.
        </p>
      </section>
    </article>
  </main>
);

export default Privacy;
