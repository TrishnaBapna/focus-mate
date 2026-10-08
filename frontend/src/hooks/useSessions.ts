import { useEffect, useState } from "react";
import { useAuth } from "./useAuth";
import { listenToSessions } from "../services/sessions";
import type { FocusSession } from "../types";

export function useSessions(count: number) {
  const { user } = useAuth();
  const [sessions, setSessions] = useState<FocusSession[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;
    return listenToSessions(user.uid, count, (list) => {
      setSessions(list);
      setLoading(false);
    });
  }, [user, count]);

  return { sessions, loading };
}
