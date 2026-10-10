import { useState } from "react";
import { NavLink } from "react-router-dom";
import { logout } from "../services/auth";
import { MAIN_NAV, MORE_NAV } from "./navItems";

// Only visible on small screens (see the media query in global.css)
export default function BottomNav() {
  const [open, setOpen] = useState(false);

  return (
    <>
      {open && <div className="sheet-backdrop" onClick={() => setOpen(false)} />}

      {open && (
        <div className="more-sheet">
          {MORE_NAV.map((l) => (
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
        {MAIN_NAV.map((l) => (
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
