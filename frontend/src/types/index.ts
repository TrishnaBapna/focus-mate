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
