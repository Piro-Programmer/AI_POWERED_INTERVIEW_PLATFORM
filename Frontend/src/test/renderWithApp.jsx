import { useState } from "react";
import { render } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { AuthContext } from "../features/auth/auth.context";

// Real auth state (no network) so pages that use useAuth behave as in the app.
const TestAuthProvider = ({ user: initialUser, children }) => {
  const [user, setUser] = useState(initialUser);
  const [loading, setLoading] = useState(false);
  return <AuthContext.Provider value={{ user, setUser, loading, setLoading }}>{children}</AuthContext.Provider>;
};

/** Render `ui` at `path` inside a router, with an optional signed-in user. */
export function renderWithApp(ui, { path = "/", route = path, user = null } = {}) {
  return render(
    <TestAuthProvider user={user}>
      <MemoryRouter initialEntries={[route]}>
        <Routes>
          <Route path={path} element={ui} />
          <Route path="*" element={<p>navigated away</p>} />
        </Routes>
      </MemoryRouter>
    </TestAuthProvider>
  );
}
