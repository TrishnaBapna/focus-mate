import { useMemo } from "react";
import { useAchievements } from "./useAchievements";
import { usePlans } from "./usePlans";
import { occursOn } from "../utils/plans";
import { dayKey } from "../utils/stats";
import { sortTasks } from "../utils/tasks";

// What belongs on "Today's Tasks": today's study blocks, plus tasks due now (or your top 3)
export function useTodayItems() {
  const { tasks } = useAchievements();
  const { plans } = usePlans();

  return useMemo(() => {
    const todayKey = dayKey(new Date());
    const open = tasks.filter((t) => t.status !== "done");
    const due = open.filter((t) => t.deadline && t.deadline <= todayKey);
    const blocks = plans
      .filter((p) => occursOn(p, todayKey))
      .sort((a, b) => a.startTime.localeCompare(b.startTime));
    const fallback = due.length === 0;

    return {
      plans: blocks,
      tasks: sortTasks(fallback ? open : due).slice(0, fallback ? 3 : 6),
      dueCount: due.length,
      fallback,
    };
  }, [tasks, plans]);
}
