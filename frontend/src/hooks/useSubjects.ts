import { useEffect, useState } from "react";
import { useAuth } from "./useAuth";
import { listenToSubjects } from "../services/subjects";
import type { Subject } from "../types";

export function useSubjects() {
  const { user } = useAuth();
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;
    const unsubscribe = listenToSubjects(user.uid, (list) => {
      setSubjects(list);
      setLoading(false);
    });
    return unsubscribe;
  }, [user]);

  return { subjects, loading };
}
