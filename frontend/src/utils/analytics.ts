import { dayKey, sessionDate } from "./stats";
import type { FocusSession } from "../types";

export type Range = "week" | "month" | "year";

export interface Bucket {
  key: string;
  label: string;
  seconds: number;
  isCurrent: boolean;
}

export interface SubjectTotal {
  name: string;
  emoji: string;
  seconds: number;
}

export interface HeatCell {
  key: string;
  seconds: number;
  level: 0 | 1 | 2 | 3 | 4;
  future: boolean;
}

const WEEKDAY_NAMES = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];
const WEEKDAY_SHORT = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
const DAY_LETTERS = ["S", "M", "T", "W", "T", "F", "S"];

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

// Monday = 0 ... Sunday = 6
function mondayIndex(d: Date) {
  return (d.getDay() + 6) % 7;
}

export function hourLabel(h: number) {
  const hour = h % 24;
  return `${hour % 12 || 12} ${hour < 12 ? "AM" : "PM"}`;
}

function levelFor(seconds: number): 0 | 1 | 2 | 3 | 4 {
  if (seconds <= 0) return 0;
  if (seconds < 20 * 60) return 1;
  if (seconds < 60 * 60) return 2;
  if (seconds < 120 * 60) return 3;
  return 4;
}

// The period we look at, and the equally long period right before it
function windowFor(range: Range, today: Date) {
  if (range === "week") {
    const start = addDays(today, -6);
    return { start, prevStart: addDays(start, -7) };
  }
  if (range === "month") {
    const start = addDays(today, -29);
    return { start, prevStart: addDays(start, -30) };
  }
  return {
    start: new Date(today.getFullYear(), today.getMonth() - 11, 1),
    prevStart: new Date(today.getFullYear(), today.getMonth() - 23, 1),
  };
}

// Spread a session's time over the hours it covered (it ended at `end`)
function addToHours(hours: number[], end: Date, seconds: number) {
  const minutes = Math.max(1, Math.round(seconds / 60));
  for (let m = 0; m < minutes; m++) {
    const t = new Date(end.getTime() - (m + 0.5) * 60000);
    hours[t.getHours()] += 60;
  }
}

export function computeAnalytics(sessions: FocusSession[], range: Range) {
  const today = startOfDay(new Date());
  const todayKey = dayKey(today);
  const { start, prevStart } = windowFor(range, today);
  const startKey = dayKey(start);
  const prevKey = dayKey(prevStart);

  const allByDay = new Map<string, number>(); // every session ever loaded (for the heatmap)
  const byDay = new Map<string, number>(); // inside the chosen period
  const byMonth = new Map<string, number>();
  const subjects = new Map<string, SubjectTotal>();
  const weekdays: number[] = [0, 0, 0, 0, 0, 0, 0];
  const hours: number[] = new Array<number>(24).fill(0);
  let total = 0;
  let count = 0;
  let prevTotal = 0;

  for (const s of sessions) {
    const when = sessionDate(s);
    const key = dayKey(when);
    allByDay.set(key, (allByDay.get(key) ?? 0) + s.durationSeconds);

    if (key >= startKey && key <= todayKey) {
      total += s.durationSeconds;
      count++;
      byDay.set(key, (byDay.get(key) ?? 0) + s.durationSeconds);
      const monthKey = key.slice(0, 7);
      byMonth.set(monthKey, (byMonth.get(monthKey) ?? 0) + s.durationSeconds);

      const subject = subjects.get(s.subjectId) ?? {
        name: s.subjectName,
        emoji: s.subjectEmoji,
        seconds: 0,
      };
      subject.seconds += s.durationSeconds;
      subjects.set(s.subjectId, subject);

      weekdays[mondayIndex(when)] += s.durationSeconds;
      addToHours(hours, when, s.durationSeconds);
    } else if (key >= prevKey && key < startKey) {
      prevTotal += s.durationSeconds;
    }
  }

  // Bars for the chart
  const buckets: Bucket[] = [];
  if (range === "year") {
    for (let i = 0; i < 12; i++) {
      const d = new Date(today.getFullYear(), today.getMonth() - 11 + i, 1);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
      buckets.push({
        key,
        label: d.toLocaleDateString(undefined, { month: "short" }).slice(0, 3),
        seconds: byMonth.get(key) ?? 0,
        isCurrent: i === 11,
      });
    }
  } else {
    const days = range === "week" ? 7 : 30;
    for (let i = 0; i < days; i++) {
      const d = addDays(start, i);
      const key = dayKey(d);
      const label =
        range === "week"
          ? DAY_LETTERS[d.getDay()]
          : i % 5 === 0 || i === days - 1
            ? String(d.getDate())
            : "";
      buckets.push({ key, label, seconds: byDay.get(key) ?? 0, isCurrent: key === todayKey });
    }
  }

  // Best single day
  let bestDay: { label: string; seconds: number } | null = null;
  for (const [key, seconds] of byDay) {
    if (!bestDay || seconds > bestDay.seconds) {
      const [y, m, d] = key.split("-").map(Number);
      bestDay = {
        label: new Date(y, m - 1, d).toLocaleDateString(undefined, {
          weekday: "short",
          day: "numeric",
          month: "short",
        }),
        seconds,
      };
    }
  }

  // Best weekday
  let bestWeekday: string | null = null;
  if (total > 0) {
    let best = 0;
    weekdays.forEach((s, i) => {
      if (s > weekdays[best]) best = i;
    });
    bestWeekday = WEEKDAY_NAMES[best];
  }

  // Best two-hour window
  let bestWindow: string | null = null;
  if (total > 0) {
    let bestHour = 0;
    let bestValue = -1;
    for (let h = 0; h < 24; h++) {
      const value = hours[h] + hours[(h + 1) % 24];
      if (value > bestValue) {
        bestValue = value;
        bestHour = h;
      }
    }
    bestWindow = `${hourLabel(bestHour)} – ${hourLabel(bestHour + 2)}`;
  }

  // Heatmap: the last 12 weeks, week by week (Monday first), ending this week
  const mondayThisWeek = addDays(today, -mondayIndex(today));
  const heatStart = addDays(mondayThisWeek, -11 * 7);
  const heatmap: HeatCell[] = [];
  for (let i = 0; i < 84; i++) {
    const key = dayKey(addDays(heatStart, i));
    const seconds = allByDay.get(key) ?? 0;
    heatmap.push({ key, seconds, level: levelFor(seconds), future: key > todayKey });
  }

  const totalDays = Math.round((today.getTime() - start.getTime()) / 86400000) + 1;

  return {
    totalSeconds: total,
    sessionCount: count,
    avgSessionSeconds: count > 0 ? Math.round(total / count) : 0,
    dailyAvgSeconds: Math.round(total / totalDays),
    daysStudied: byDay.size,
    totalDays,
    changePercent: prevTotal > 0 ? Math.round(((total - prevTotal) / prevTotal) * 100) : null,
    buckets,
    bestDay,
    bySubject: [...subjects.values()].sort((a, b) => b.seconds - a.seconds),
    weekdays: WEEKDAY_SHORT.map((label, i) => ({ label, seconds: weekdays[i] })),
    bestWeekday,
    hours,
    bestWindow,
    heatmap,
  };
}
