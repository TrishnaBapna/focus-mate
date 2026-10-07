import { useEffect, useState } from "react";
import { useAuth } from "./useAuth";
import { listenToTasks } from "../services/tasks";
import type { Task } from "../types";

export function useTasks() {
  const { user } = useAuth();
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;
    return listenToTasks(user.uid, (list) => {
      setTasks(list);
      setLoading(false);
    });
  }, [user]);

  return { tasks, loading };
}
