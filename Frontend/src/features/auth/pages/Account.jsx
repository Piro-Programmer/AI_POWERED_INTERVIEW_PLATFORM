import { useContext, useState } from "react";
import { Link } from "react-router-dom";
import AppSidebar from "../../../components/AppSidebar";
import PlanSummary from "../../billing/components/PlanSummary";
import { AuthContext } from "../auth.context";
import { PASSWORD_HINT, passwordProblem } from "../password";
import { changePassword, deleteAccount } from "../services/auth.api";
import "../auth.form.scss";

const errorMessage = (err, fallback) => err?.response?.data?.message || fallback;

const ChangePassword = () => {
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [done, setDone] = useState("");

  const submit = async (e) => {
    e.preventDefault();
    setError("");
    setDone("");

    const problem = passwordProblem(newPassword);
    if (problem) return setError(problem);
    if (newPassword !== confirm) return setError("The new passwords don't match.");

    setBusy(true);
    try {
      const data = await changePassword({ currentPassword, newPassword });
      setDone(data.message || "Password changed.");
      setCurrentPassword("");
      setNewPassword("");
      setConfirm("");
    } catch (err) {
      setError(errorMessage(err, "Couldn't change your password. Please try again."));
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className="account__section" aria-labelledby="password-heading">
      <h3 id="password-heading">Change password</h3>
      <p>You stay signed in here; any other device is signed out.</p>
      <form onSubmit={submit}>
        <div className="input-group">
          <label htmlFor="current-password">Current password</label>
          <input
            id="current-password"
            type="password"
            autoComplete="current-password"
            value={currentPassword}
            onChange={(e) => setCurrentPassword(e.target.value)}
            required
          />
        </div>
        <div className="input-group">
          <label htmlFor="new-password">New password</label>
          <input
            id="new-password"
            type="password"
            autoComplete="new-password"
            aria-describedby="new-password-hint"
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
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

        {error && <p className="auth-error" role="alert">{error}</p>}
        {done && <p className="account__ok" role="status">{done}</p>}

        <button className="button primary-button" disabled={busy}>
          {busy ? "Changing…" : "Change password"}
        </button>
      </form>
    </section>
  );
};

// A Google account without a password sets one through the reset email,
// which also proves it still owns the address.
const SetPassword = ({ email }) => (
  <section className="account__section" aria-labelledby="password-heading">
    <h3 id="password-heading">Password</h3>
    <p>
      You sign in with Google, so there's no password on this account. To also sign in with {email} and a
      password, set one from a reset email.
    </p>
    <Link className="button secondary-button" to="/forgot-password" state={{ email }}>
      Set a password
    </Link>
  </section>
);

const DeleteAccount = ({ hasPassword, email }) => {
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const submit = async (e) => {
    e.preventDefault();
    if (!window.confirm("Delete your account, every report and every practice answer? This can't be undone.")) return;

    setBusy(true);
    setError("");
    try {
      await deleteAccount(hasPassword ? { password } : { email: password });
      // A full page load: nothing from the deleted account stays in memory,
      // and the sign-in guard can't race the navigation to /login.
      window.location.replace("/");
    } catch (err) {
      setError(errorMessage(err, "Couldn't delete your account. Please try again."));
      setBusy(false);
    }
  };

  return (
    <section className="account__section account__section--danger" aria-labelledby="delete-heading">
      <h3 id="delete-heading">Delete account</h3>
      <p>Removes your account, all your reports, practice answers and usage history for good.</p>
      <form onSubmit={submit}>
        <div className="input-group">
          <label htmlFor="delete-password">{hasPassword ? "Password" : `Type your email (${email}) to confirm`}</label>
          <input
            id="delete-password"
            type={hasPassword ? "password" : "email"}
            autoComplete={hasPassword ? "current-password" : "off"}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />
        </div>

        {error && <p className="auth-error" role="alert">{error}</p>}

        <button className="button danger-button" disabled={busy}>
          {busy ? "Deleting…" : "Delete my account"}
        </button>
      </form>
    </section>
  );
};

const Account = () => {
  const { user } = useContext(AuthContext);
  // older sessions don't report it; every account had a password before Google sign-in
  const hasPassword = user?.hasPassword !== false;

  return (
    <main className="workspace-page">
      <AppSidebar />

      <section className="workspace-main">
        <header className="workspace-hero">
          <p className="eyebrow">Account</p>
          <h2>{user?.username}</h2>
          <p>{user?.email}</p>
        </header>

        <PlanSummary />

        <div className="account">
          {hasPassword ? <ChangePassword /> : <SetPassword email={user?.email} />}
          <DeleteAccount hasPassword={hasPassword} email={user?.email} />
        </div>
      </section>
    </main>
  );
};

export default Account;
