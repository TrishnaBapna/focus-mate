import { useMemo } from "react";
import { Link } from "react-router-dom";
import { useAchievements } from "../hooks/useAchievements";
import { useExams } from "../hooks/useExams";
import { usePlans } from "../hooks/usePlans";
import { useSettings } from "../hooks/useSettings";
import { useSubjects } from "../hooks/useSubjects";
import { buildSuggestions } from "../utils/insights";

export default function SuggestionsCard() {
  const { sessions, tasks, ready } = useAchievements();
  const { exams, loading: examsLoading } = useExams();
  const { plans } = usePlans();
  const { subjects } = useSubjects();
  const { settings } = useSettings();

  const suggestions = useMemo(
    () =>
      buildSuggestions({
        sessions,
        tasks,
        exams,
        plans,
        subjects,
        goalMinutes: settings.dailyGoalMinutes,
      }).slice(0, 3),
    [sessions, tasks, exams, plans, subjects, settings.dailyGoalMinutes]
  );

  return (
    <section className="card">
      <h3>💡 Suggestions</h3>
      {!ready || examsLoading ? (
        <p className="muted">Looking at your week…</p>
      ) : suggestions.length === 0 ? (
        <p className="empty-note">You're all caught up ✨</p>
      ) : (
        <ul className="suggestion-list">
          {suggestions.map((s) => {
            const content = (
              <>
                <span className="suggestion-icon">{s.icon}</span>
                <span>{s.text}</span>
              </>
            );
            return (
              <li key={s.id}>
                {s.to ? (
                  <Link to={s.to} className="suggestion">
                    {content}
                  </Link>
                ) : (
                  <div className="suggestion">{content}</div>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
