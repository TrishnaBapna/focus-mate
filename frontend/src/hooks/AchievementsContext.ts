import { createContext } from "react";
import type { Progress } from "../utils/achievements";

export interface AchievementsValue {
  progress: Progress;
  ready: boolean;
  unlockedAt: Record<string, string>;
}

export const AchievementsContext = createContext<AchievementsValue | null>(null);
