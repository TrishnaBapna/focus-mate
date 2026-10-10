import { useEffect, useRef, useState, type ReactNode } from "react";
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
import { formatClock } from "../utils/time";
import { playChime } from "../utils/chime";
import type { SessionMode } from "../types";

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

export default function FocusProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const { subjects } = useSubjects();

  const [phase, setPhase] = useState<Phase>("setup");
  const [mode, setMode] = useState<SessionMode>("pomodoro");
  const [subjectId, setSubjectId] = useState("");
  const [topic, setTopic] = useState("");
  const [goal, setGoal] = useState("");
  const [focusMinutes, setFocusMinutes] = useState(25);
  const [breakMinutes, setBreakMinutes] = useState(5);
  const [strict, setStrict] = useState(false);
  const [result, setResult] = useState<FocusResult | null>(null);

  // Strict mode: every time the person leaves
  const [away, setAway] = useState({ count: 0, seconds: 0 });
  const [awayNotice, setAwayNotice] = useState<number | null>(null);
  const [needsFullscreen, setNeedsFullscreen] = useState(false);
  const awayRef = useRef({ count: 0, seconds: 0 });
  const awayStartRef = useRef<number | null>(null);
  const fullscreenEnteredRef = useRef(false);

  const subject = subjects.find((s) => s.id === subjectId);
  const strictActive = phase === "focus" && strict;

  const targetMs =
    phase === "break"
      ? breakMinutes * 60000
      : mode === "stopwatch"
        ? null
        : focusMinutes * 60000;

  async function finishFocus(totalMs: number) {
    const seconds = Math.round(totalMs / 1000);
    const wasStrict = strict;
    let status: SaveStatus = "short";
    let sessionId: string | undefined;

    // Count time away that was still going when the session ended
    let leaves = awayRef.current.count;
    let awaySeconds = awayRef.current.seconds;
    if (awayStartRef.current !== null) {
      const secs = Math.round((Date.now() - awayStartRef.current) / 1000);
      awayStartRef.current = null;
      if (secs >= MIN_AWAY_SECONDS) {
        leaves += 1;
        awaySeconds += secs;
      }
    }

    if (user && subject && seconds >= MIN_SAVE_SECONDS) {
      try {
        const ref = await addSession(user.uid, {
          subjectId: subject.id,
          subjectName: subject.name,
          subjectEmoji: subject.emoji,
          topic: topic.trim(),
          goal: goal.trim(),
          mode,
          durationSeconds: seconds,
          ...(wasStrict ? { strict: true, leaves, awaySeconds } : {}),
        });
        sessionId = ref.id;
        status = "saved";
      } catch (err) {
        console.error("Failed to save session", err);
        status = "error";
      }
    }

    setResult({
      seconds,
      status,
      sessionId,
      ...(wasStrict ? { strict: true, leaves, awaySeconds } : {}),
    });
    setPhase("focusDone");
  }

  const timer = useTimer(targetMs, () => {
    playChime();
    if (phase === "focus") void finishFocus(targetMs ?? 0);
    else if (phase === "break") setPhase("setup");
  });

  function startFocus() {
    if (!subject) return;

    awayRef.current = { count: 0, seconds: 0 };
    awayStartRef.current = null;
    fullscreenEnteredRef.current = false;
    setAway(awayRef.current);
    setAwayNotice(null);
    setNeedsFullscreen(false);

    timer.reset();
    setPhase("focus");
    timer.start();

    // Must happen inside the click that started the session
    if (strict) void enterFullscreen();
  }

  function startBreak() {
    timer.reset();
    setPhase("break");
    timer.start();
  }

  function backToSetup() {
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
        startFocus,
        startBreak,
        backToSetup,
        cancelSession,
        pause: () => {
          timer.pause();
        },
        resume: () => timer.start(),
        finishEarly: () => void finishFocus(timer.pause()),
      }}
    >
      {children}
    </FocusContext.Provider>
  );
}
