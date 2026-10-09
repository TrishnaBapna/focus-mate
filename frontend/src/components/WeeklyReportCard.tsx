import { useMemo } from "react";
import { Link } from "react-router-dom";
import { useAchievements } from "../hooks/useAchievements";
import { useExams } from "../hooks/useExams";
import { usePlans } from "../hooks/usePlans";
import { useSettings } from "../hooks/useSettings";
import { useSubjects } from "../hooks/useSubjects";
import { buildSuggestions, buildWeeklyReport } from "../utils/insights";
import { formatDuration } from "../utils/time";

export default function WeeklyReportCard() {
  const { sessions, tasks, ready } = useAchievements();
  const { exams } = useExams();
  const { plans } = usePlans();
  const { subjects } = useSubjects();
  const { settings } = useSettings();

  const report = useMemo(
    () => buildWeeklyReport(sessions, tasks, subjects),
    [sessions, tasks, subjects]
  );
  const suggestion = useMemo(
    () =>
      buildSuggestions({
        sessions,
        tasks,
        exams,
        plans,
        subjects,
        goalMinutes: settings.dailyGoalMinutes,
      })[0],
    [sessions, tasks, exams, plans, subjects, settings.dailyGoalMinutes]
  );

  if (!ready) return null;

  return (
    <section className="card report-card">
      <h3>Your week</h3>

      <div className="report-total">
        <span className="stat-big">{formatDuration(report.totalSeconds)} focused</span>
        {report.changePercent !== null && (
          <span className={`change ${report.changePercent >= 0 ? "up" : "down"}`}>
            {report.changePercent >= 0 ? "↑" : "↓"} {Math.abs(report.changePercent)}% from last week
          </span>
        )}
      </div>

      <ul className="report-lines">
        {report.strongest && (
          <li>
            🏆 Strongest: {report.strongest.emoji} {report.strongest.name} (
            {formatDuration(report.strongest.seconds)})
          </li>
        )}
        {report.least && (
          <li>
            📉 Least studied: {report.least.emoji} {report.least.name} (
            {formatDuration(report.least.seconds)})
          </li>
        )}
        {report.bestWindow && <li>⏰ Best focus time: {report.bestWindow}</li>}
        <li>
          📆 Studied on {report.daysStudied} of 7 days · {report.sessionCount} session
          {report.sessionCount === 1 ? "" : "s"}
        </li>
        {report.longestSeconds > 0 && <li>⌛ Longest session: {formatDuration(report.longestSeconds)}</li>}
        <li>✅ Tasks completed: {report.tasksDone}</li>
      </ul>

      {suggestion && (
        <div className="report-suggestion">
          <strong>💡 Suggestion</strong>
          <p>
            {suggestion.text}
            {suggestion.to && (
              <>
                {" "}
                <Link to={suggestion.to}>Go →</Link>
              </>
            )}
          </p>
        </div>
      )}
    </section>
  );
}
