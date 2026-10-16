import { dayKey } from "./stats.ts";
import type { FocusSession, Subject, SubjectGoal } from "../types";

export interface WeekRange {
  start: Date;
  end: Date;
  startKey: string;
  endKey: string;
  label: string;
  daysRemaining: number;
}

export interface SubjectGoalProgress {
  subject: Subject;
  goal: SubjectGoal;
  targetHours: number;
  targetSeconds: number;
  actualSeconds: number;
  remainingSeconds: number;
  progressPercent: number;
  isAchieved: boolean;
}

export interface WeeklyGoalsSummary {
  weekRange: WeekRange;
  totalTargetHours: number;
  totalTargetSeconds: number;
  totalActualSeconds: number;
  totalRemainingSeconds: number;
  totalProgressPercent: number;
  goalsCount: number;
  achievedCount: number;
  allAchieved: boolean;
}

/**
 * Returns the current local calendar week range starting Monday at 00:00:00
 * and ending Sunday at 23:59:59.999 (local time).
 */
export function getLocalWeekRange(referenceDate = new Date()): WeekRange {
  const start = new Date(referenceDate);
  start.setHours(0, 0, 0, 0);

  // JavaScript getDay(): Sunday = 0, Monday = 1, ..., Saturday = 6
  // Days since Monday: Mon -> 0, Tue -> 1, ..., Sun -> 6
  const daysSinceMonday = (start.getDay() + 6) % 7;
  start.setDate(start.getDate() - daysSinceMonday);

  // Week end: Sunday 23:59:59.999
  const end = new Date(start);
  end.setDate(end.getDate() + 6);
  end.setHours(23, 59, 59, 999);

  // Days remaining in this week, including today
  const todayStart = new Date(referenceDate);
  todayStart.setHours(0, 0, 0, 0);
  const diffDays = Math.max(
    0,
    Math.round((end.getTime() - todayStart.getTime()) / (24 * 60 * 60 * 1000))
  );

  const startMonth = start.toLocaleDateString(undefined, { month: "short", day: "numeric" });
  const endMonth = end.toLocaleDateString(undefined, { month: "short", day: "numeric" });
  const label = `${startMonth} – ${endMonth}`;

  return {
    start,
    end,
    startKey: dayKey(start),
    endKey: dayKey(end),
    label,
    daysRemaining: diffDays,
  };
}

/**
 * Computes how many seconds of a focus session fall strictly within the given week range.
 * Safely handles:
 * - Sessions crossing the Sunday/Monday week boundary (proportional attribution)
 * - Missing or invalid timestamps (fallback to current time safely)
 * - Out-of-range duration values
 * - Excludes break sessions
 */
export function computeSessionWeekOverlap(
  session: FocusSession,
  weekStart: Date,
  weekEnd: Date
): number {
  // Exclude breaks if any have been mistakenly flagged
  if ((session.mode as string) === "break") {
    return 0;
  }

  const rawSeconds = session.durationSeconds;
  if (typeof rawSeconds !== "number" || isNaN(rawSeconds) || rawSeconds <= 0) {
    return 0;
  }

  // Cap single session at 24 hours to prevent corrupted documents from skewing stats
  const durationSeconds = Math.min(rawSeconds, 24 * 3600);

  let sessionEnd: Date;
  if (session.completedAt && typeof session.completedAt.toDate === "function") {
    sessionEnd = session.completedAt.toDate();
  } else {
    // If completedAt is missing (e.g. freshly created locally before server timestamp arrives)
    sessionEnd = new Date();
  }

  const sessionStart = new Date(sessionEnd.getTime() - durationSeconds * 1000);

  // Overlap interval between [sessionStart, sessionEnd] and [weekStart, weekEnd]
  const overlapStartMs = Math.max(sessionStart.getTime(), weekStart.getTime());
  const overlapEndMs = Math.min(sessionEnd.getTime(), weekEnd.getTime());

  if (overlapEndMs <= overlapStartMs) {
    return 0;
  }

  return Math.round((overlapEndMs - overlapStartMs) / 1000);
}

/**
 * Formats seconds into human-readable hours and minutes (e.g. "3h 45m", "45m", "0h").
 */
export function formatStudyTime(seconds: number): string {
  if (!seconds || seconds <= 0) return "0h";
  const totalMinutes = Math.round(seconds / 60);
  const h = Math.floor(totalMinutes / 60);
  const m = totalMinutes % 60;

  if (h === 0) return `${m}m`;
  if (m === 0) return `${h}h`;
  return `${h}h ${m}m`;
}

/**
 * Formats hours decimal cleanly (e.g. 5 -> "5h", 2.5 -> "2.5h").
 */
export function formatTargetHours(hours: number): string {
  if (Number.isInteger(hours)) return `${hours}h`;
  return `${hours.toFixed(1)}h`;
}

/**
 * Computes all subject goals progress and overall weekly summary.
 * Deduplicates sessions by session.id to avoid double-counting.
 * Gracefully handles subjects with 0 sessions and filters out goals for deleted subjects.
 */
export function computeSubjectGoals(
  subjects: Subject[],
  goals: SubjectGoal[],
  sessions: FocusSession[],
  referenceDate = new Date()
): {
  progressList: SubjectGoalProgress[];
  summary: WeeklyGoalsSummary;
  unconfiguredSubjects: Subject[];
} {
  const weekRange = getLocalWeekRange(referenceDate);

  // Deduplicate sessions and map valid overlap seconds per subjectId
  const seenSessionIds = new Set<string>();
  const subjectActualSeconds = new Map<string, number>();

  for (const s of sessions) {
    if (!s || !s.id || seenSessionIds.has(s.id)) continue;
    seenSessionIds.add(s.id);

    const overlap = computeSessionWeekOverlap(s, weekRange.start, weekRange.end);
    if (overlap > 0 && s.subjectId) {
      subjectActualSeconds.set(
        s.subjectId,
        (subjectActualSeconds.get(s.subjectId) ?? 0) + overlap
      );
    }
  }

  // Index subjects by ID
  const subjectsMap = new Map<string, Subject>();
  for (const sub of subjects) {
    subjectsMap.set(sub.id, sub);
  }

  // Compute progress for each goal whose subject currently exists
  const progressList: SubjectGoalProgress[] = [];
  const subjectsWithGoals = new Set<string>();

  for (const g of goals) {
    const subject = subjectsMap.get(g.subjectId);
    if (!subject) {
      // Handles deleted subjects: ignore goals for subjects that no longer exist
      continue;
    }

    subjectsWithGoals.add(subject.id);
    const targetHours = Math.max(0.1, Number(g.targetHours) || 0);
    const targetSeconds = Math.round(targetHours * 3600);
    const actualSeconds = subjectActualSeconds.get(subject.id) ?? 0;
    const remainingSeconds = Math.max(0, targetSeconds - actualSeconds);
    const progressPercent = Math.round((actualSeconds / targetSeconds) * 100);
    const isAchieved = actualSeconds >= targetSeconds;

    progressList.push({
      subject,
      goal: g,
      targetHours,
      targetSeconds,
      actualSeconds,
      remainingSeconds,
      progressPercent,
      isAchieved,
    });
  }

  // Sort: active/in-progress first, then achieved; within that, by highest target hours
  progressList.sort((a, b) => {
    if (a.isAchieved !== b.isAchieved) return a.isAchieved ? 1 : -1;
    return b.targetHours - a.targetHours;
  });

  // Subjects that do not have a weekly goal configured yet
  const unconfiguredSubjects = subjects.filter((s) => !subjectsWithGoals.has(s.id));

  // Compute weekly overall summary
  const totalTargetHours = progressList.reduce((sum, p) => sum + p.targetHours, 0);
  const totalTargetSeconds = Math.round(totalTargetHours * 3600);
  const totalActualSeconds = progressList.reduce((sum, p) => sum + p.actualSeconds, 0);
  const totalRemainingSeconds = Math.max(0, totalTargetSeconds - totalActualSeconds);
  const totalProgressPercent =
    totalTargetSeconds > 0
      ? Math.round((totalActualSeconds / totalTargetSeconds) * 100)
      : 0;

  const achievedCount = progressList.filter((p) => p.isAchieved).length;
  const goalsCount = progressList.length;
  const allAchieved = goalsCount > 0 && achievedCount === goalsCount;

  return {
    progressList,
    summary: {
      weekRange,
      totalTargetHours,
      totalTargetSeconds,
      totalActualSeconds,
      totalRemainingSeconds,
      totalProgressPercent,
      goalsCount,
      achievedCount,
      allAchieved,
    },
    unconfiguredSubjects,
  };
}
