import type { IconName } from "./Icon";

export interface NavItem {
  to: string;
  icon: IconName;
  label: string;
}

// Ordered by importance. Small screens show the first few; the rest go under "More".
export const NAV_ITEMS: NavItem[] = [
  { to: "/", icon: "grid", label: "Home" },
  { to: "/focus", icon: "timer", label: "Focus" },
  { to: "/notes", icon: "file", label: "Notes" },
  { to: "/assistant", icon: "chat", label: "Assistant" },
  { to: "/friends", icon: "users", label: "Friends" },
  { to: "/tasks", icon: "list", label: "Tasks" },
  { to: "/planner", icon: "calendar", label: "Plan" },
  { to: "/study", icon: "cards", label: "Study" },
  { to: "/exams", icon: "cap", label: "Exams" },
  { to: "/subjects", icon: "book", label: "Subjects" },
  { to: "/achievements", icon: "trophy", label: "Awards" },
  { to: "/analytics", icon: "chart", label: "Stats" },
];

// Always visible, never hidden under "More"
export const SETTINGS_NAV: NavItem = { to: "/settings", icon: "sliders", label: "Settings" };

export const PHONE_COUNT = 4;
