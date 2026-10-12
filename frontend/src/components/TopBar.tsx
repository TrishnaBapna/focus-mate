import { NavLink, useLocation } from "react-router-dom";
import { useAuth } from "../hooks/useAuth";
import { useFocus } from "../hooks/useFocus";
import { logout } from "../services/auth";
import Icon from "./Icon";
import NotificationsBell from "./NotificationsBell";
import { SETTINGS_NAV } from "./navItems";

const TITLES: Record<string, string> = {
  "/focus": "Focus",
  "/notes": "Notes",
  "/tasks": "Tasks",
  "/planner": "Plan",
  "/study": "Study",
  "/exams": "Exams",
  "/subjects": "Subjects",
  "/achievements": "Awards",
  "/analytics": "Stats",
  "/assistant": "Assistant",
  "/settings": "Settings",
};

function titleFor(pathname: string) {
  if (pathname === "/") return "Overview";
  return TITLES["/" + pathname.split("/")[1]] ?? "Focus Mate";
}

// The white bar across the top: title, Focus Mode switch, bell, and you
export default function TopBar() {
  const { pathname } = useLocation();
  const { user } = useAuth();
  const f = useFocus();

  const name = user?.displayName?.trim() || "Student";
  const initial = name.charAt(0).toUpperCase();
  const sessionRunning = f.phase === "focus" || f.phase === "break";

  function toggleFocusMode() {
    if (sessionRunning) return;
    const next = !f.strict;
    if (next && f.mode === "stopwatch") f.setMode("pomodoro"); // strict needs a timer length
    f.setStrict(next);
  }

  return (
    <header className="wf-topbar">
      <span className="wf-title">{titleFor(pathname)}</span>

      <div className="wf-actions">
        <button
          type="button"
          className={`focus-mode ${f.strict ? "on" : ""}`}
          role="switch"
          aria-checked={f.strict}
          title="Focus Mode: locks the app during your next session (strict mode)"
          onClick={toggleFocusMode}
        >
          <span className="focus-mode-label">Focus Mode</span>
          <span className="switch">
            <span className="knob" />
          </span>
        </button>

        <NotificationsBell />

        <NavLink to={SETTINGS_NAV.to} className="icon-btn wf-phone-only" aria-label="Settings">
          <Icon name="sliders" size={18} />
        </NavLink>
        <button className="icon-btn wf-phone-only" aria-label="Log out" onClick={() => logout()}>
          <Icon name="logout" size={18} />
        </button>

        <NavLink to="/settings" className="wf-user" title="Your profile and settings">
          <span className="avatar">{initial}</span>
          <span className="wf-user-text">
            <strong>{name}</strong>
            <span>{user?.email}</span>
          </span>
        </NavLink>
      </div>
    </header>
  );
}
