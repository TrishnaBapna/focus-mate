import { useCallback, useEffect, useRef, useState } from "react";

// targetMs = null means "count up forever" (stopwatch).
export function useTimer(targetMs: number | null, onComplete: () => void) {
  const [elapsedMs, setElapsedMs] = useState(0);
  const [running, setRunning] = useState(false);

  const startedAt = useRef<number | null>(null); // when the current run began
  const accumulated = useRef(0); // time from earlier runs (before pauses)
  const onCompleteRef = useRef(onComplete);

  useEffect(() => {
    onCompleteRef.current = onComplete;
  }, [onComplete]);

  useEffect(() => {
    if (!running) return;
    const id = window.setInterval(() => {
      const live = startedAt.current !== null ? Date.now() - startedAt.current : 0;
      const elapsed = accumulated.current + live;

      if (targetMs !== null && elapsed >= targetMs) {
        startedAt.current = null;
        accumulated.current = targetMs;
        setElapsedMs(targetMs);
        setRunning(false);
        onCompleteRef.current();
      } else {
        setElapsedMs(elapsed);
      }
    }, 250);
    return () => window.clearInterval(id);
  }, [running, targetMs]);

  const start = useCallback(() => {
    if (startedAt.current === null) {
      startedAt.current = Date.now();
      setRunning(true);
    }
  }, []);

  // Returns the total elapsed milliseconds at the moment of pausing.
  const pause = useCallback(() => {
    if (startedAt.current !== null) {
      accumulated.current += Date.now() - startedAt.current;
      startedAt.current = null;
    }
    setElapsedMs(accumulated.current);
    setRunning(false);
    return accumulated.current;
  }, []);

  const reset = useCallback(() => {
    startedAt.current = null;
    accumulated.current = 0;
    setElapsedMs(0);
    setRunning(false);
  }, []);

  return { elapsedMs, running, start, pause, reset };
}
