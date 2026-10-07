import { createContext } from "react";
import type { SessionMode, Subject } from "../types";

export type Phase = "setup" | "focus" | "focusDone" | "break";
export type SaveStatus = "saved" | "short" | "error";

export interface FocusResult {
  seconds: number;
  status: SaveStatus;
  sessionId?: string;
}

export interface FocusContextValue {
  phase: Phase;

  mode: SessionMode;
  setMode: (m: SessionMode) => void;
  subjectId: string;
  setSubjectId: (id: string) => void;
  topic: string;
  setTopic: (t: string) => void;
  goal: string;
  setGoal: (g: string) => void;
  focusMinutes: number;
  setFocusMinutes: (n: number) => void;
  breakMinutes: number;
  setBreakMinutes: (n: number) => void;

  subject: Subject | undefined;
  result: FocusResult | null;

  running: boolean;
  clockText: string;
  progress: number;
  hasTarget: boolean;

  startFocus: () => void;
  startBreak: () => void;
  backToSetup: () => void;
  cancelSession: () => void;
  pause: () => void;
  resume: () => void;
  finishEarly: () => void;
}

export const FocusContext = createContext<FocusContextValue | null>(null);
