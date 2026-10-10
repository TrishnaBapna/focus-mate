import { createContext } from "react";
import type { SessionMode, Subject } from "../types";

export type Phase = "setup" | "focus" | "focusDone" | "break";
export type SaveStatus = "saved" | "short" | "error";

export interface FocusResult {
  seconds: number;
  status: SaveStatus;
  sessionId?: string;
  strict?: boolean;
  leaves?: number;
  awaySeconds?: number;
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
  strict: boolean;
  setStrict: (v: boolean) => void;

  subject: Subject | undefined;
  result: FocusResult | null;

  running: boolean;
  clockText: string;
  progress: number;
  hasTarget: boolean;
  elapsedSeconds: number;

  // Strict mode
  strictActive: boolean; // a strict focus session is running right now
  awayCount: number;
  awaySeconds: number;
  awayNotice: number | null; // seconds away, until the person taps "I'm back"
  dismissAwayNotice: () => void;
  needsFullscreen: boolean; // full screen was left during a strict session
  returnToFullscreen: () => void;

  startFocus: () => void;
  startBreak: () => void;
  backToSetup: () => void;
  cancelSession: () => void;
  pause: () => void;
  resume: () => void;
  finishEarly: () => void;
}

export const FocusContext = createContext<FocusContextValue | null>(null);
