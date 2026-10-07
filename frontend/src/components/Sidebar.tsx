import { NavLink } from "react-router-dom";
import { logout } from "../services/auth";

const links = [
  { to: "/", icon: "🏠", label: "Dashboard" },
  { to: "/tasks", icon: "✅", label: "Tasks" },
  { to: "/subjects", icon: "📚", label: "Subjects" },
  { to: "/planner", icon: "📅", label: "Planner" },
  { to: "/focus", icon: "⏱️", label: "Focus" },
  { to: "/notes", icon: "📝", label: "Notes" },
  { to: "/analytics", icon: "📊", label: "Analytics" },
  { to: "/settings", icon: "⚙️", label: "Settings" },
];

export default function Sidebar() {
  return (
    <nav className="sidebar">
      {links.map((l) => (
        <NavLink key={l.to} to={l.to} title={l.label} end={l.to === "/"}>
          {l.icon}
        </NavLink>
      ))}
      <button className="logout-btn" title="Log out" onClick={() => logout()}>
        🚪
      </button>
    </nav>
  );
}
