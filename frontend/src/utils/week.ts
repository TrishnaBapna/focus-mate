import type { FocusSession } from "../types";
import { dayKey, sessionDate } from "./stats";

// Monday of the current week as "YYYY-MM-DD" (local time)
export function weekStartKey(d: Date): string {
  const c = new Date(d);
  c.setHours(0, 0, 0, 0);
  c.setDate(c.getDate() - ((c.getDay() + 6) % 7));
  return dayKey(c);
}

export function weekSecondsOf(sessions: FocusSession[]): number {
  const current = weekStartKey(new Date());
  return sessions
    .filter((s) => weekStartKey(sessionDate(s)) === current)
    .reduce((sum, s) => sum + s.durationSeconds, 0);
}
