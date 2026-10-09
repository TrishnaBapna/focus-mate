import { computeAnalytics } from "./analytics";
import { daysUntil } from "./exams";
import { formatTime, occursOn } from "./plans";
import { computeStats, dayKey, sessionDate } from "./stats";
import { sortTasks } from "./tasks";
import { formatDuration } from "./time";
import type { FocusSession, Plan, Subject, Task } from "../types";
import type { Exam } from "../types/exam";

export interface Suggestion {
  id: string;
  icon: string;
  text: string;
  to?: string;
  priority: number; // higher = more important
}

interface SuggestionInput {
  sessions: FocusSession[];
  tasks: Task[];
  exams: Exam[];
  plans: Plan[];
  subjects: Subject[];
  goalMinutes: number;
  now?: Date;
}

function startOfDay(d: Date) {
  const copy = new Date(d);
  copy.setHours(0, 0, 0, 0);
  return copy;
}

function addDays(d: Date, n: number) {
  const copy = new Date(d);
  copy.setDate(copy.getDate() + n);
  return copy;
}

function parseKey(key: string) {
  const [y, m, d] = key.split("-").map(Number);
  return new Date(y, m - 1, d);
}

function plural(n: number, word: string) {
  return `${n} ${word}${n === 1 ? "" : "s"}`;
}

// Looks at your sessions, tasks, exams and plans and decides what deserves attention.
export function buildSuggestions({
  sessions,
  tasks,
  exams,
  plans,
  subjects,
  goalMinutes,
  now = new Date(),
}: SuggestionInput): Suggestion[] {
  const todayKey = dayKey(now);
  const today = startOfDay(now);
  const weekStartKey = dayKey(addDays(today, -6));
  const stats = computeStats(sessions);

  const weekSecondsBySubject = new Map<string, number>();
  const lastStudied = new Map<string, string>();
  const studiedToday = new Set<string>();

  for (const s of sessions) {
    const key = dayKey(sessionDate(s));
    if (key >= weekStartKey) {
      weekSecondsBySubject.set(s.subjectId, (weekSecondsBySubject.get(s.subjectId) ?? 0) + s.durationSeconds);
    }
    const prev = lastStudied.get(s.subjectId);
    if (!prev || key > prev) lastStudied.set(s.subjectId, key);
    if (key === todayKey) studiedToday.add(s.subjectId);
  }

  const out: Suggestion[] = [];

  // 1. Exams that are coming up
  for (const exam of exams) {
    const days = daysUntil(exam.date);
    if (days < 0 || days > 21) continue;
    const when = days === 0 ? "today" : days === 1 ? "tomorrow" : `in ${days} days`;

    if (exam.syllabus.length === 0) {
      out.push({
        id: `exam-empty-${exam.id}`,
        icon: "🎓",
        text: `${exam.name} is ${when}. Add its topics so you can track what's ready.`,
        to: "/exams",
        priority: 40 + (21 - days),
      });
      continue;
    }

    const remaining = exam.syllabus.filter((i) => !i.done);
    if (remaining.length === 0) continue;

    const weekMinutes = Math.round((weekSecondsBySubject.get(exam.subjectId) ?? 0) / 60);
    const studied =
      exam.subjectId && exam.subjectName
        ? ` You've studied ${exam.subjectName} for ${weekMinutes} min this week.`
        : "";

    out.push({
      id: `exam-${exam.id}`,
      icon: "🎓",
      text: `${exam.name} is ${when} and ${remaining.length} of ${exam.syllabus.length} topics aren't ready yet. Start with "${remaining[0].title}".${studied}`,
      to: "/focus",
      priority: 100 - days + (days <= 3 ? 50 : 0),
    });
  }

  // 2. Tasks
  const open = tasks.filter((t) => t.status !== "done");
  const overdue = open.filter((t) => t.deadline && t.deadline < todayKey);
  if (overdue.length > 0) {
    out.push({
      id: "tasks-overdue",
      icon: "⏰",
      text: `You have ${plural(overdue.length, "overdue task")}, starting with “${sortTasks(overdue)[0].title}”.`,
      to: "/tasks",
      priority: 90,
    });
  }
  const dueToday = open.filter((t) => t.deadline === todayKey);
  if (dueToday.length > 0) {
    out.push({
      id: "tasks-today",
      icon: "✅",
      text: `${plural(dueToday.length, "task")} due today, starting with “${sortTasks(dueToday)[0].title}”.`,
      to: "/tasks",
      priority: 80,
    });
  }

  // 3. Study blocks planned for today that haven't happened yet
  for (const plan of plans) {
    if (occursOn(plan, todayKey) && !studiedToday.has(plan.subjectId)) {
      out.push({
        id: `plan-${plan.id}`,
        icon: "📅",
        text: `You planned ${plan.subjectName}${plan.topic ? ` (${plan.topic})` : ""} at ${formatTime(plan.startTime)} today.`,
        to: "/focus",
        priority: 70,
      });
    }
  }

  // 4. A streak that could slip away
  if (stats.currentStreak >= 2 && stats.todaySeconds === 0 && now.getHours() >= 17) {
    out.push({
      id: "streak",
      icon: "🔥",
      text: `Your ${stats.currentStreak}-day streak is on the line. A short session today keeps it alive.`,
      to: "/focus",
      priority: 85,
    });
  }

  // 5. Today's goal
  const goalSeconds = goalMinutes * 60;
  if (stats.todaySeconds >= goalSeconds) {
    out.push({ id: "goal-done", icon: "🎉", text: "You reached today's focus goal. Great work!", priority: 30 });
  } else if (stats.todaySeconds > 0) {
    out.push({
      id: "goal",
      icon: "🎯",
      text: `${Math.round((stats.todaySeconds / goalSeconds) * 100)}% of today's goal done. ${formatDuration(goalSeconds - stats.todaySeconds)} to go.`,
      to: "/focus",
      priority: 50,
    });
  }

  // 6. Subjects that have been left alone
  if (stats.weekSeconds > 0) {
    for (const subject of subjects) {
      const last = lastStudied.get(subject.id);
      if (!last) continue;
      const days = Math.round((today.getTime() - parseKey(last).getTime()) / 86400000);
      if (days >= 7) {
        out.push({
          id: `neglect-${subject.id}`,
          icon: subject.emoji,
          text: `You haven't studied ${subject.name} in ${days} days.`,
          to: "/focus",
          priority: 45,
        });
      }
    }
  }

  // 7. A gentle starting point when nothing else stands out
  if (stats.todaySeconds === 0 && out.every((s) => s.priority < 60)) {
    out.push({
      id: "start",
      icon: "⏱️",
      text:
        stats.currentStreak > 0
          ? `Keep your ${stats.currentStreak}-day streak going with a 25-minute session.`
          : "Start with a 25-minute Pomodoro to get today going.",
      to: "/focus",
      priority: 20,
    });
  }

  return out.sort((a, b) => b.priority - a.priority);
}

// The numbers behind the "Your week" card (last 7 days vs the 7 before)
export function buildWeeklyReport(sessions: FocusSession[], tasks: Task[], subjects: Subject[]) {
  const a = computeAnalytics(sessions, "week");
  const startKey = dayKey(addDays(startOfDay(new Date()), -6));

  let longestSeconds = 0;
  for (const s of sessions) {
    if (dayKey(sessionDate(s)) >= startKey) longestSeconds = Math.max(longestSeconds, s.durationSeconds);
  }

  const tasksDone = tasks.filter(
    (t) => t.status === "done" && t.completedAt && dayKey(t.completedAt.toDate()) >= startKey
  ).length;

  // Every subject, including ones with no time this week
  const secondsByName = new Map(a.bySubject.map((s) => [s.name, s.seconds]));
  const ranked = subjects
    .map((s) => ({ name: s.name, emoji: s.emoji, seconds: secondsByName.get(s.name) ?? 0 }))
    .sort((x, y) => y.seconds - x.seconds);

  const strongest = ranked.length > 0 && ranked[0].seconds > 0 ? ranked[0] : null;
  const last = ranked.length >= 2 ? ranked[ranked.length - 1] : null;
  const least = strongest && last && last.seconds < strongest.seconds ? last : null;

  return {
    totalSeconds: a.totalSeconds,
    changePercent: a.changePercent,
    sessionCount: a.sessionCount,
    daysStudied: a.daysStudied,
    bestWindow: a.bestWindow,
    longestSeconds,
    tasksDone,
    strongest,
    least,
  };
}
