import { useAchievements } from "../hooks/useAchievements";
import { formatProgress } from "../utils/achievements";
import { formatDuration } from "../utils/time";

export default function Achievements() {
  const { progress, unlockedAt } = useAchievements();
  const { level } = progress;

  return (
    <>
      <h1 className="page-title">Achievements 🏆</h1>

      <section className="card level-card">
        <div className="level-head">
          <span className="level-badge">LEVEL {level.level}</span>
          <span className="muted">{progress.xp} XP total</span>
        </div>
        <div className="progress big">
          <div className="progress-fill" style={{ width: `${level.percent}%` }} />
        </div>
        <p className="muted">
          {level.current} / {level.needed} XP to level {level.level + 1}
        </p>
        <details className="xp-help">
          <summary>How do I earn XP?</summary>
          <ul>
            <li>1 XP for every minute you focus</li>
            <li>20 XP for each task you complete</li>
            <li>10 XP for each note you write</li>
            <li>10 XP for every day of your longest streak</li>
            <li>50 XP for each badge you unlock</li>
          </ul>
        </details>
      </section>

      <div className="stat-chips">
        <span className="stat-chip">⏱️ {formatDuration(progress.totalSeconds)} focused</span>
        <span className="stat-chip">🎯 {progress.sessionCount} sessions</span>
        <span className="stat-chip">🔥 {progress.longestStreak} day best streak</span>
        <span className="stat-chip">✅ {progress.tasksDone} tasks done</span>
        <span className="stat-chip">📝 {progress.notesCount} notes</span>
      </div>

      <h3 className="past-title">
        Badges ({progress.unlockedCount}/{progress.achievements.length})
      </h3>
      <div className="badge-grid">
        {progress.achievements.map((a) => {
          const at = unlockedAt[a.id];
          return (
            <div key={a.id} className={`card badge ${a.unlocked ? "unlocked" : "locked"}`}>
              <span className="badge-emoji">{a.unlocked ? a.emoji : "🔒"}</span>
              <strong>{a.title}</strong>
              <span className="muted">{a.description}</span>
              {a.unlocked ? (
                <span className="saved-note">
                  Unlocked ✓
                  {at && ` ${new Date(at).toLocaleDateString(undefined, { day: "numeric", month: "short" })}`}
                </span>
              ) : (
                <>
                  <div className="progress">
                    <div className="progress-fill" style={{ width: `${a.percent}%` }} />
                  </div>
                  <span className="muted">{formatProgress(a)}</span>
                </>
              )}
            </div>
          );
        })}
      </div>
    </>
  );
}
