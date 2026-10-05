import { createBrowserRouter } from "react-router-dom";
import Login from "./features/auth/pages/Login";
import Register from "./features/auth/pages/Register";
import Interview from "./features/ai/pages/Interview";
import Protected from "./features/auth/components/Protected";
import Home from "./pages/Home";
import Landing from "./pages/Landing";
import Reports from "./features/history/pages/Reports";
import ReportDetail from "./features/history/pages/ReportDetail";
import Practice from "./features/practice/pages/Practice";

export const router = createBrowserRouter([
  {
    path: "/",
    element: <Landing />
  },
  {
    path: "/dashboard",
    element: <Protected><Home /></Protected>
  },
  {
    path: "/interview",
    element: <Protected><Interview /></Protected>
  },
  {
    path: "/reports",
    element: <Protected><Reports /></Protected>
  },
  {
    path: "/reports/:id",
    element: <Protected><ReportDetail /></Protected>
  },
  {
    path: "/reports/:id/practice",
    element: <Protected><Practice /></Protected>
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
