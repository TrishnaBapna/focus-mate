import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useAchievements } from "../hooks/useAchievements";
import { useCards } from "../hooks/useCards";
import { useExams } from "../hooks/useExams";
import { usePlans } from "../hooks/usePlans";
import { useSettings } from "../hooks/useSettings";
import { useSubjects } from "../hooks/useSubjects";
import { buildSuggestions, type Suggestion } from "../utils/insights";
import { isDue } from "../utils/study";
import Icon from "./Icon";

// The bell: your smart suggestions and flashcards that are due
export default function NotificationsBell() {
  const [open, setOpen] = useState(false);
  const { sessions, tasks, ready } = useAchievements();
  const { exams } = useExams();
  const { plans } = usePlans();
  const { subjects } = useSubjects();
  const { settings } = useSettings();
  const { cards } = useCards();

  const items = useMemo(() => {
    const list = buildSuggestions({
      sessions,
      tasks,
      exams,
      plans,
      subjects,
      goalMinutes: settings.dailyGoalMinutes,
    });
    const due = cards.filter((c) => isDue(c)).length;
    const extra: Suggestion[] =
      due > 0
        ? [
            {
              id: "cards-due",
              icon: "🃏",
              text: `${due} flashcard${due === 1 ? "" : "s"} due for review.`,
              to: "/study",
              priority: 55,
            },
          ]
        : [];
    return [...list, ...extra].sort((a, b) => b.priority - a.priority).slice(0, 6);
  }, [sessions, tasks, exams, plans, subjects, settings.dailyGoalMinutes, cards]);

  const hasItems = ready && items.some((i) => i.priority >= 40);

  return (
    <div className="bell-wrap">
      {open && <div className="pop-backdrop" onClick={() => setOpen(false)} />}
      <button
        className="icon-btn"
        aria-label="Suggestions"
        title="Suggestions"
        onClick={() => setOpen(!open)}
      >
        <Icon name="bell" size={18} />
        {hasItems && <span className="bell-dot" />}
      </button>

      {open && (
        <div className="bell-pop">
          <strong>Suggestions</strong>
          {items.length === 0 ? (
            <p className="muted">You're all caught up ✨</p>
          ) : (
            <ul>
              {items.map((i) => (
                <li key={i.id}>
                  {i.to ? (
                    <Link to={i.to} className="bell-item" onClick={() => setOpen(false)}>
                      <span>{i.icon}</span>
                      <span>{i.text}</span>
                    </Link>
                  ) : (
                    <div className="bell-item">
                      <span>{i.icon}</span>
                      <span>{i.text}</span>
                    </div>
                  )}
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
