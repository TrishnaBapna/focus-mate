import { useContext } from "react";
import { AchievementsContext } from "./AchievementsContext";

export function useAchievements() {
  const ctx = useContext(AchievementsContext);
  if (!ctx) throw new Error("useAchievements must be used inside AchievementsProvider");
  return ctx;
}
