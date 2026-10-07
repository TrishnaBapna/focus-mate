import type { Plan, PlanRepeat } from "../types";

export const REPEAT_LABEL: Record<PlanRepeat, string> = {
  none: "Once",
  daily: "Every day",
  weekdays: "Weekdays (Mon–Fri)",
  weekly: "Every week",
};

function parseKey(key: string): Date {
  const [y, m, d] = key.split("-").map(Number);
  return new Date(y, m - 1, d);
}

// Does this study block happen on the given day ("YYYY-MM-DD")?
export function occursOn(plan: Plan, key: string): boolean {
  if (key < plan.date) return false;
  switch (plan.repeat) {
    case "none":
      return key === plan.date;
    case "daily":
      return true;
    case "weekdays": {
      const day = parseKey(key).getDay();
      return day >= 1 && day <= 5;
    }
    case "weekly":
      return parseKey(key).getDay() === parseKey(plan.date).getDay();
  }
}

// "17:00" -> "5:00 PM"
export function formatTime(time: string): string {
  const [h, m] = time.split(":").map(Number);
  return new Date(2000, 0, 1, h, m).toLocaleTimeString(undefined, {
    hour: "numeric",
    minute: "2-digit",
  });
}

// ("17:00", 45) -> "17:45"
export function endTime(time: string, minutes: number): string {
  const [h, m] = time.split(":").map(Number);
  const total = h * 60 + m + minutes;
  const eh = Math.floor(total / 60) % 24;
  const em = total % 60;
  return `${String(eh).padStart(2, "0")}:${String(em).padStart(2, "0")}`;
}

export function formatDayLabel(key: string): string {
  return parseKey(key).toLocaleDateString(undefined, {
    weekday: "long",
    day: "numeric",
    month: "long",
  });
}
