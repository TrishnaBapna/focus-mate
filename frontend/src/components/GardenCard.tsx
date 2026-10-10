import { useState } from "react";
import { useAchievements } from "../hooks/useAchievements";
import { isWilted, sessionPlant } from "../utils/garden";
import { dayKey, sessionDate } from "../utils/stats";
import { formatDuration } from "../utils/time";

export default function GardenCard() {
  const { sessions } = useAchievements();
  const [showAll, setShowAll] = useState(false);

  const shown = sessions.slice(0, showAll ? 200 : 28); // newest first
  const todayKey = dayKey(new Date());
  const today = sessions.filter((s) => dayKey(sessionDate(s)) === todayKey).length;
  const wilted = sessions.filter(isWilted).length;

  return (
    <section className="card">
      <h3>🌱 Your garden</h3>
      {sessions.length === 0 ? (
        <p className="empty-note">Finish a focus session to plant your first seed 🌱</p>
      ) : (
        <>
          <div className="garden">
            {shown.map((s) => (
              <span
                key={s.id}
                className="plant"
                title={`${s.subjectName} · ${formatDuration(s.durationSeconds)}`}
              >
                {sessionPlant(s)}
              </span>
            ))}
          </div>
          <p className="muted garden-count">
            {today} planted today · {sessions.length} in total
            {wilted > 0 ? ` · ${wilted} wilted 🥀` : ""}
          </p>
          {sessions.length > 28 && (
            <button className="link-btn" onClick={() => setShowAll(!showAll)}>
              {showAll ? "Show less" : `Show more (${Math.min(sessions.length, 200)})`}
            </button>
          )}
        </>
      )}
    </section>
  );
}
