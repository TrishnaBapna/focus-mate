import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { useAuth } from "./useAuth";
import { useNotes } from "./useNotes";
import { useSessions } from "./useSessions";
import { useTasks } from "./useTasks";
import { AchievementsContext } from "./AchievementsContext";
import { listenToUnlocked, saveUnlocked, type UnlockedDoc } from "../services/achievements";
import { computeProgress, type AchievementState } from "../utils/achievements";
import { playChime } from "../utils/chime";

export default function AchievementsProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const { sessions, loading: sessionsLoading } = useSessions(2000);
  const { tasks, loading: tasksLoading } = useTasks();
  const { notes, loading: notesLoading } = useNotes();

  // undefined = still loading, null = this user has no record yet
  const [stored, setStored] = useState<UnlockedDoc | null | undefined>(undefined);
  const [toasts, setToasts] = useState<AchievementState[]>([]);
  const handled = useRef(new Set<string>());
  const seeded = useRef(false);

  const progress = useMemo(() => computeProgress(sessions, tasks, notes), [sessions, tasks, notes]);
  const ready = !sessionsLoading && !tasksLoading && !notesLoading && stored !== undefined;

  useEffect(() => {
    if (!user) return;
    return listenToUnlocked(user.uid, setStored);
  }, [user]);

  // Spot newly unlocked achievements, save them, and celebrate
  useEffect(() => {
    if (!user || !ready) return;

    const known = stored?.unlocked ?? {};
    const fresh = progress.achievements.filter(
      (a) => a.unlocked && !(a.id in known) && !handled.current.has(a.id)
    );

    const firstRun = stored === null;
    if (firstRun) {
      // First time ever: quietly record what's already earned, no toasts
      if (seeded.current) return;
      seeded.current = true;
    } else if (fresh.length === 0) {
      return;
    }

    fresh.forEach((a) => handled.current.add(a.id));
    const stamp = firstRun ? "" : new Date().toISOString();
    void saveUnlocked(user.uid, Object.fromEntries(fresh.map((a) => [a.id, stamp])));

    if (!firstRun) {
      setToasts((t) => [...t, ...fresh]);
      playChime();
    }
  }, [user, ready, stored, progress]);

  // Auto-dismiss toasts one by one
  useEffect(() => {
    if (toasts.length === 0) return;
    const id = window.setTimeout(() => setToasts((t) => t.slice(1)), 6000);
    return () => window.clearTimeout(id);
  }, [toasts]);

  return (
    <AchievementsContext.Provider
      value={{ progress, ready, unlockedAt: stored?.unlocked ?? {} }}
    >
      {children}
      <div className="toast-stack">
        {toasts.slice(0, 3).map((a) => (
          <button
            key={a.id}
            className="toast"
            onClick={() => setToasts((t) => t.filter((x) => x.id !== a.id))}
          >
            <span className="toast-emoji">{a.emoji}</span>
            <span>
              <strong>Achievement unlocked!</strong>
              <br />
              {a.title}
            </span>
          </button>
        ))}
      </div>
    </AchievementsContext.Provider>
  );
}
