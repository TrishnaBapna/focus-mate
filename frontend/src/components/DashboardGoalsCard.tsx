import { Link } from "react-router-dom";
import { useAchievements } from "../hooks/useAchievements";
import { useSubjectGoals } from "../hooks/useSubjectGoals";
import { useSubjects } from "../hooks/useSubjects";
import { computeSubjectGoals, formatStudyTime, formatTargetHours } from "../utils/goals";

export default function DashboardGoalsCard() {
  const { subjects, loading: subjectsLoading } = useSubjects();
  const { goals, loading: goalsLoading } = useSubjectGoals();
  const { sessions, ready: sessionsReady } = useAchievements();

  const loading = subjectsLoading || goalsLoading || !sessionsReady;
  const { progressList, summary } = computeSubjectGoals(subjects, goals, sessions);

  if (loading) {
    return (
      <section className="wf-card dashboard-goals-card">
        <div className="dash-goals-head">
          <h3>Weekly Study Goals 🎯</h3>
        </div>
        <p className="muted" style={{ fontSize: "14px", margin: "10px 0" }}>
          Loading goals…
        </p>
      </section>
    );
  }

  if (progressList.length === 0) {
    return (
      <section className="wf-card dashboard-goals-card empty">
        <div className="dash-goals-head">
          <h3>Weekly Study Goals 🎯</h3>
        </div>
        <p className="dash-goals-sub">
          Set weekly hour targets for your subjects to stay consistent and ace your courses.
        </p>
        <Link to="/subjects" className="btn small" style={{ alignSelf: "flex-start", marginTop: "8px" }}>
          + Set study goals
        </Link>
      </section>
    );
  }

  const previewList = progressList.slice(0, 3);

  return (
    <section className="wf-card dashboard-goals-card">
      <div className="dash-goals-head">
        <div>
          <h3>Weekly Study Goals 🎯</h3>
          <span className="dash-goals-dates">{summary.weekRange.label}</span>
        </div>
        <Link to="/subjects" className="dash-goals-link">
          Manage →
        </Link>
      </div>

      {/* Overall weekly summary track */}
      <div className="dash-goals-summary">
        <div className="dash-summary-row">
          <span className="dash-summary-label">
            {summary.achievedCount} of {summary.goalsCount} completed
          </span>
          <span className="dash-summary-values">
            {formatStudyTime(summary.totalActualSeconds)} / {formatTargetHours(summary.totalTargetHours)} ({summary.totalProgressPercent}%)
          </span>
        </div>
        <div
          className="dash-track"
          role="progressbar"
          aria-valuenow={Math.min(100, summary.totalProgressPercent)}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-label={`Overall weekly study goals progress: ${summary.totalProgressPercent}%`}
        >
          <div
            className={`dash-fill ${summary.allAchieved ? "fill-success" : ""}`}
            style={{ width: `${Math.min(100, summary.totalProgressPercent)}%` }}
          />
        </div>
      </div>

      {/* Mini preview list of individual subject goals */}
      <div className="dash-goals-mini-list">
        {previewList.map((item) => (
          <div key={item.subject.id} className="dash-mini-row">
            <span className="dash-mini-emoji">{item.subject.emoji}</span>
            <div className="dash-mini-center">
              <div className="dash-mini-labels">
                <span className="dash-mini-name">{item.subject.name}</span>
                <span className="dash-mini-time">
                  {formatStudyTime(item.actualSeconds)} / {formatTargetHours(item.targetHours)}
                </span>
              </div>
              <div
                className="dash-mini-track"
                role="progressbar"
                aria-valuenow={Math.min(100, item.progressPercent)}
                aria-valuemin={0}
                aria-valuemax={100}
                aria-label={`${item.subject.name} study goal progress: ${item.progressPercent}%`}
              >
                <div
                  className="dash-mini-fill"
                  style={{
                    width: `${Math.min(100, item.progressPercent)}%`,
                    backgroundColor: item.isAchieved ? "#2f9e57" : item.subject.color || "var(--accent)",
                  }}
                />
              </div>
            </div>
            <span className={`dash-mini-pct ${item.isAchieved ? "text-success" : ""}`}>
              {item.isAchieved ? "✓" : `${item.progressPercent}%`}
            </span>
          </div>
        ))}
      </div>

      {progressList.length > 3 && (
        <div className="dash-goals-more">
          <Link to="/subjects" className="link-btn small">
            +{progressList.length - 3} more subject {progressList.length - 3 === 1 ? "goal" : "goals"}
          </Link>
        </div>
      )}
    </section>
  );
}
