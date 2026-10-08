import { useEffect, useState } from "react";
import { useAuth } from "./useAuth";
import { listenToExams } from "../services/exams";
import type { Exam } from "../types/exam";

export function useExams() {
  const { user } = useAuth();
  const [exams, setExams] = useState<Exam[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;
    return listenToExams(user.uid, (list) => {
      setExams(list);
      setLoading(false);
    });
  }, [user]);

  return { exams, loading };
}
