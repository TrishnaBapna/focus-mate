import { Link, useLocation } from "react-router-dom";
import { useFocus } from "../hooks/useFocus";

export default function MiniTimer() {
  const { phase, clockText, subject, running } = useFocus();
  const { pathname } = useLocation();

  const active = phase === "focus" || phase === "break";
  if (!active || pathname === "/focus") return null;

  return (
    <Link to="/focus" className="mini-timer" title="Back to your focus session">
      <span>{phase === "break" ? "☕" : (subject?.emoji ?? "⏱️")}</span>
      <strong>{clockText}</strong>
      {!running && <span>⏸</span>}
    </Link>
  );
}
