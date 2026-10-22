import { useState } from "react";
import { Link, useLocation } from "react-router-dom";
import AuthShell from "../components/AuthShell";
import { forgotPassword } from "../services/auth.api";

const ForgotPassword = () => {
  // "Set a password" on the Account page passes the account's email along
  const { state } = useLocation();
  const [email, setEmail] = useState(typeof state?.email === "string" ? state.email : "");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [sent, setSent] = useState("");

  const submit = async (e) => {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      const data = await forgotPassword(email);
      setSent(data.message);
    } catch (err) {
      setError(err.response?.data?.message || "Couldn’t send the reset link. Please try again.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <AuthShell eyebrow="Forgot your password?" headline="We’ll email you a link to set a new one.">
      <h2>Reset your password</h2>
      {sent ? (
        <>
          <p className="account__ok" role="status">{sent}</p>
          <p className="auth-card__sub">Check your inbox, and the spam folder if it isn’t there in a minute or two.</p>
        </>
      ) : (
        <>
          <p className="auth-card__sub">Enter the email you signed up with.</p>
          <form onSubmit={submit}>
            <div className="input-group">
              <label htmlFor="email">Email</label>
              <input
                id="email"
                type="email"
                autoComplete="email"
                placeholder="you@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
            </div>
            {error && <p className="auth-error" role="alert">{error}</p>}
            <button className="button primary-button" disabled={busy}>
              {busy ? "Sending…" : "Send reset link"}
            </button>
          </form>
        </>
      )}
      <p className="auth-switch">
        Remembered it? <Link className="text-link" to="/login">Sign in</Link>
      </p>
    </AuthShell>
  );
};

export default ForgotPassword;
