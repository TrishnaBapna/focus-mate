import { createContext } from "react";
import type { FocusSession, Task } from "../types";
import type { Progress } from "../utils/achievements";

export interface AchievementsValue {
  progress: Progress;
  ready: boolean;
  unlockedAt: Record<string, string>;
  sessions: FocusSession[];
  tasks: Task[];
}

export const AchievementsContext = createContext<AchievementsValue | null>(null);
