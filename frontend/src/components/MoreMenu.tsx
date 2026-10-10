import { useState } from "react";
import { NavLink } from "react-router-dom";
import type { NavItem } from "./navItems";

// The "More" button and its pop-up on the sidebar (only the items that didn't fit)
export default function MoreMenu({ items }: { items: NavItem[] }) {
  const [open, setOpen] = useState(false);

  return (
    <div className="more-wrap">
      {open && <div className="pop-backdrop" onClick={() => setOpen(false)} />}

      {open && (
        <div className="more-pop">
          {items.map((l) => (
            <NavLink key={l.to} to={l.to} onClick={() => setOpen(false)}>
              <span>{l.icon}</span>
              {l.label}
            </NavLink>
          ))}
        </div>
      )}

      <button className={`more-btn ${open ? "open" : ""}`} onClick={() => setOpen(!open)}>
        <span className="side-icon">☰</span>
        <span className="side-label">More</span>
      </button>
    </div>
  );
}
