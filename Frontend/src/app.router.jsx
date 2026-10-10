import { createBrowserRouter } from "react-router-dom";
import Protected from "./features/auth/components/Protected";
import Landing from "./pages/Landing";

// The landing page ships in the main bundle; every other page is its own
// chunk, downloaded the first time someone navigates to it.
const page = (load, { protect = false } = {}) => async () => {
  const { default: Page } = await load();
  return { element: protect ? <Protected><Page /></Protected> : <Page /> };
};

export const router = createBrowserRouter([
  {
    path: "/",
    element: <Landing />
  },
  {
    path: "/dashboard",
    lazy: page(() => import("./pages/Home"), { protect: true })
  },
  {
    path: "/interview",
    lazy: page(() => import("./features/ai/pages/Interview"), { protect: true })
  },
  {
    path: "/reports",
    lazy: page(() => import("./features/history/pages/Reports"), { protect: true })
  },
  {
    path: "/reports/:id",
    lazy: page(() => import("./features/history/pages/ReportDetail"), { protect: true })
  },
  {
    path: "/reports/:id/practice",
    lazy: page(() => import("./features/practice/pages/Practice"), { protect: true })
  },
  {
    path: "/login",
    lazy: page(() => import("./features/auth/pages/Login"))
  },
  {
    path: "/register",
    lazy: page(() => import("./features/auth/pages/Register"))
  },
], {
  // shown when someone opens a lazy page directly (e.g. a bookmarked report)
  hydrateFallbackElement: <main className="page-loading">turning the page…</main>
});
