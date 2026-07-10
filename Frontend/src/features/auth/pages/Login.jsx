import React, { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import "../auth.form.scss";
import { useAuth } from "../hooks/useAuth";

const Login = () => {
  const { loading, handleLogin } = useAuth();
  const navigate = useNavigate();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const handleSubmit = async (e) => {
    e.preventDefault();
    const success = await handleLogin({ email, password });
    if (success) {
      navigate("/");
    }
  };

  if (loading) {
    return (
      <main className="auth-page">
        <div className="auth-loading">Preparing your workspace...</div>
      </main>
    );
  }

  return (
    <main className="auth-page">
      <section className="auth-showcase">
        <p className="eyebrow">AI Interview Lab</p>
        <h1>Practice with the same precision recruiters expect from strong candidates.</h1>
        <p>
          Convert resumes and job descriptions into structured interview reports with match signals,
          questions, answers, and a five-day preparation plan.
        </p>
        <div className="auth-stats">
          <span>JWT Auth</span>
          <span>Gemini AI</span>
          <span>Mongo Reports</span>
        </div>
      </section>

      <section className="auth-card">
        <div className="auth-card__header">
          <span className="brand-mark brand-mark--small">IP</span>
          <div>
            <p className="eyebrow">Welcome back</p>
            <h2>Login</h2>
          </div>
        </div>

        <form onSubmit={handleSubmit}>
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
              placeholder="Enter your password"
              required
            />
          </div>

          <button className="button primary-button">Open Workspace</button>
        </form>

        <p className="auth-switch">
          New to the platform? <Link to="/register">Create an account</Link>
        </p>
      </section>
    </main>
  );
};

export default Login;
