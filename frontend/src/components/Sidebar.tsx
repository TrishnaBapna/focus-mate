import { NavLink } from "react-router-dom";
import MoreMenu from "./MoreMenu";
import { MAIN_NAV } from "./navItems";

export default function Sidebar() {
  return (
    <nav className="sidebar">
      {MAIN_NAV.map((l) => (
        <NavLink key={l.to} to={l.to} end={l.to === "/"} className="side-link">
          <span className="side-icon">{l.icon}</span>
          <span className="side-label">{l.label}</span>
        </NavLink>
      ))}
      <MoreMenu />
    </nav>
  );
}
