import type { Timestamp } from "firebase/firestore";

export interface Subject {
  id: string;
  name: string;
  emoji: string;
  color: string;
  weeklyTargetHours?: number | null;
}

export interface SubjectGoal {
  id: string;
  subjectId: string;
  targetHours: number;
  createdAt?: Timestamp | null;
  updatedAt?: Timestamp | null;
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
  strict?: boolean; // true for strict-mode sessions
  leaves?: number; // how many times the tab was left (strict mode only)
  awaySeconds?: number; // total time away from the tab (strict mode only)
  completedAt?: Timestamp | null;
}

export interface NoteFolder {
  id: string;
  name: string;
  color?: string;
  createdAt?: Timestamp | null;
  updatedAt?: Timestamp | null;
}

export interface Note {
  id: string;
  title: string;
  content: string; // typed text, a voice transcript, or text read from a scan
  subjectId: string;
  subjectName: string;
  subjectEmoji: string;
  topic: string;
  sessionId: string | null;
  folderId?: string | null;
  folderName?: string;
  type?: "typed" | "handwritten" | "voice" | "scan"; // older notes have no type = typed
  strokesJson?: string | null; // pen strokes, for handwritten notes
  strokesMediaId?: string | null; // pen strokes payload stored in Storage for large drawings
  audioId?: string | null; // recording in the media area, for voice notes
  audioMime?: string | null;
  audioSeconds?: number | null;
  imageId?: string | null; // photo in the media area, for scanned notes
  pages?: { imageId: string; thumb?: string }[];
  imageMime?: string;
  thumb?: string; // tiny preview image (data URL), for scanned notes
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

export * from "./assessment";
export * from "./paper";
export * from "./revision";

