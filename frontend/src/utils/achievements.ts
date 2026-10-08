import { computeStats } from "./stats";
import type { FocusSession, Note, Task } from "../types";

type Metric = "sessions" | "hours" | "streak" | "tasks" | "notes";

export interface Achievement {
  id: string;
  emoji: string;
  title: string;
  description: string;
  metric: Metric;
  target: number;
}

export interface AchievementState extends Achievement {
  current: number;
  unlocked: boolean;
  percent: number;
}

export const ACHIEVEMENTS: Achievement[] = [
  { id: "first-focus", emoji: "🏆", title: "First Focus", description: "Finish your first focus session", metric: "sessions", target: 1 },
  { id: "sessions-10", emoji: "🎯", title: "Getting Going", description: "Finish 10 focus sessions", metric: "sessions", target: 10 },
  { id: "sessions-50", emoji: "📚", title: "50 Sessions", description: "Finish 50 focus sessions", metric: "sessions", target: 50 },
  { id: "hours-10", emoji: "⏱️", title: "10 Hours Focused", description: "Focus for 10 hours in total", metric: "hours", target: 10 },
  { id: "hours-100", emoji: "💯", title: "100 Hours", description: "Focus for 100 hours in total", metric: "hours", target: 100 },
  { id: "streak-3", emoji: "🔥", title: "3 Day Streak", description: "Study 3 days in a row", metric: "streak", target: 3 },
  { id: "streak-7", emoji: "🔥", title: "7 Day Streak", description: "Study 7 days in a row", metric: "streak", target: 7 },
  { id: "streak-30", emoji: "🌟", title: "30 Day Streak", description: "Study 30 days in a row", metric: "streak", target: 30 },
  { id: "task-1", emoji: "✅", title: "First Task", description: "Complete your first task", metric: "tasks", target: 1 },
  { id: "tasks-25", emoji: "🧹", title: "Task Crusher", description: "Complete 25 tasks", metric: "tasks", target: 25 },
  { id: "note-1", emoji: "📝", title: "First Note", description: "Write your first note", metric: "notes", target: 1 },
  { id: "notes-10", emoji: "🗂️", title: "Note Taker", description: "Write 10 notes", metric: "notes", target: 10 },
];

// Level 1 -> 2 needs 100 XP, level 2 -> 3 needs 150, then 200, 250, ...
export function xpToNext(level: number) {
  return 100 + (level - 1) * 50;
}

export function levelInfo(xp: number) {
  let level = 1;
  let remaining = xp;
  let needed = xpToNext(level);
  while (remaining >= needed) {
    remaining -= needed;
    level++;
    needed = xpToNext(level);
  }
  return { level, current: remaining, needed, percent: Math.round((remaining / needed) * 100) };
}

export function computeProgress(sessions: FocusSession[], tasks: Task[], notes: Note[]) {
  const stats = computeStats(sessions);
  const totalSeconds = sessions.reduce((sum, s) => sum + s.durationSeconds, 0);
  const tasksDone = tasks.filter((t) => t.status === "done").length;

  const metrics: Record<Metric, number> = {
    sessions: sessions.length,
    hours: totalSeconds / 3600,
    streak: stats.longestStreak,
    tasks: tasksDone,
    notes: notes.length,
  };

  const achievements: AchievementState[] = ACHIEVEMENTS.map((a) => {
    const current = metrics[a.metric];
    return {
      ...a,
      current,
      unlocked: current >= a.target,
      percent: Math.min(100, Math.round((current / a.target) * 100)),
    };
  });
  const unlockedCount = achievements.filter((a) => a.unlocked).length;

  const xp =
    Math.floor(totalSeconds / 60) +
    20 * tasksDone +
    10 * notes.length +
    10 * stats.longestStreak +
    50 * unlockedCount;

  return {
    totalSeconds,
    sessionCount: sessions.length,
    longestStreak: stats.longestStreak,
    tasksDone,
    notesCount: notes.length,
    xp,
    level: levelInfo(xp),
    achievements,
    unlockedCount,
  };
}

export type Progress = ReturnType<typeof computeProgress>;

export function formatProgress(a: AchievementState) {
  if (a.metric === "hours") return `${a.current.toFixed(1)} / ${a.target} h`;
  return `${Math.min(a.current, a.target)} / ${a.target}`;
}
