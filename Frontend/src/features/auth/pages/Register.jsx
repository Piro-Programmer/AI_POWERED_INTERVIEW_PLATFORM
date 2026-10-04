import React, { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../hooks/useAuth";
import "../auth.form.scss";
import Wordmark from "../../../components/Wordmark";

const Register = () => {
  const navigate = useNavigate();
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");

  const { loading, handleRegister } = useAuth();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    const result = await handleRegister({ username, email, password });
    if (result.ok) {
      navigate("/dashboard");
    } else {
      setError(result.message);
    }
  };

  if (loading) {
    return <main className="page-loading">setting up your desk…</main>;
  }

  return (
    <main className="auth-page">
      <section className="auth-showcase">
        <Wordmark />
        <div>
          <p className="eyebrow">Before your next interview</p>
          <h1>Read the job description the way they wrote it.</h1>
          <figure className="auth-snippet">
            <blockquote>
              “…<span className="auth-circle">3+ years</span> of experience with <span className="hl">SQL</span> and
              a <span className="auth-underline">collaborative</span> approach to stakeholders…”
            </blockquote>
            <figcaption>→ have one story about disagreeing with someone, and how it ended</figcaption>
          </figure>
        </div>
      </section>

      <section className="auth-card">
        <h2>Create an account</h2>
        <p className="auth-card__sub">So your reports are still here next week.</p>

        <form onSubmit={handleSubmit}>
          <div className="input-group">
            <label htmlFor="username">Username</label>
            <input
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              type="text"
              id="username"
              name="username"
              autoComplete="username"
              placeholder="Pick a username"
              required
            />
          </div>

          <div className="input-group">
            <label htmlFor="email">Email</label>
            <input
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              type="email"
              id="email"
              name="email"
              autoComplete="email"
              placeholder="you@example.com"
              required
            />
          </div>
          <div className="input-group">
            <label htmlFor="password">Password</label>
            <input
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              type="password"
              id="password"
              name="password"
              autoComplete="new-password"
              required
            />
          </div>

          {error && <p className="auth-error" role="alert">{error}</p>}

          <button className="button primary-button">Create account</button>
        </form>

        <p className="auth-switch">
          Already have one? <Link className="text-link" to="/login">Sign in</Link>
        </p>
      </section>
    </main>
  );
};

export default Register;
