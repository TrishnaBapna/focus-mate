import { useMemo } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../hooks/useAuth";
import { useSessions } from "../hooks/useSessions";
import { useSettings } from "../hooks/useSettings";
import { useTasks } from "../hooks/useTasks";
import { setTaskStatus } from "../services/tasks";
import { computeStats, sessionDate } from "../utils/stats";
import { sortTasks } from "../utils/tasks";
import { formatDuration } from "../utils/time";
import TaskRow from "../components/TaskRow";
import TodaysPlanCard from "../components/TodaysPlanCard";

const RING_RADIUS = 54;
const RING_LENGTH = 2 * Math.PI * RING_RADIUS;

function greeting() {
  const hour = new Date().getHours();
  if (hour < 12) return "Good morning";
  if (hour < 17) return "Good afternoon";
  return "Good evening";
}

export default function Dashboard() {
  const { user } = useAuth();
  const { settings } = useSettings();
  const { sessions } = useSessions(500);
  const { tasks } = useTasks();
  const stats = useMemo(() => computeStats(sessions), [sessions]);
  const upNext = useMemo(
    () => sortTasks(tasks.filter((t) => t.status !== "done")).slice(0, 5),
    [tasks]
  );

  const name = user?.displayName?.split(" ")[0] ?? "there";
  const goalSeconds = settings.dailyGoalMinutes * 60;
  const percent = Math.min(100, Math.round((stats.todaySeconds / goalSeconds) * 100));
  const maxDay = Math.max(...stats.week.map((d) => d.seconds), 1);
  const maxSubject = Math.max(...stats.bySubject.map((s) => s.seconds), 1);

  return (
    <>
      <div className="stats-grid">
        {/* Hero */}
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
            <p className="streak-pill">🔥 {stats.currentStreak} day streak</p>
          </div>
          <Link to="/focus" className="btn hero-btn">
            Start focus
          </Link>
        </section>

        {/* Today's plan */}
        <TodaysPlanCard />

        {/* Up next (tasks) */}
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
            View all tasks →
          </Link>
        </section>

        {/* Today's goal ring */}
        <section className="card center-card">
          <h3>Today's focus</h3>
          <svg viewBox="0 0 140 140" className="ring">
            <circle cx="70" cy="70" r={RING_RADIUS} className="ring-track" />
            <circle
              cx="70"
              cy="70"
              r={RING_RADIUS}
              className="ring-fill"
              strokeDasharray={`${(percent / 100) * RING_LENGTH} ${RING_LENGTH}`}
              transform="rotate(-90 70 70)"
            />
            <text x="70" y="77" textAnchor="middle" className="ring-text">
              {percent}%
            </text>
          </svg>
          <p className="muted">
            {formatDuration(stats.todaySeconds)} of {formatDuration(goalSeconds)}
          </p>
        </section>

        {/* Weekly chart */}
        <section className="card">
          <h3>Weekly productivity</h3>
          <div className="bars">
            {stats.week.map((d) => (
              <div key={d.key} className={`bar-col ${d.isToday ? "today" : ""}`}>
                <div className="bar-track">
                  <div
                    className="bar-fill"
                    style={{ height: `${(d.seconds / maxDay) * 100}%` }}
                    title={formatDuration(d.seconds)}
                  />
                </div>
                <span>{d.label}</span>
              </div>
            ))}
          </div>
          <p className="muted">This week: {formatDuration(stats.weekSeconds)}</p>
        </section>

        {/* Streak */}
        <section className="card">
          <h3>🔥 {stats.currentStreak} day streak</h3>
          <div className="streak-row">
            {stats.week.map((d) => (
              <div key={d.key} className="streak-day">
                <span className={`streak-dot ${d.seconds > 0 ? "done" : ""}`}>
                  {d.seconds > 0 ? "✓" : ""}
                </span>
                <span>{d.label}</span>
              </div>
            ))}
          </div>
          <p className="muted">Longest streak: {stats.longestStreak} days</p>
        </section>

        {/* Subject breakdown */}
        <section className="card">
          <h3>By subject (last 7 days)</h3>
          {stats.bySubject.length === 0 ? (
            <p className="empty-note">Nothing yet. Start a focus session!</p>
          ) : (
            <ul className="breakdown">
              {stats.bySubject.map((s) => (
                <li key={s.name}>
                  <div className="breakdown-head">
                    <span>
                      {s.emoji} {s.name}
                    </span>
                    <strong>{formatDuration(s.seconds)}</strong>
                  </div>
                  <div className="progress">
                    <div
                      className="progress-fill"
                      style={{ width: `${(s.seconds / maxSubject) * 100}%` }}
                    />
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>

        {/* History */}
        <section className="card history-card">
          <h3>Study history</h3>
          {sessions.length === 0 ? (
            <p className="empty-note">Your finished sessions will appear here.</p>
          ) : (
            <ul className="history-list">
              {sessions.slice(0, 8).map((s) => (
                <li key={s.id}>
                  <span className="history-date">
                    {sessionDate(s).toLocaleDateString(undefined, {
                      day: "numeric",
                      month: "short",
                    })}
                  </span>
                  <span className="history-main">
                    {s.subjectEmoji} {s.subjectName}
                    {s.topic && ` · ${s.topic}`}
                  </span>
                  <strong>{formatDuration(s.durationSeconds)}</strong>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </>
  );
}
