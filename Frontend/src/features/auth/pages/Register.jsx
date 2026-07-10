import React, { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../hooks/useAuth";
import "../auth.form.scss";

const Register = () => {
  const navigate = useNavigate();
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const { loading, handleRegister } = useAuth();

  const handleSubmit = async (e) => {
    e.preventDefault();
    await handleRegister({ username, email, password });
    navigate("/");
  };

  if (loading) {
    return (
      <main className="auth-page">
        <div className="auth-loading">Creating secure workspace...</div>
      </main>
    );
  }

  return (
    <main className="auth-page">
      <section className="auth-showcase">
        <p className="eyebrow">Candidate readiness system</p>
        <h1>Create interview reports that look like real product output.</h1>
        <p>
          Your project now presents a complete flow: account access, resume input, AI analysis,
          and a professional preparation report.
        </p>
        <div className="auth-stats">
          <span>Resume PDF</span>
          <span>JD Fit</span>
          <span>Prep Sprint</span>
        </div>
      </section>

      <section className="auth-card">
        <div className="auth-card__header">
          <span className="brand-mark brand-mark--small">IP</span>
          <div>
            <p className="eyebrow">Start focused</p>
            <h2>Create account</h2>
          </div>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="input-group">
            <label htmlFor="username">Username</label>
            <input
              onChange={(e) => setUsername(e.target.value)}
              type="text"
              id="username"
              name="username"
              placeholder="Your name"
              required
            />
          </div>

          <div className="input-group">
            <label htmlFor="email">Email</label>
            <input
              onChange={(e) => setEmail(e.target.value)}
              type="email"
              id="email"
              name="email"
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
              placeholder="Create a password"
              required
            />
          </div>

          <button className="button primary-button">Create Workspace</button>
        </form>

        <p className="auth-switch">
          Already have an account? <Link to="/login">Login</Link>
        </p>
      </section>
    </main>
  );
};

export default Register;
