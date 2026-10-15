import Wordmark from "../../../components/Wordmark";
import "../auth.form.scss";

/** The two-column layout of the sign-in pages: a short note on the left, the form card on the right. */
const AuthShell = ({ eyebrow, headline, children }) => (
  <main className="auth-page">
    <section className="auth-showcase">
      <Wordmark />
      <div>
        <p className="eyebrow">{eyebrow}</p>
        <h1>{headline}</h1>
      </div>
    </section>
    <section className="auth-card">{children}</section>
  </main>
);

export default AuthShell;
