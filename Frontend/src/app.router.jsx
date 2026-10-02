import { createBrowserRouter } from "react-router-dom";
import Login from "./features/auth/pages/Login";
import Register from "./features/auth/pages/Register";
import Interview from "./features/ai/pages/Interview";
import Protected from "./features/auth/components/Protected";
import Home from "./pages/Home";
import Landing from "./pages/Landing";

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
    path: "/login",
    element: <Login />
  },
  {
    path: "/register",
    element: <Register />
  },
]);
