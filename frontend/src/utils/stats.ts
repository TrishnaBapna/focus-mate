import type { FocusSession } from "../types";

export interface DayStat {
  key: string;
  label: string;
  seconds: number;
  isToday: boolean;
}

export interface SubjectStat {
  name: string;
  emoji: string;
  seconds: number;
}

const DAY_LABELS = ["S", "M", "T", "W", "T", "F", "S"];

// A session that was just saved may not have its server time yet; treat it as "now".
export function sessionDate(s: FocusSession): Date {
  return s.completedAt ? s.completedAt.toDate() : new Date();
}

// Local calendar day as "YYYY-MM-DD"
export function dayKey(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function startOfDay(d: Date): Date {
  const copy = new Date(d);
  copy.setHours(0, 0, 0, 0);
  return copy;
}

export function computeStats(sessions: FocusSession[]) {
  // Total seconds studied on each calendar day
  const byDay = new Map<string, number>();
  for (const s of sessions) {
    const key = dayKey(sessionDate(s));
    byDay.set(key, (byDay.get(key) ?? 0) + s.durationSeconds);
  }

  const today = startOfDay(new Date());
  const todayKey = dayKey(today);

  // Current streak: count back from today (or yesterday if nothing yet today)
  let currentStreak = 0;
  const cursor = new Date(today);
  if (!byDay.has(dayKey(cursor))) cursor.setDate(cursor.getDate() - 1);
  while (byDay.has(dayKey(cursor))) {
    currentStreak++;
    cursor.setDate(cursor.getDate() - 1);
  }

  // Longest streak among the loaded days
  let longestStreak = 0;
  let run = 0;
  let prev: Date | null = null;
  for (const key of [...byDay.keys()].sort()) {
    const [y, m, d] = key.split("-").map(Number);
    const date = new Date(y, m - 1, d);
    if (prev && Math.round((date.getTime() - prev.getTime()) / 86400000) === 1) run++;
    else run = 1;
    longestStreak = Math.max(longestStreak, run);
    prev = date;
  }

  // Last 7 days, oldest first
  const week: DayStat[] = [];
  for (let i = 6; i >= 0; i--) {
    const d = new Date(today);
    d.setDate(d.getDate() - i);
    const key = dayKey(d);
    week.push({
      key,
      label: DAY_LABELS[d.getDay()],
      seconds: byDay.get(key) ?? 0,
      isToday: key === todayKey,
    });
  }

  // Subject breakdown for those 7 days
  const weekKeys = new Set(week.map((d) => d.key));
  const subjectMap = new Map<string, SubjectStat>();
  for (const s of sessions) {
    if (!weekKeys.has(dayKey(sessionDate(s)))) continue;
    const cur = subjectMap.get(s.subjectId) ?? {
      name: s.subjectName,
      emoji: s.subjectEmoji,
      seconds: 0,
    };
    cur.seconds += s.durationSeconds;
    subjectMap.set(s.subjectId, cur);
  }
  const bySubject = [...subjectMap.values()].sort((a, b) => b.seconds - a.seconds);

  return {
    todaySeconds: byDay.get(todayKey) ?? 0,
    currentStreak,
    longestStreak,
    week,
    weekSeconds: week.reduce((sum, d) => sum + d.seconds, 0),
    bySubject,
  };
}
