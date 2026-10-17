import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { useAuth } from "./useAuth";
import { useSubjects } from "./useSubjects";
import { useTimer } from "./useTimer";
import {
  FocusContext,
  type FocusResult,
  type Phase,
  type SaveStatus,
} from "./FocusContext";
import { addSession } from "../services/sessions";
import { auth } from "../services/firebase";
import { formatClock } from "../utils/time";
import { playChime } from "../utils/chime";
import {
  clearActiveSession,
  evaluateRecoveredSession,
  loadActiveSession,
  saveActiveSession,
  type RecoveredSessionState,
  type StoredFocusSession,
} from "../utils/timerRecovery";
import type { FocusSession, SessionMode } from "../types";

const MIN_SAVE_SECONDS = 60;
const MIN_AWAY_SECONDS = 3; // ignore quick flickers

type KeyboardApi = {
  keyboard?: { lock?: (keys: string[]) => Promise<void>; unlock?: () => void };
};

// Goes full screen and, where the browser allows it (Chrome, Edge), captures the Esc key.
// Must be called from a click or tap.
async function enterFullscreen() {
  try {
    await document.documentElement.requestFullscreen?.();
    await (navigator as Navigator & KeyboardApi).keyboard?.lock?.(["Escape"]);
  } catch {
    // not supported, or the browser said no: that's fine
  }
}

interface InitialState {
  session: StoredFocusSession | null;
  evaluation: RecoveredSessionState | null;
}

function getInitialRecovery(): InitialState {
  try {
    const uid = auth.currentUser?.uid;
    if (!uid) return { session: null, evaluation: null };
    const stored = loadActiveSession(uid);
    if (!stored) return { session: null, evaluation: null };
    const evaluation = evaluateRecoveredSession(stored);
    return { session: stored, evaluation };
  } catch {
    return { session: null, evaluation: null };
  }
}

export default function FocusProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const { subjects } = useSubjects();

  const [initial] = useState(getInitialRecovery);

  const [phase, setPhase] = useState<Phase>(() => {
    if (!initial.session) return "setup";
    if (initial.session.phase === "focusDone") return "focusDone";
    if (initial.evaluation?.isExpired) {
      return initial.session.phase === "focus" ? "focusDone" : "setup";
    }
    return initial.session.phase;
  });
  const [mode, setMode] = useState<SessionMode>(() => initial.session?.mode ?? "pomodoro");
  const [subjectId, setSubjectId] = useState<string>(() => initial.session?.subjectId ?? "");
  const [topic, setTopic] = useState<string>(() => initial.session?.topic ?? "");
  const [goal, setGoal] = useState<string>(() => initial.session?.goal ?? "");
  const [focusMinutes, setFocusMinutes] = useState<number>(() => initial.session?.focusMinutes ?? 25);
  const [breakMinutes, setBreakMinutes] = useState<number>(() => initial.session?.breakMinutes ?? 5);
  const [strict, setStrict] = useState<boolean>(() => initial.session?.strict ?? false);
  const [result, setResult] = useState<FocusResult | null>(() => {
    if (initial.session?.phase === "focusDone" && initial.session.completedPayload) {
      const payload = initial.session.completedPayload;
      return {
        seconds: payload.durationSeconds,
        status: "error",
        clientSessionId: initial.session.clientSessionId,
        savedPayload: payload,
        strict: payload.strict,
        leaves: payload.leaves,
        awaySeconds: payload.awaySeconds,
      };
    }
    if (initial.session && initial.evaluation?.isExpired && initial.session.phase === "focus") {
      const targetSecs = Math.round((initial.evaluation.targetMs ?? 0) / 1000);
      const isStrict = initial.session.strict;
      let leaves = initial.session.awayCount;
      let awaySeconds = initial.session.awaySeconds;
      if (isStrict && initial.session.running) {
        leaves += 1;
        const elapsedBeforeClose = Math.round((initial.session.accumulatedMs ?? 0) / 1000);
        awaySeconds += Math.max(0, targetSecs - elapsedBeforeClose);
      }
      return {
        seconds: targetSecs,
        status: targetSecs >= MIN_SAVE_SECONDS ? "error" : "short",
        strict: isStrict,
        leaves,
        awaySeconds,
        clientSessionId: initial.session.clientSessionId,
      };
    }
    return null;
  });
  const [isRetryingSave, setIsRetryingSave] = useState(false);

  // Recovery notice for the user
  const [recoveredNotice, setRecoveredNotice] = useState<string | null>(() => {
    if (!initial.session) return null;
    if (initial.session.phase === "focusDone") {
      return "Your completed session is ready to save to your profile. ⏱️";
    }
    if (initial.evaluation?.isExpired) {
      return initial.session.phase === "focus"
        ? "Your focus session completed while you were away! 🎉"
        : "Your break finished while you were away. Ready to focus again? ☕";
    }
    if (initial.session.phase === "break") {
      return initial.session.running
        ? "Resumed your break in progress ☕"
        : "Restored your paused break ☕";
    }
    return initial.session.running
      ? "Resumed your active session in progress ⏱️"
      : "Restored your paused focus session ⏸️";
  });
  const dismissRecoveredNotice = useCallback(() => setRecoveredNotice(null), []);

  // Strict mode: every time the person leaves
  const [away, setAway] = useState(() => ({
    count: initial.session?.awayCount ?? 0,
    seconds: initial.session?.awaySeconds ?? 0,
  }));
  const [awayNotice, setAwayNotice] = useState<number | null>(null);
  const [needsFullscreen, setNeedsFullscreen] = useState<boolean>(
    () => !!(initial.session?.strict && !initial.evaluation?.isExpired && initial.session.phase === "focus")
  );
  const awayRef = useRef({
    count: initial.session?.awayCount ?? 0,
    seconds: initial.session?.awaySeconds ?? 0,
  });
  const awayStartRef = useRef<number | null>(null);
  const fullscreenEnteredRef = useRef(false);

  // Refs for safe recovery and deduplicated completion
  const isFinishingRef = useRef(false);
  const storedSubjectRef = useRef({
    id: initial.session?.subjectId ?? "",
    name: initial.session?.subjectName ?? "",
    emoji: initial.session?.subjectEmoji ?? "⏱️",
  });

  const subject = subjects.find((s) => s.id === subjectId);
  const strictActive = phase === "focus" && strict;

  const targetMs =
    phase === "break"
      ? breakMinutes * 60000
      : mode === "stopwatch"
        ? null
        : focusMinutes * 60000;

  const initialTimer = useMemo(() => {
    if (!initial.session || initial.evaluation?.isExpired) {
      return { elapsedMs: 0, running: false };
    }
    return {
      elapsedMs: initial.evaluation?.calculatedElapsedMs ?? 0,
      running: initial.session.running,
    };
  }, [initial]);

  const finishFocus = useCallback(
    async (totalMs: number, override?: StoredFocusSession) => {
      if (isFinishingRef.current) return;
      isFinishingRef.current = true;

      try {
        const seconds = Math.round(totalMs / 1000);
        const wasStrict = override ? override.strict : strict;
        const targetSubjectId = override ? override.subjectId : subjectId;
        const targetTopic = override ? override.topic : topic;
        const targetGoal = override ? override.goal : goal;
        const targetMode = override ? override.mode : mode;

        let status: SaveStatus = "short";
        let sessionId: string | undefined;

        // Count time away that was still going when the session ended
        let leaves = override ? override.awayCount : awayRef.current.count;
        let awaySeconds = override ? override.awaySeconds : awayRef.current.seconds;
        if (!override && awayStartRef.current !== null) {
          const secs = Math.round((Date.now() - awayStartRef.current) / 1000);
          awayStartRef.current = null;
          if (secs >= MIN_AWAY_SECONDS) {
            leaves += 1;
            awaySeconds += secs;
          }
        }

        const activeSubject =
          subjects.find((s) => s.id === targetSubjectId) ??
          (targetSubjectId
            ? {
                id: targetSubjectId,
                name: override?.subjectName || storedSubjectRef.current.name || "Subject",
                emoji: override?.subjectEmoji || storedSubjectRef.current.emoji || "⏱️",
              }
            : undefined);

        const clientSessionId =
          override?.clientSessionId ||
          (typeof crypto !== "undefined" && crypto.randomUUID
            ? crypto.randomUUID()
            : `sess_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`);

        let savedPayload: Omit<FocusSession, "id"> | undefined;

        if (user && activeSubject && seconds >= MIN_SAVE_SECONDS) {
          savedPayload = {
            subjectId: activeSubject.id,
            subjectName: activeSubject.name,
            subjectEmoji: activeSubject.emoji,
            topic: targetTopic.trim(),
            goal: targetGoal.trim(),
            mode: targetMode,
            durationSeconds: seconds,
            ...(wasStrict ? { strict: true, leaves, awaySeconds } : {}),
          };

          // Retain snapshot in localStorage with phase: focusDone, clientSessionId, and completedPayload before Firestore write
          saveActiveSession({
            version: 1,
            uid: user.uid,
            phase: "focusDone",
            mode: targetMode,
            subjectId: activeSubject.id,
            subjectName: activeSubject.name,
            subjectEmoji: activeSubject.emoji,
            topic: targetTopic,
            goal: targetGoal,
            focusMinutes,
            breakMinutes,
            strict: wasStrict,
            running: false,
            startedAt: null,
            accumulatedMs: totalMs,
            savedAt: Date.now(),
            awayCount: leaves,
            awaySeconds,
            clientSessionId,
            completedPayload: savedPayload,
          });

          try {
            const ref = await addSession(user.uid, savedPayload, clientSessionId);
            sessionId = ref.id;
            status = "saved";
            // ONLY clear active session after successful Firestore save
            clearActiveSession(user.uid);
          } catch (err) {
            console.error("Failed to save session", err);
            status = "error";
            // Do NOT clear active session on error, allowing user to retry save
          }
        } else if (user) {
          clearActiveSession(user.uid);
        }

        setResult({
          seconds,
          status,
          sessionId,
          clientSessionId,
          savedPayload,
          ...(wasStrict ? { strict: true, leaves, awaySeconds } : {}),
        });
        setPhase("focusDone");
      } finally {
        isFinishingRef.current = false;
      }
    },
    [user, strict, subjectId, topic, goal, mode, subjects, focusMinutes, breakMinutes]
  );

  const retrySaveSession = useCallback(async () => {
    if (!user || !result?.savedPayload || isRetryingSave) return;
    setIsRetryingSave(true);
    try {
      const ref = await addSession(user.uid, result.savedPayload, result.clientSessionId);
      clearActiveSession(user.uid);
      setResult((prev) =>
        prev
          ? {
              ...prev,
              status: "saved",
              sessionId: ref.id,
            }
          : null
      );
    } catch (err) {
      console.error("Retry save failed:", err);
    } finally {
      setIsRetryingSave(false);
    }
  }, [user, result, isRetryingSave]);

  const timer = useTimer(
    targetMs,
    () => {
      playChime();
      if (phase === "focus") void finishFocus(targetMs ?? 0);
      else if (phase === "break") {
        if (user) clearActiveSession(user.uid);
        setPhase("setup");
      }
    },
    initialTimer.elapsedMs,
    initialTimer.running
  );

  const persistCurrentSession = useCallback(
    (overrides?: Partial<StoredFocusSession>) => {
      if (!user) return;
      if (phase !== "focus" && phase !== "break") return;

      const snap = timer.getSnapshot();
      const effectiveSubject =
        subjects.find((s) => s.id === subjectId) ??
        (subjectId
          ? {
              id: subjectId,
              name: storedSubjectRef.current.name,
              emoji: storedSubjectRef.current.emoji,
            }
          : undefined);

      const data: StoredFocusSession = {
        version: 1,
        uid: user.uid,
        phase,
        mode,
        subjectId,
        subjectName: effectiveSubject?.name,
        subjectEmoji: effectiveSubject?.emoji,
        topic,
        goal,
        focusMinutes,
        breakMinutes,
        strict,
        running: snap.running,
        startedAt: snap.startedAt,
        accumulatedMs: snap.accumulatedMs,
        savedAt: Date.now(),
        awayCount: awayRef.current.count,
        awaySeconds: awayRef.current.seconds,
        ...overrides,
      };

      saveActiveSession(data);
    },
    [user, phase, mode, subjectId, subjects, topic, goal, focusMinutes, breakMinutes, strict, timer]
  );

  // Handle expired focus session recording in Firestore on mount
  const expiredHandledRef = useRef(false);
  useEffect(() => {
    if (!initial.session || !initial.evaluation?.isExpired) return;
    if (expiredHandledRef.current) return;
    if (!user) return;
    expiredHandledRef.current = true;

    const { session, evaluation } = initial;

    if (session.phase === "break") {
      clearActiveSession(session.uid);
      return;
    }

    if (session.phase === "focusDone" && session.completedPayload) {
      addSession(user.uid, session.completedPayload, session.clientSessionId)
        .then((ref) => {
          clearActiveSession(session.uid);
          setResult((prev) => prev ? { ...prev, status: "saved", sessionId: ref.id } : null);
        })
        .catch((err) => {
          console.error("Failed to save recovered focus session:", err);
        });
      return;
    }

    if (session.phase === "focus") {
      const seconds = Math.round((evaluation.targetMs ?? 0) / 1000);
      let leaves = session.awayCount;
      let awaySeconds = session.awaySeconds;
      if (session.strict && session.running) {
        leaves += 1;
        const elapsedBeforeClose = Math.round((session.accumulatedMs ?? 0) / 1000);
        awaySeconds += Math.max(0, seconds - elapsedBeforeClose);
      }

      const clientSessionId =
        session.clientSessionId ||
        (typeof crypto !== "undefined" && crypto.randomUUID
          ? crypto.randomUUID()
          : `rec_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`);

      if (seconds < MIN_SAVE_SECONDS) {
        clearActiveSession(session.uid);
        return;
      }

      const effectiveSubject =
        subjects.find((s) => s.id === session.subjectId) ??
        (session.subjectId
          ? {
              id: session.subjectId,
              name: session.subjectName || "Subject",
              emoji: session.subjectEmoji || "⏱️",
            }
          : undefined);

      if (!effectiveSubject) {
        return;
      }

      const payload: Omit<FocusSession, "id"> = {
        subjectId: effectiveSubject.id,
        subjectName: effectiveSubject.name,
        subjectEmoji: effectiveSubject.emoji,
        topic: session.topic.trim(),
        goal: session.goal.trim(),
        mode: session.mode,
        durationSeconds: seconds,
        ...(session.strict ? { strict: true, leaves, awaySeconds } : {}),
      };

      // Retain snapshot in localStorage with phase: focusDone, clientSessionId, completedPayload, and updated away stats
      saveActiveSession({
        ...session,
        phase: "focusDone",
        clientSessionId,
        awayCount: leaves,
        awaySeconds,
        completedPayload: payload,
      });

      addSession(user.uid, payload, clientSessionId)
        .then((ref) => {
          clearActiveSession(session.uid);
          setResult({
            seconds,
            status: "saved",
            sessionId: ref.id,
            clientSessionId,
            savedPayload: payload,
            strict: session.strict,
            leaves,
            awaySeconds,
          });
        })
        .catch((err) => {
          console.error("Failed to save expired focus session:", err);
          // Do NOT clear active session on error, allowing retry save
          setResult({
            seconds,
            status: "error",
            clientSessionId,
            savedPayload: payload,
            strict: session.strict,
            leaves,
            awaySeconds,
          });
        });
    }
  }, [initial, user, subjects]);

  // Handle logout: clear recovery and reset timer
  const currentUidRef = useRef(user?.uid ?? null);
  useEffect(() => {
    if (!user && currentUidRef.current) {
      clearActiveSession(currentUidRef.current);
      currentUidRef.current = null;
      timer.reset();
    } else if (user) {
      currentUidRef.current = user.uid;
    }
  }, [user, timer]);

  function startFocus() {
    if (!subject) return;

    awayRef.current = { count: 0, seconds: 0 };
    awayStartRef.current = null;
    fullscreenEnteredRef.current = false;
    setAway(awayRef.current);
    setAwayNotice(null);
    setNeedsFullscreen(false);
    setRecoveredNotice(null);

    storedSubjectRef.current = {
      id: subject.id,
      name: subject.name,
      emoji: subject.emoji,
    };

    timer.reset();
    setPhase("focus");
    timer.start();

    if (user) {
      saveActiveSession({
        version: 1,
        uid: user.uid,
        phase: "focus",
        mode,
        subjectId: subject.id,
        subjectName: subject.name,
        subjectEmoji: subject.emoji,
        topic: topic.trim(),
        goal: goal.trim(),
        focusMinutes,
        breakMinutes,
        strict,
        running: true,
        startedAt: Date.now(),
        accumulatedMs: 0,
        savedAt: Date.now(),
        awayCount: 0,
        awaySeconds: 0,
      });
    }

    // Must happen inside the click that started the session
    if (strict) void enterFullscreen();
  }

  function startBreak() {
    setRecoveredNotice(null);
    timer.reset();
    setPhase("break");
    timer.start();

    if (user) {
      saveActiveSession({
        version: 1,
        uid: user.uid,
        phase: "break",
        mode,
        subjectId,
        subjectName: subject?.name || storedSubjectRef.current.name,
        subjectEmoji: subject?.emoji || storedSubjectRef.current.emoji,
        topic,
        goal,
        focusMinutes,
        breakMinutes,
        strict: false,
        running: true,
        startedAt: Date.now(),
        accumulatedMs: 0,
        savedAt: Date.now(),
        awayCount: 0,
        awaySeconds: 0,
      });
    }
  }

  function backToSetup() {
    if (user) clearActiveSession(user.uid);
    setRecoveredNotice(null);
    timer.reset();
    setPhase("setup");
  }

  function cancelSession() {
    if (window.confirm("Discard this session? The time won't be saved.")) {
      backToSetup();
    }
  }

  const remaining = targetMs !== null ? Math.max(0, targetMs - timer.elapsedMs) : 0;
  const clockText =
    targetMs !== null
      ? formatClock(Math.ceil(remaining / 1000) * 1000)
      : formatClock(timer.elapsedMs);
  const progress = targetMs ? Math.min(100, (timer.elapsedMs / targetMs) * 100) : 0;

  // Show the countdown in the browser tab title while a session is running
  useEffect(() => {
    const active = phase === "focus" || phase === "break";
    document.title = active ? `${clockText} · Focus Mate` : "Focus Mate";
    return () => {
      document.title = "Focus Mate";
    };
  }, [phase, clockText]);

  // Periodic background snapshot and beforeunload/pagehide saving
  useEffect(() => {
    if (phase !== "focus" && phase !== "break") return;
    if (!user) return;

    const id = window.setInterval(() => {
      persistCurrentSession();
    }, 5000);

    const onPageHide = () => {
      persistCurrentSession();
    };

    window.addEventListener("beforeunload", onPageHide);
    window.addEventListener("pagehide", onPageHide);

    return () => {
      window.clearInterval(id);
      window.removeEventListener("beforeunload", onPageHide);
      window.removeEventListener("pagehide", onPageHide);
    };
  }, [phase, user, persistCurrentSession]);

  // Strict mode: persist away stats when they update
  useEffect(() => {
    if (!strictActive) return;
    persistCurrentSession({
      awayCount: away.count,
      awaySeconds: away.seconds,
    });
  }, [away, strictActive, persistCurrentSession]);

  // Warn before closing the tab or refreshing mid-session
  useEffect(() => {
    if (phase !== "focus" && phase !== "break") return;
    const handler = (e: BeforeUnloadEvent) => e.preventDefault();
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [phase]);

  // Strict mode: notice when the tab or app is left, and when the person comes back
  useEffect(() => {
    if (!strictActive) return;

    function leave() {
      if (awayStartRef.current === null) awayStartRef.current = Date.now();
    }

    function back() {
      if (awayStartRef.current === null) return;
      const secs = Math.round((Date.now() - awayStartRef.current) / 1000);
      awayStartRef.current = null;
      if (secs >= MIN_AWAY_SECONDS) {
        awayRef.current = {
          count: awayRef.current.count + 1,
          seconds: awayRef.current.seconds + secs,
        };
        setAway(awayRef.current);
        setAwayNotice(secs);
      }
    }

    const onVisibility = () => (document.hidden ? leave() : back());
    const onBlur = () => {
      // Tapping inside an embedded player (like Spotify) isn't leaving
      if (document.activeElement instanceof HTMLIFrameElement) return;
      leave();
    };

    document.addEventListener("visibilitychange", onVisibility);
    window.addEventListener("blur", onBlur);
    window.addEventListener("focus", back);
    return () => {
      document.removeEventListener("visibilitychange", onVisibility);
      window.removeEventListener("blur", onBlur);
      window.removeEventListener("focus", back);
    };
  }, [strictActive]);

  // Strict mode: leaving full screen counts as leaving
  useEffect(() => {
    if (!strictActive) return;

    function onFullscreenChange() {
      if (document.fullscreenElement) {
        fullscreenEnteredRef.current = true;
        setNeedsFullscreen(false);
        return;
      }
      if (fullscreenEnteredRef.current) {
        fullscreenEnteredRef.current = false;
        awayRef.current = { count: awayRef.current.count + 1, seconds: awayRef.current.seconds };
        setAway(awayRef.current);
        setNeedsFullscreen(true);
      }
    }

    document.addEventListener("fullscreenchange", onFullscreenChange);
    return () => document.removeEventListener("fullscreenchange", onFullscreenChange);
  }, [strictActive]);

  // Strict mode: block refresh shortcuts and the right-click menu
  useEffect(() => {
    if (!strictActive) return;

    function onKey(e: KeyboardEvent) {
      const refresh = e.key === "F5" || ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "r");
      if (refresh) e.preventDefault();
    }
    const onMenu = (e: Event) => e.preventDefault();

    window.addEventListener("keydown", onKey);
    window.addEventListener("contextmenu", onMenu);
    return () => {
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("contextmenu", onMenu);
    };
  }, [strictActive]);

  // Strict mode: keep the screen awake, and let go of full screen and Esc when it ends
  useEffect(() => {
    if (!strictActive) return;

    let lock: WakeLockSentinel | null = null;
    let cancelled = false;

    async function acquire() {
      try {
        if (!("wakeLock" in navigator)) return;
        const sentinel = await navigator.wakeLock.request("screen");
        if (cancelled) void sentinel.release();
        else lock = sentinel;
      } catch {
        // not allowed right now (for example, low battery); that's fine
      }
    }

    function onVisible() {
      if (!document.hidden) void acquire();
    }

    void acquire();
    document.addEventListener("visibilitychange", onVisible);

    return () => {
      cancelled = true;
      document.removeEventListener("visibilitychange", onVisible);
      if (lock) void lock.release();
      try {
        (navigator as Navigator & KeyboardApi).keyboard?.unlock?.();
      } catch {
        // nothing to unlock
      }
      if (document.fullscreenElement) {
        Promise.resolve(document.exitFullscreen()).catch(() => {});
      }
    };
  }, [strictActive]);

  return (
    <FocusContext.Provider
      value={{
        phase,
        mode,
        setMode,
        subjectId,
        setSubjectId,
        topic,
        setTopic,
        goal,
        setGoal,
        focusMinutes,
        setFocusMinutes,
        breakMinutes,
        setBreakMinutes,
        strict,
        setStrict,
        subject,
        result,
        running: timer.running,
        clockText,
        progress,
        hasTarget: targetMs !== null,
        elapsedSeconds: Math.floor(timer.elapsedMs / 1000),
        strictActive,
        awayCount: away.count,
        awaySeconds: away.seconds,
        awayNotice: strictActive ? awayNotice : null,
        dismissAwayNotice: () => setAwayNotice(null),
        needsFullscreen: strictActive && needsFullscreen,
        returnToFullscreen: () => void enterFullscreen(),
        recoveredNotice,
        dismissRecoveredNotice,
        startFocus,
        startBreak,
        backToSetup,
        cancelSession,
        pause: () => {
          const elapsed = timer.pause();
          if (user && (phase === "focus" || phase === "break")) {
            persistCurrentSession({
              running: false,
              startedAt: null,
              accumulatedMs: elapsed,
            });
          }
        },
        resume: () => {
          const now = Date.now();
          const snap = timer.getSnapshot();
          timer.start();
          if (user && (phase === "focus" || phase === "break")) {
            persistCurrentSession({
              running: true,
              startedAt: now,
              accumulatedMs: snap.accumulatedMs,
            });
          }
        },
        finishEarly: () => void finishFocus(timer.pause()),
        retrySaveSession,
        isRetryingSave,
      }}
    >
      {children}
    </FocusContext.Provider>
  );
}
