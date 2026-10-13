import { NavLink } from "react-router-dom";
import { useNavLayout } from "../hooks/useNavLayout";
import { logout } from "../services/auth";
import MoreMenu from "./MoreMenu";
import { NAV_ITEMS, SETTINGS_NAV } from "./navItems";

export default function Sidebar() {
  const { count } = useNavLayout();
  const shown = NAV_ITEMS.slice(0, count);
  const rest = NAV_ITEMS.slice(count);

  return (
    <nav className="sidebar">
      {shown.map((l) => (
        <NavLink key={l.to} to={l.to} end={l.to === "/"} className="side-link">
          <span className="side-icon">{l.icon}</span>
          <span className="side-label">{l.label}</span>
        </NavLink>
      ))}

      {rest.length > 0 && <MoreMenu items={rest} />}

      <div className="side-bottom">
        <NavLink to={SETTINGS_NAV.to} className="side-link">
          <span className="side-icon">{SETTINGS_NAV.icon}</span>
          <span className="side-label">{SETTINGS_NAV.label}</span>
        </NavLink>
        <button className="side-link" onClick={() => logout()}>
          <span className="side-icon">🚪</span>
          <span className="side-label">Log out</span>
        </button>
      </div>
    </nav>
  );
}
