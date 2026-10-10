import { useState } from "react";
import { NavLink } from "react-router-dom";
import { logout } from "../services/auth";
import { MORE_NAV } from "./navItems";

// The "More" button and its pop-up menu on the desktop sidebar
export default function MoreMenu() {
  const [open, setOpen] = useState(false);

  return (
    <div className="more-wrap">
      {open && <div className="pop-backdrop" onClick={() => setOpen(false)} />}

      {open && (
        <div className="more-pop">
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

      <button className={`more-btn ${open ? "open" : ""}`} onClick={() => setOpen(!open)}>
        <span className="side-icon">☰</span>
        <span className="side-label">More</span>
      </button>
    </div>
  );
}
