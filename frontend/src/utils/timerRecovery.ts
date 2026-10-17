import type { FocusSession, SessionMode } from "../types";

export const TIMER_RECOVERY_KEY_PREFIX = "focusmate_active_session_";
export const RECOVERY_VERSION = 1;
export const MAX_SESSION_AGE_MS = 24 * 60 * 60 * 1000; // 24 hours

export interface StoredFocusSession {
  version: 1;
  uid: string;
  phase: "focus" | "break" | "focusDone";
  mode: SessionMode;
  subjectId: string;
  subjectName?: string;
  subjectEmoji?: string;
  topic: string;
  goal: string;
  focusMinutes: number;
  breakMinutes: number;
  strict: boolean;
  running: boolean;
  startedAt: number | null; // Epoch ms when the running interval started (null if paused)
  accumulatedMs: number;    // Accumulated ms before current running interval
  savedAt: number;          // Epoch ms when snapshot was saved
  awayCount: number;
  awaySeconds: number;
  clientSessionId?: string; // Idempotency key to prevent duplicate creation on retry
  completedPayload?: Omit<FocusSession, "id">; // Retained payload for reliable retry
}

export interface RecoveredSessionState {
  session: StoredFocusSession;
  calculatedElapsedMs: number;
  targetMs: number | null;
  isExpired: boolean;
}

export function getStorageKey(uid: string): string {
  return `${TIMER_RECOVERY_KEY_PREFIX}${uid}`;
}

export function saveActiveSession(session: StoredFocusSession): void {
  if (!session.uid || typeof window === "undefined" || !window.localStorage) return;
  try {
    const key = getStorageKey(session.uid);
    window.localStorage.setItem(key, JSON.stringify(session));
  } catch (err) {
    console.warn("Failed to save active session recovery state:", err);
  }
}

export function loadActiveSession(uid: string, now = Date.now()): StoredFocusSession | null {
  if (!uid || typeof window === "undefined" || !window.localStorage) return null;
  try {
    const key = getStorageKey(uid);
    const raw = window.localStorage.getItem(key);
    if (!raw) return null;

    const data: unknown = JSON.parse(raw);
    if (!isValidStoredSession(data, uid, now)) {
      window.localStorage.removeItem(key);
      return null;
    }

    return data;
  } catch (err) {
    console.warn("Failed to load active session recovery state:", err);
    try {
      window.localStorage.removeItem(getStorageKey(uid));
    } catch {
      // ignore
    }
    return null;
  }
}

export function clearActiveSession(uid: string): void {
  if (!uid || typeof window === "undefined" || !window.localStorage) return;
  try {
    window.localStorage.removeItem(getStorageKey(uid));
  } catch (err) {
    console.warn("Failed to clear active session recovery state:", err);
  }
}

export function isValidStoredSession(
  data: unknown,
  expectedUid: string,
  now = Date.now()
): data is StoredFocusSession {
  if (!data || typeof data !== "object") return false;
  const d = data as Partial<StoredFocusSession>;

  if (d.version !== RECOVERY_VERSION) return false;
  if (d.uid !== expectedUid) return false;
  if (d.phase !== "focus" && d.phase !== "break") return false;
  if (d.mode !== "pomodoro" && d.mode !== "timer" && d.mode !== "stopwatch") return false;
  if (typeof d.subjectId !== "string") return false;
  if (typeof d.topic !== "string") return false;
  if (typeof d.goal !== "string") return false;

  if (typeof d.focusMinutes !== "number" || !Number.isFinite(d.focusMinutes) || d.focusMinutes <= 0) return false;
  if (typeof d.breakMinutes !== "number" || !Number.isFinite(d.breakMinutes) || d.breakMinutes <= 0) return false;
  if (typeof d.accumulatedMs !== "number" || !Number.isFinite(d.accumulatedMs) || d.accumulatedMs < 0) return false;
  if (typeof d.savedAt !== "number" || !Number.isFinite(d.savedAt) || d.savedAt <= 0) return false;

  // Stale check (older than 24 hours or clock shifted backwards by more than 1 minute)
  if (now - d.savedAt > MAX_SESSION_AGE_MS || now < d.savedAt - 60000) return false;

  if (typeof d.running !== "boolean") return false;
  if (d.startedAt !== null && (typeof d.startedAt !== "number" || !Number.isFinite(d.startedAt))) return false;
  if (typeof d.awayCount !== "number" || d.awayCount < 0) return false;
  if (typeof d.awaySeconds !== "number" || d.awaySeconds < 0) return false;
  if (d.clientSessionId !== undefined && (typeof d.clientSessionId !== "string" || !d.clientSessionId)) return false;

  return true;
}

export function evaluateRecoveredSession(
  session: StoredFocusSession,
  now = Date.now()
): RecoveredSessionState {
  let calculatedElapsedMs = session.accumulatedMs;
  if (session.running && session.startedAt !== null) {
    const live = Math.max(0, now - session.startedAt);
    calculatedElapsedMs += live;
  }

  const targetMs =
    session.phase === "break"
      ? session.breakMinutes * 60000
      : session.mode === "stopwatch"
        ? null
        : session.focusMinutes * 60000;

  const isExpired = targetMs !== null && calculatedElapsedMs >= targetMs;

  return {
    session,
    calculatedElapsedMs: targetMs !== null && isExpired ? targetMs : calculatedElapsedMs,
    targetMs,
    isExpired,
  };
}
