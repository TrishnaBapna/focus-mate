import { useState } from "react";
import { NavLink } from "react-router-dom";
import { useNavLayout } from "../hooks/useNavLayout";
import { logout } from "../services/auth";
import Icon from "./Icon";
import { NAV_ITEMS, SETTINGS_NAV } from "./navItems";

// The slim orange rail on the left
export default function Sidebar() {
  const { count } = useNavLayout();
  const [open, setOpen] = useState(false);
  const shown = NAV_ITEMS.slice(0, count);
  const rest = NAV_ITEMS.slice(count);

  return (
    <nav className="wf-rail" aria-label="Main">
      <div className="wf-rail-inner">
        <div className="rail-top">
          {shown.map((l) => (
            <NavLink
              key={l.to}
              to={l.to}
              end={l.to === "/"}
              className="rail-link"
              title={l.label}
              aria-label={l.label}
            >
              <Icon name={l.icon} />
            </NavLink>
          ))}

          {rest.length > 0 && (
            <div className="rail-more">
              {open && <div className="pop-backdrop" onClick={() => setOpen(false)} />}
              {open && (
                <div className="rail-pop">
                  {rest.map((l) => (
                    <NavLink key={l.to} to={l.to} onClick={() => setOpen(false)}>
                      <Icon name={l.icon} size={18} />
                      {l.label}
                    </NavLink>
                  ))}
                </div>
              )}
              <button
                className={`rail-link ${open ? "open" : ""}`}
                title="More"
                aria-label="More"
                onClick={() => setOpen(!open)}
              >
                <Icon name="dots" />
              </button>
            </div>
          )}
        </div>

        <div className="rail-bottom">
          <NavLink
            to={SETTINGS_NAV.to}
            className="rail-link"
            title={SETTINGS_NAV.label}
            aria-label={SETTINGS_NAV.label}
          >
            <Icon name={SETTINGS_NAV.icon} />
          </NavLink>
          <button className="rail-link" title="Log out" aria-label="Log out" onClick={() => logout()}>
            <Icon name="logout" />
          </button>
        </div>
      </div>
    </nav>
  );
}
