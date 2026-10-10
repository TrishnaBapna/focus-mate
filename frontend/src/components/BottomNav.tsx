import { useState } from "react";
import { NavLink } from "react-router-dom";
import { NAV_ITEMS, PHONE_NAV_COUNT } from "./navItems";

// Only visible on phones (see the media query in global.css)
export default function BottomNav() {
  const [open, setOpen] = useState(false);
  const shown = NAV_ITEMS.slice(0, PHONE_NAV_COUNT);
  const rest = NAV_ITEMS.slice(PHONE_NAV_COUNT);

  return (
    <>
      {open && <div className="sheet-backdrop" onClick={() => setOpen(false)} />}

      {open && (
        <div className="more-sheet">
          {rest.map((l) => (
            <NavLink key={l.to} to={l.to} onClick={() => setOpen(false)}>
              <span>{l.icon}</span>
              {l.label}
            </NavLink>
          ))}
        </div>
      )}

      <nav className="bottom-nav">
        {shown.map((l) => (
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
