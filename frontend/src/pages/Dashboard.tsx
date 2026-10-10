import { useMemo } from "react";
import { Link } from "react-router-dom";
import ExamCountdownCard from "../components/ExamCountdownCard";
import StudyDueCard from "../components/StudyDueCard";
import SuggestionsCard from "../components/SuggestionsCard";
import TaskRow from "../components/TaskRow";
import TodaysPlanCard from "../components/TodaysPlanCard";
import { useAchievements } from "../hooks/useAchievements";
import { useAuth } from "../hooks/useAuth";
import { useSettings } from "../hooks/useSettings";
import { setTaskStatus } from "../services/tasks";
import { computeStats } from "../utils/stats";
import { sortTasks } from "../utils/tasks";
import { formatDuration } from "../utils/time";

function greeting() {
  const hour = new Date().getHours();
  if (hour < 12) return "Good morning";
  if (hour < 17) return "Good afternoon";
  return "Good evening";
}

export default function Dashboard() {
  const { user } = useAuth();
  const { settings } = useSettings();
  const { sessions, tasks, progress } = useAchievements();

  const stats = useMemo(() => computeStats(sessions), [sessions]);
  const upNext = useMemo(
    () => sortTasks(tasks.filter((t) => t.status !== "done")).slice(0, 3),
    [tasks]
  );

  const name = user?.displayName?.split(" ")[0] ?? "there";
  const goalSeconds = settings.dailyGoalMinutes * 60;
  const percent = Math.min(100, Math.round((stats.todaySeconds / goalSeconds) * 100));

  return (
    <div className="home">
      <section className="card hero-card">
        <div>
          <h1>
            {greeting()}, {name}! 👋
          </h1>
          <p className="hero-sub">
            {stats.todaySeconds > 0
              ? `You've focused for ${formatDuration(stats.todaySeconds)} today. Keep going!`
              : "Ready for your first focus session today?"}
          </p>
        </div>
        <Link to="/focus" className="btn hero-btn">
          Start focus
        </Link>
      </section>

      <section className="card">
        <div className="mini-stats">
          <div className="mini-stat">
            <span className="stat-label">Today</span>
            <span className="stat-big">
              {stats.todaySeconds > 0 ? formatDuration(stats.todaySeconds) : "0 min"}
            </span>
          </div>
          <div className="mini-stat">
            <span className="stat-label">🔥 Streak</span>
            <span className="stat-big">{stats.currentStreak}</span>
          </div>
          <div className="mini-stat">
            <span className="stat-label">Level</span>
            <span className="stat-big">{progress.level.level}</span>
          </div>
        </div>
        <div className="progress goal-bar">
          <div className="progress-fill" style={{ width: `${percent}%` }} />
        </div>
        <p className="muted goal-text">
          {percent}% of your {formatDuration(goalSeconds)} goal
        </p>
      </section>

      <SuggestionsCard />

      <TodaysPlanCard />

      <section className="card">
        <h3>Up next</h3>
        {upNext.length === 0 ? (
          <p className="empty-note">No open tasks. Nice! 🎉</p>
        ) : (
          <ul className="task-list">
            {upNext.map((t) => (
              <TaskRow
                key={t.id}
                task={t}
                onStatusClick={() => user && setTaskStatus(user.uid, t.id, "done")}
              />
            ))}
          </ul>
        )}
        <Link to="/tasks" className="link-btn view-all">
          All tasks →
        </Link>
      </section>

      <ExamCountdownCard />

      <StudyDueCard />

      <div className="home-links">
        <Link to="/analytics" className="link-btn">
          📊 Full stats
        </Link>
        <Link to="/achievements" className="link-btn">
          🏆 Achievements
        </Link>
      </div>
    </div>
  );
}
