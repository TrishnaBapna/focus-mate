export interface NavItem {
  to: string;
  icon: string;
  label: string;
}

// Ordered by importance. Small screens show the first few; the rest go under "More".
export const NAV_ITEMS: NavItem[] = [
  { to: "/", icon: "🏠", label: "Home" },
  { to: "/focus", icon: "⏱️", label: "Focus" },
  { to: "/planner", icon: "📅", label: "Plan" },
  { to: "/notes", icon: "📝", label: "Notes" },
  { to: "/tasks", icon: "✅", label: "Tasks" },
  { to: "/study", icon: "🃏", label: "Study" },
  { to: "/exams", icon: "🎓", label: "Exams" },
  { to: "/subjects", icon: "📚", label: "Subjects" },
  { to: "/achievements", icon: "🏆", label: "Awards" },
  { to: "/analytics", icon: "📊", label: "Stats" },
];

// Always visible, never hidden under "More"
export const SETTINGS_NAV: NavItem = { to: "/settings", icon: "⚙️", label: "Settings" };

export const PHONE_NAV_COUNT = 4;
