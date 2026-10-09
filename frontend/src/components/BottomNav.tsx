import { useState } from "react";
import { NavLink } from "react-router-dom";
import { logout } from "../services/auth";

const mainLinks = [
  { to: "/", icon: "🏠", label: "Home" },
  { to: "/planner", icon: "📅", label: "Planner" },
  { to: "/focus", icon: "⏱️", label: "Focus" },
  { to: "/notes", icon: "📝", label: "Notes" },
];

const moreLinks = [
  { to: "/study", icon: "🃏", label: "Study" },
  { to: "/tasks", icon: "✅", label: "Tasks" },
  { to: "/subjects", icon: "📚", label: "Subjects" },
  { to: "/exams", icon: "🎓", label: "Exams" },
  { to: "/achievements", icon: "🏆", label: "Achievements" },
  { to: "/analytics", icon: "📊", label: "Analytics" },
  { to: "/settings", icon: "⚙️", label: "Settings" },
];

// Only visible on small screens (see the media query in global.css)
export default function BottomNav() {
  const [open, setOpen] = useState(false);

  return (
    <>
      {open && <div className="sheet-backdrop" onClick={() => setOpen(false)} />}

      {open && (
        <div className="more-sheet">
          {moreLinks.map((l) => (
            <NavLink key={l.to} to={l.to} onClick={() => setOpen(false)}>
              <span>{l.icon}</span>
              {l.label}
            </NavLink>
          ))}
          <button onClick={() => logout()}>
            <span>🚪</span>
            Log out
          </button>
        </div>
      )}

      <nav className="bottom-nav">
        {mainLinks.map((l) => (
          <NavLink
            key={l.to}
            to={l.to}
            end={l.to === "/"}
            onClick={() => setOpen(false)}
          >
            <span className="bn-icon">{l.icon}</span>
            <span className="bn-label">{l.label}</span>
          </NavLink>
        ))}
        <button className={`bn-more ${open ? "open" : ""}`} onClick={() => setOpen(!open)}>
          <span className="bn-icon">☰</span>
          <span className="bn-label">More</span>
        </button>
      </nav>
    </>
  );
}
