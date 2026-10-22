import { useEffect, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import AuthShell from "../components/AuthShell";
import { PASSWORD_HINT, passwordProblem } from "../password";
import { resetPassword } from "../services/auth.api";

const ResetPassword = () => {
  const [params] = useSearchParams();
  const token = params.get("token") || "";
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [done, setDone] = useState("");

  // the token is a one-time secret: don't leave it in the address bar or history
  useEffect(() => {
    if (token) window.history.replaceState(null, "", "/reset-password");
  }, [token]);

  const submit = async (e) => {
    e.preventDefault();
    setError("");
    const problem = passwordProblem(password);
    if (problem) return setError(problem);
    if (password !== confirm) return setError("The passwords don’t match.");

    setBusy(true);
    try {
      const data = await resetPassword({ token, password });
      setDone(data.message);
    } catch (err) {
      setError(err.response?.data?.message || "Couldn’t reset your password. Please try again.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <AuthShell eyebrow="Almost there" headline="Choose a new password.">
      <h2>Set a new password</h2>
      {done ? (
        <>
          <p className="account__ok" role="status">{done}</p>
          <Link className="button primary-button" to="/login">Sign in</Link>
        </>
      ) : !token ? (
        <p className="auth-error" role="alert">
          This page needs the link from your email. <Link className="text-link" to="/forgot-password">Ask for a new one</Link>.
        </p>
      ) : (
        <form onSubmit={submit}>
          <div className="input-group">
            <label htmlFor="new-password">New password</label>
            <input
              id="new-password"
              type="password"
              autoComplete="new-password"
              aria-describedby="new-password-hint"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
            <small id="new-password-hint" className="input-hint">{PASSWORD_HINT}</small>
          </div>
          <div className="input-group">
            <label htmlFor="confirm-password">Repeat new password</label>
            <input
              id="confirm-password"
              type="password"
              autoComplete="new-password"
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              required
            />
          </div>
          {error && (
            <p className="auth-error" role="alert">
              {error}
              {/expired|invalid/i.test(error) && (
                <> <Link className="text-link" to="/forgot-password">Ask for a new link</Link>.</>
              )}
            </p>
          )}
          <button className="button primary-button" disabled={busy}>
            {busy ? "Saving…" : "Set new password"}
          </button>
        </form>
      )}
    </AuthShell>
  );
};

export default ResetPassword;
