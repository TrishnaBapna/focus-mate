import { Link } from "react-router-dom";
import { usePlans } from "../hooks/usePlans";
import { dayKey } from "../utils/stats";
import { endTime, formatTime, occursOn } from "../utils/plans";
import ExamCountdownCard from "./ExamCountdownCard";
import LevelCard from "./LevelCard";

export default function TodaysPlanCard() {
  const { plans } = usePlans();
  const today = dayKey(new Date());
  const blocks = plans
    .filter((p) => occursOn(p, today))
    .sort((a, b) => a.startTime.localeCompare(b.startTime));

  return (
    <>
      <ExamCountdownCard />

      <section className="card">
        <h3>Today's plan</h3>
        {blocks.length === 0 ? (
          <p className="empty-note">Nothing scheduled today.</p>
        ) : (
          <ul className="plan-list">
            {blocks.map((p) => (
              <li key={p.id} className="plan-row compact">
                <span className="plan-time">
                  {formatTime(p.startTime)} – {formatTime(endTime(p.startTime, p.durationMinutes))}
                </span>
                <span>
                  {p.subjectEmoji} {p.subjectName}
                  {p.topic && ` · ${p.topic}`}
                </span>
              </li>
            ))}
          </ul>
        )}
        <Link to="/planner" className="link-btn view-all">
          Open planner →
        </Link>
      </section>

      <LevelCard />
    </>
  );
}
