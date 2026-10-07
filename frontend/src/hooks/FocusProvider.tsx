import { useEffect, useState, type ReactNode } from "react";
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
  const [result, setResult] = useState<FocusResult | null>(null);

  const subject = subjects.find((s) => s.id === subjectId);

  const targetMs =
    phase === "break"
      ? breakMinutes * 60000
      : mode === "stopwatch"
        ? null
        : focusMinutes * 60000;

  async function finishFocus(totalMs: number) {
    const seconds = Math.round(totalMs / 1000);
    let status: SaveStatus = "short";
    let sessionId: string | undefined;

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
        });
        sessionId = ref.id;
        status = "saved";
      } catch (err) {
        console.error("Failed to save session", err);
        status = "error";
      }
    }

    setResult({ seconds, status, sessionId });
    setPhase("focusDone");
  }

  const timer = useTimer(targetMs, () => {
    playChime();
    if (phase === "focus") void finishFocus(targetMs ?? 0);
    else if (phase === "break") setPhase("setup");
  });

  function startFocus() {
    if (!subject) return;
    timer.reset();
    setPhase("focus");
    timer.start();
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
        subject,
        result,
        running: timer.running,
        clockText,
        progress,
        hasTarget: targetMs !== null,
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
