import type { FocusSession } from "../types";

// While a session runs, the plant grows with your progress
export function growthEmoji(progress: number | null, elapsedMinutes: number, wilted: boolean) {
  if (wilted) return "🥀";
  if (progress !== null) {
    if (progress < 25) return "🌱";
    if (progress < 50) return "🌿";
    if (progress < 75) return "🪴";
    if (progress < 100) return "🌷";
    return "🌳";
  }
  // Stopwatch has no end, so it grows with time instead
  if (elapsedMinutes < 5) return "🌱";
  if (elapsedMinutes < 15) return "🌿";
  if (elapsedMinutes < 30) return "🪴";
  return "🌷";
}

// The plant a finished session leaves in your garden: longer sessions grow bigger plants
export function plantFor(seconds: number, wilted: boolean) {
  if (wilted) return "🥀";
  const minutes = seconds / 60;
  if (minutes < 10) return "🌱";
  if (minutes < 25) return "🌿";
  if (minutes < 45) return "🌷";
  if (minutes < 75) return "🌳";
  return "🌸";
}

export function isWilted(session: FocusSession) {
  return !!session.strict && (session.leaves ?? 0) > 0;
}

export function sessionPlant(session: FocusSession) {
  return plantFor(session.durationSeconds, isWilted(session));
}

export const CHEERS = [
  "Your brain is leveling up 🧠",
  "Tiny steps, big wins 🏆",
  "Future you says thank you 💌",
  "Snacks later, focus now 🍪",
  "You're doing great. Keep going 🚀",
  "Every minute is a seed 🌱",
  "Deep breath. You've got this 💪",
];
