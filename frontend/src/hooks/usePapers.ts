import { useEffect, useState } from "react";
import { useAuth } from "./useAuth";
import { listenToPapers } from "../services/papers";
import type { Paper } from "../types/paper";

export function usePapers() {
  const { user } = useAuth();
  const [papers, setPapers] = useState<Paper[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;
    return listenToPapers(user.uid, (list) => {
      setPapers(list);
      setLoading(false);
    });
  }, [user]);

  return { papers, loading };
}
