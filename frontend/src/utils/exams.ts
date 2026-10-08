import type { Exam } from "../types/exam";

export type Urgency = "past" | "urgent" | "soon" | "calm";

export function newId() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
}

// Whole days from today until the date ("YYYY-MM-DD"). Negative = in the past.
export function daysUntil(key: string): number {
  const [y, m, d] = key.split("-").map(Number);
  const target = new Date(y, m - 1, d);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return Math.round((target.getTime() - today.getTime()) / 86400000);
}

export function urgency(days: number): Urgency {
  if (days < 0) return "past";
  if (days <= 3) return "urgent";
  if (days <= 14) return "soon";
  return "calm";
}

export function countdownText(days: number): string {
  if (days < 0) return `${-days} DAY${days === -1 ? "" : "S"} AGO`;
  if (days === 0) return "TODAY";
  if (days === 1) return "TOMORROW";
  return `${days} DAYS LEFT`;
}

export function syllabusProgress(exam: Exam) {
  const total = exam.syllabus.length;
  const done = exam.syllabus.filter((i) => i.done).length;
  return { done, total, percent: total ? Math.round((done / total) * 100) : 0 };
}

export function formatExamDate(key: string): string {
  const [y, m, d] = key.split("-").map(Number);
  return new Date(y, m - 1, d).toLocaleDateString(undefined, {
    weekday: "short",
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}
