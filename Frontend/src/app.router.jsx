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
    path: "/privacy",
    lazy: page(() => import("./pages/Privacy"))
  },
  {
    // public: plans and prices, with "your plan" marked when signed in
    path: "/pricing",
    lazy: page(() => import("./features/billing/pages/Pricing"))
  },
  {
    path: "/billing",
    lazy: page(() => import("./features/billing/pages/Billing"), { protect: true })
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
    path: "/account",
    lazy: page(() => import("./features/auth/pages/Account"), { protect: true })
  },
  {
    // signed in; the page and every /api/admin call also check the admin role
    path: "/admin",
    lazy: page(() => import("./features/admin/pages/Admin"), { protect: true })
  },
  {
    // public: a report opened through its read-only share link
    path: "/shared/:token",
    lazy: page(() => import("./features/share/pages/SharedReport"))
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
