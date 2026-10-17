import { Link } from "react-router-dom";
import { useAchievements } from "../hooks/useAchievements";

export default function LevelCard() {
  const { progress } = useAchievements();
  const { level } = progress;

  return (
    <section className="card">
      <h3>Level {level.level}</h3>
      <div
        className="progress"
        role="progressbar"
        aria-valuenow={Math.min(100, Math.max(0, Math.round(level.percent)))}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label={`Level ${level.level} progress: ${level.percent}% (${level.current} of ${level.needed} XP)`}
      >
        <div className="progress-fill" style={{ width: `${level.percent}%` }} />
      </div>
      <p className="muted level-xp">
        {level.current} / {level.needed} XP
      </p>
      <p className="muted">
        🏆 {progress.unlockedCount} of {progress.achievements.length} achievements
      </p>
      <Link to="/achievements" className="link-btn view-all">
        See achievements →
      </Link>
    </section>
  );
}
