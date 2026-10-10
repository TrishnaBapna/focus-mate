import { NavLink } from "react-router-dom";
import { logout } from "../services/auth";
import { SETTINGS_NAV } from "./navItems";

// Phone-only header, so Settings and Log out are always one tap away
export default function TopBar() {
  return (
    <header className="topbar">
      <span className="topbar-title">⏱️ Focus Mate</span>
      <div className="topbar-actions">
        <NavLink to={SETTINGS_NAV.to} className="topbar-btn" aria-label="Settings">
          {SETTINGS_NAV.icon}
        </NavLink>
        <button className="topbar-btn" onClick={() => logout()} aria-label="Log out">
          🚪
        </button>
      </div>
    </header>
  );
}
