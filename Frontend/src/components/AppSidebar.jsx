import { NavLink } from "react-router-dom";
import { useAuth } from "../features/auth/hooks/useAuth";
import Wordmark from "./Wordmark";

const navClass = ({ isActive }) => `side-nav__item ${isActive ? "side-nav__item--active" : ""}`;

// Sidebar shared by the signed-in pages (dashboard and report history).
const AppSidebar = () => {
  const { user, handleLogout } = useAuth();

  return (
    <aside className="workspace-sidebar">
      <Wordmark />
      <nav className="side-nav" aria-label="Main navigation">
        <NavLink className={navClass} to="/dashboard">Your desk</NavLink>
        <NavLink className={navClass} to="/interview">New report</NavLink>
        <NavLink className={navClass} to="/reports">Your reports</NavLink>
      </nav>
      <div className="sidebar-profile">
        <span className="avatar">{user?.username?.slice(0, 1)?.toUpperCase() || "U"}</span>
        <div>
          <strong>{user?.username || "Candidate"}</strong>
          <small>{user?.email}</small>
        </div>
      </div>
      <button className="ghost-button" onClick={handleLogout}>Sign out</button>
    </aside>
  );
};

export default AppSidebar;
