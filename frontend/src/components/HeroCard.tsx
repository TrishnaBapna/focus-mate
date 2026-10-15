import { Link } from "react-router-dom";
import { useHour } from "../hooks/useHour";
import { sceneForHour } from "../utils/scene";
import MiniCalendar from "./MiniCalendar";

// A simple skyline silhouette for the bottom of the hero
function Skyline() {
  return (
    <svg className="wf-skyline" viewBox="0 0 400 100" preserveAspectRatio="none" aria-hidden="true">
      <path
        d="M0 100V70h18V54l7-16 7 16v16h20V62h12V44l6-14 6 14v18h16v10h22V56l9-20 9 20v36h28V66h18V50l7-15 7 15v16h24v14h22V60l8-18 8 18v32h30V72h20V58l6-13 6 13v14h84v28z"
        fill="rgba(110, 50, 80, 0.55)"
      />
    </svg>
  );
}

export default function HeroCard({
  name,
  count,
  streak = 0,
}: {
  name: string;
  count: number;
  streak?: number;
}) {
  const hour = useHour();
  const scene = sceneForHour(hour);
  const greeting = hour < 12 ? "Good morning" : hour < 17 ? "Good afternoon" : "Good evening";

  return (
    <section className={`wf-hero hero-${scene}`}>
      <Skyline />
      <div className="wf-hero-text">
        <div style={{ display: "flex", alignItems: "center", gap: "10px", flexWrap: "wrap" }}>
          <h2>
            {greeting}, {name}!
          </h2>
          {streak > 0 ? (
            <span className="streak-pill" title="Consecutive days studied">
              🔥 {streak} {streak === 1 ? "day streak" : "day streak"}
            </span>
          ) : (
            <span className="streak-pill" style={{ opacity: 0.9 }}>
              🌱 Start your streak
            </span>
          )}
        </div>
        <p>
          {count === 0
            ? "Nothing planned for today. Ready to start?"
            : `You have ${count} ${count === 1 ? "task" : "tasks"} for today`}
        </p>
        <Link to="/focus" className="ready-btn">
          Ready!
        </Link>
      </div>
      <MiniCalendar />
    </section>
  );
}
