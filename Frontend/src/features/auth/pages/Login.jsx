import React, { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import "../auth.form.scss";
import { useAuth } from "../hooks/useAuth";
import Wordmark from "../../../components/Wordmark";

const Login = () => {
  const { loading, handleLogin } = useAuth();
  const navigate = useNavigate();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const handleSubmit = async (e) => {
    e.preventDefault();
    const success = await handleLogin({ email, password });
    if (success) {
      navigate("/dashboard");
    }
  };

  if (loading) {
    return <main className="page-loading">opening your desk…</main>;
  }

  return (
    <main className="auth-page">
      <section className="auth-showcase">
        <Wordmark />
        <div>
          <p className="eyebrow">Welcome back</p>
          <h1>Pick up where you left off.</h1>
          <figure className="auth-snippet">
            <blockquote>
              “…you’ll work closely with design in a <span className="auth-circle">fast-paced</span> team,
              shipping <span className="hl">React</span> features from idea to production…”
            </blockquote>
            <figcaption>→ they’ll ask how you handle priorities that change mid-sprint</figcaption>
          </figure>
        </div>
      </section>

      <section className="auth-card">
        <h2>Sign in</h2>
        <p className="auth-card__sub">Your reports and prep plans are saved to your account.</p>

        <form onSubmit={handleSubmit}>
          <div className="input-group">
            <label htmlFor="email">Email</label>
            <input
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
              onChange={(e) => setPassword(e.target.value)}
              type="password"
              id="password"
              name="password"
              autoComplete="current-password"
              required
            />
          </div>

          <button className="button primary-button">Sign in</button>
        </form>

        <p className="auth-switch">
          New here? <Link className="text-link" to="/register">Create an account</Link>
        </p>
      </section>
    </main>
  );
};

export default Login;
