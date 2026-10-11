import { useMemo } from "react";
import { Link } from "react-router-dom";
import GardenCard from "../components/GardenCard";
import ExamCountdownCard from "../components/ExamCountdownCard";
import StudyDueCard from "../components/StudyDueCard";
import SuggestionsCard from "../components/SuggestionsCard";
import TodaysPlanCard from "../components/TodaysPlanCard";
import TaskRow from "../components/TaskRow";
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
  const userInitial = name.charAt(0).toUpperCase();
  const goalSeconds = (settings.dailyGoalMinutes || 60) * 60;
  const percent = Math.min(100, Math.round(((stats.todaySeconds || 0) / goalSeconds) * 100));

  const calendarDays = [
    '', '', '', '', '', '', 1,
    2, 3, 4, 5, 6, 7, 8,
    9, 10, 11, 12, 13, 14, 15,
    16, 17, 18, 19, 20, 21, 22,
    23, 24, 25, 26, 27, 28, 29
  ];
  const currentDay = new Date().getDate();

  return (
    <div className="wf-main-content">
      {/* Top Bar with real user info */}
      <header className="wf-topbar">
        <div className="wf-topbar-title">Overview</div>
        <div className="wf-topbar-actions">
          <Link to="/focus" className="focus-mode-btn">
            <span>Focus Mode</span>
            <span className="fm-pill-indicator"></span>
          </Link>

          <div className="wf-user-profile">
            <div className="wf-avatar-circle">
              {user?.photoURL ? (
                <img src={user.photoURL} alt={name} />
              ) : (
                <span>{userInitial}</span>
              )}
            </div>
            <div className="wf-user-info">
              <strong>{user?.displayName || "Student"}</strong>
              <span>Level {progress.level.level}</span>
            </div>
          </div>
        </div>
      </header>

      {/* Main 2-Column Grid */}
      <div className="wf-grid-layout">
        {/* Left Column */}
        <div className="wf-col-left">
          {/* Fairytale Sunrise Hero Banner */}
          <section className="wf-hero-card">
            <div className="wf-hero-art">
              <div className="wf-sun-orb"></div>
              <svg className="wf-castle-skyline" viewBox="0 0 600 220" preserveAspectRatio="none">
                <defs>
                  <linearGradient id="skylineGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#DF9B82" stopOpacity="0.8" />
                    <stop offset="100%" stopColor="#C97561" stopOpacity="0.95" />
                  </linearGradient>
                </defs>
                <path d="M0,220 L0,170 L25,170 L25,120 L35,90 L45,120 L45,170 L70,170 L70,140 L80,110 L90,140 L90,170 L130,170 L130,130 L140,80 L150,130 L150,170 L180,170 L180,100 L195,60 L210,100 L210,170 L250,170 L260,110 L270,170 L300,170 L300,80 L315,40 L330,80 L330,170 L360,170 L370,120 L380,170 L420,170 L420,100 L435,50 L450,100 L450,170 L490,170 L500,120 L510,170 L550,170 L550,90 L565,55 L580,90 L580,170 L600,170 L600,220 Z" fill="url(#skylineGrad)" />
              </svg>
            </div>

            <div className="wf-hero-body">
              <div className="wf-hero-text">
                <h2>{greeting()}, {name}! 👋</h2>
                <p>
                  {stats.todaySeconds > 0
                    ? `You've focused for ${formatDuration(stats.todaySeconds)} today. Keep going!`
                    : `Ready for your first focus session today?`}
                </p>
                <Link to="/focus" className="wf-ready-btn">
                  Start focus
                </Link>
              </div>

              {/* Mini Calendar */}
              <div className="wf-mini-cal">
                <div className="cal-days-header">
                  <span>M</span><span>T</span><span>W</span><span>T</span><span>F</span><span>S</span><span>S</span>
                </div>
                <div className="cal-grid">
                  {calendarDays.map((d, index) => (
                    <div 
                      key={index} 
                      className={`cal-cell ${d === currentDay ? 'today-highlight' : ''}`}
                    >
                      {d}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </section>

          {/* Stats & Performance Row */}
          <div className="wf-two-cards-row">
            <div className="wf-white-card">
              <h3 className="wf-card-title">Daily Goal & Streak</h3>
              <div className="real-stats-summary">
                <div className="stat-item">
                  <span className="stat-label">Focused Today</span>
                  <strong className="stat-val">
                    {stats.todaySeconds > 0 ? formatDuration(stats.todaySeconds) : "0 min"}
                  </strong>
                </div>
                <div className="stat-item">
                  <span className="stat-label">🔥 Streak</span>
                  <strong className="stat-val">{stats.currentStreak}</strong>
                </div>
                <div className="stat-item">
                  <span className="stat-label">Level</span>
                  <strong className="stat-val">{progress.level.level}</strong>
                </div>
              </div>

              <div className="goal-progress-wrap">
                <div className="goal-progress-bar">
                  <div className="goal-fill" style={{ width: `${percent}%` }}></div>
                </div>
                <span className="goal-caption">{percent}% of your {formatDuration(goalSeconds)} goal</span>
              </div>
            </div>

            {/* Circular Donut Ring */}
            <div className="wf-white-card wf-perf-card">
              <div className="wf-card-head">
                <h3 className="wf-card-title">Task Performance</h3>
                <span className="perf-sub">Today</span>
              </div>

              <div className="donut-wrap">
                <svg viewBox="0 0 120 120" className="donut-svg">
                  <circle cx="60" cy="60" r="48" className="donut-bg" />
                  <circle 
                    cx="60" 
                    cy="60" 
                    r="48" 
                    className="donut-val" 
                    strokeDasharray="301.59"
                    strokeDashoffset={301.59 - (301.59 * percent) / 100}
                  />
                  <text x="60" y="66" className="donut-pct">{percent}%</text>
                </svg>
              </div>

              <div className="perf-legend">
                <span className="legend-dot"></span>
                <span>Productive Hours Goal</span>
              </div>
            </div>
          </div>

          {/* 🌱 Your Garden */}
          <GardenCard />

          {/* 💡 Suggestions */}
          <SuggestionsCard />

          {/* 📅 Today's Plan */}
          <TodaysPlanCard />
        </div>

        {/* Right Column */}
        <div className="wf-col-right">
          {/* ✅ Up next Tasks */}
          <div className="wf-white-card wf-tasks-card">
            <div className="wf-card-head">
              <h3 className="wf-card-title">Up next</h3>
              <Link to="/tasks" className="view-tasks-link">All tasks →</Link>
            </div>

            {upNext.length === 0 ? (
              <p className="no-tasks-text">No open tasks. Nice! 🎉</p>
            ) : (
              <ul className="wf-real-task-list">
                {upNext.map((task) => (
                  <TaskRow
                    key={task.id}
                    task={task}
                    onStatusClick={() => user && setTaskStatus(user.uid, task.id, "done")}
                  />
                ))}
              </ul>
            )}

            <Link to="/tasks" className="add-task-quick-btn">
              + View All Tasks
            </Link>
          </div>

          {/* ⏱️ Pomodoro Action Card */}
          <div className="wf-pomo-action-card">
            <h3>Pomodoro Focus</h3>
            <p className="pomo-sub">Ready for a 25-minute deep work session?</p>
            <div className="pomo-hourglass-icon">⏳</div>
            <Link to="/focus" className="pomo-start-link">
              Start Session
            </Link>
          </div>

          {/* 🎓 Exam Countdown */}
          <ExamCountdownCard />

          {/* 🎴 Flashcards Due */}
          <StudyDueCard />

          {/* 📊 Full Stats & 🏆 Achievements */}
          <div className="wf-bottom-links-row">
            <Link to="/analytics" className="wf-bottom-btn">
              📊 Full stats
            </Link>
            <Link to="/achievements" className="wf-bottom-btn">
              🏆 Achievements
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}