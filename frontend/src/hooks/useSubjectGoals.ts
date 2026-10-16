import { useEffect, useState } from "react";
import { useAuth } from "./useAuth";
import { listenToSubjectGoals } from "../services/goals";
import type { SubjectGoal } from "../types";

export function useSubjectGoals() {
  const { user } = useAuth();
  const [goals, setGoals] = useState<SubjectGoal[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!user) {
      return;
    }
    return listenToSubjectGoals(
      user.uid,
      (list) => {
        setGoals(list);
        setLoading(false);
        setError(null);
      },
      (err) => {
        console.warn("useSubjectGoals listener error:", err);
        setError("Failed to load subject goals.");
        setLoading(false);
      }
    );
  }, [user]);

  return { goals, loading: user ? loading : false, error };
}
