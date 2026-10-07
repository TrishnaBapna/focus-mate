import { dayKey } from "./stats";
import type { Task, TaskPriority, TaskStatus } from "../types";

export const PRIORITY_ICON: Record<TaskPriority, string> = {
  high: "🔴",
  medium: "🟡",
  low: "🟢",
};

export const STATUS_ICON: Record<TaskStatus, string> = {
  todo: "☐",
  in_progress: "◐",
  done: "☑",
};

const PRIORITY_RANK: Record<TaskPriority, number> = { high: 0, medium: 1, low: 2 };

export function nextStatus(status: TaskStatus): TaskStatus {
  if (status === "todo") return "in_progress";
  if (status === "in_progress") return "done";
  return "todo";
}

// High priority first, then earliest deadline (no deadline goes last)
export function sortTasks(tasks: Task[]): Task[] {
  return [...tasks].sort(
    (a, b) =>
      PRIORITY_RANK[a.priority] - PRIORITY_RANK[b.priority] ||
      (a.deadline || "9999").localeCompare(b.deadline || "9999")
  );
}

export function deadlineInfo(deadline: string): { text: string; overdue: boolean } | null {
  if (!deadline) return null;

  const today = new Date();
  const todayKey = dayKey(today);
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);

  if (deadline < todayKey) return { text: "Overdue", overdue: true };
  if (deadline === todayKey) return { text: "Due today", overdue: false };
  if (deadline === dayKey(tomorrow)) return { text: "Due tomorrow", overdue: false };

  const [y, m, d] = deadline.split("-").map(Number);
  const label = new Date(y, m - 1, d).toLocaleDateString(undefined, {
    day: "numeric",
    month: "short",
  });
  return { text: `Due ${label}`, overdue: false };
}
