import { createBrowserRouter, Link } from "react-router-dom";
import Login from "./features/auth/pages/Login";
import Register from "./features/auth/pages/Register";
import Interview from "./features/ai/pages/Interview";
import Protected from "./features/auth/components/Protected";

const Home = () => (
  <main>
    <div className="form-container">
      <h1>AI Interview Prep</h1>
      <p style={{ color: "#9aa0a6" }}>
        Upload your resume and a job description to get a tailored interview report.
      </p>
      <Link className="button primary-button" to="/interview" style={{ textAlign: "center" }}>
        Start a new report
      </Link>
    </div>
  </main>
);

export const router = createBrowserRouter([
  {
    path: "/",
    element: <Protected><Home /></Protected>
  },
  {
    path: "/interview",
    element: <Protected><Interview /></Protected>
  },
  {
    path: "/login",
    element: <Login />
  },
  {
    path: "/register",
    element: <Register />
  },
]);
