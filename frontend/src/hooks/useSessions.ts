import { useEffect, useState } from "react";
import { useAuth } from "./useAuth";
import { listenToSessions } from "../services/sessions";
import type { FocusSession } from "../types";

export function useSessions(count: number) {
  const { user } = useAuth();
  const [sessions, setSessions] = useState<FocusSession[]>([]);

  useEffect(() => {
    if (!user) return;
    return listenToSessions(user.uid, count, setSessions);
  }, [user, count]);

  return { sessions };
}
