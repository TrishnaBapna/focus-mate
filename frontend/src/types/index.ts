import type { Timestamp } from "firebase/firestore";

export interface Subject {
  id: string;
  name: string;
  emoji: string;
  color: string;
}

export type SessionMode = "timer" | "stopwatch" | "pomodoro";

export interface FocusSession {
  id: string;
  subjectId: string;
  subjectName: string;
  subjectEmoji: string;
  topic: string;
  goal: string;
  mode: SessionMode;
  durationSeconds: number;
  completedAt?: Timestamp | null;
}

export interface Note {
  id: string;
  title: string;
  content: string;
  subjectId: string;
  subjectName: string;
  subjectEmoji: string;
  topic: string;
  sessionId: string | null;
  createdAt?: Timestamp | null;
  updatedAt?: Timestamp | null;
}

export type TaskPriority = "high" | "medium" | "low";
export type TaskStatus = "todo" | "in_progress" | "done";

export interface Task {
  id: string;
  title: string;
  subjectId: string;
  subjectName: string;
  subjectEmoji: string;
  priority: TaskPriority;
  status: TaskStatus;
  deadline: string; // "YYYY-MM-DD", or "" for no deadline
  estimatedMinutes: number | null;
  createdAt?: Timestamp | null;
  completedAt?: Timestamp | null;
}

export type PlanRepeat = "none" | "daily" | "weekdays" | "weekly";

export interface Plan {
  id: string;
  subjectId: string;
  subjectName: string;
  subjectEmoji: string;
  topic: string;
  date: string; // first day, "YYYY-MM-DD"
  startTime: string; // "HH:MM" (24-hour)
  durationMinutes: number;
  repeat: PlanRepeat;
  createdAt?: Timestamp | null;
}
