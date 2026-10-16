import { useCallback, useEffect, useRef, useState } from "react";

export function useTimer(
  targetMs: number | null,
  onComplete: () => void,
  initialElapsedMs = 0,
  initialRunning = false
) {
  const [elapsedMs, setElapsedMs] = useState(initialElapsedMs);
  const [running, setRunning] = useState(initialRunning);
  const [initialNow] = useState(() => (initialRunning ? Date.now() : null));

  const startedAt = useRef<number | null>(initialNow); // when the current run began
  const accumulated = useRef(initialElapsedMs); // time from earlier runs (before pauses)
  const onCompleteRef = useRef(onComplete);

  useEffect(() => {
    onCompleteRef.current = onComplete;
  }, [onComplete]);

  useEffect(() => {
    if (!running) return;

    const checkTick = () => {
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
    };

    const id = window.setInterval(checkTick, 250);

    const onWake = () => {
      if (!document.hidden) checkTick();
    };
    document.addEventListener("visibilitychange", onWake);
    window.addEventListener("focus", onWake);

    return () => {
      window.clearInterval(id);
      document.removeEventListener("visibilitychange", onWake);
      window.removeEventListener("focus", onWake);
    };
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

  const hydrate = useCallback((initialElapsedMs: number, isRunning: boolean) => {
    accumulated.current = initialElapsedMs;
    startedAt.current = isRunning ? Date.now() : null;
    setElapsedMs(initialElapsedMs);
    setRunning(isRunning);
  }, []);

  const getSnapshot = useCallback(() => {
    const live = running && startedAt.current !== null ? Math.max(0, Date.now() - startedAt.current) : 0;
    return {
      accumulatedMs: accumulated.current,
      startedAt: startedAt.current,
      running,
      elapsedMs: accumulated.current + live,
    };
  }, [running]);

  return { elapsedMs, running, start, pause, reset, hydrate, getSnapshot };
}
