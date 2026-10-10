import type { Scene } from "../utils/scene";

export type ThemeChoice = "light" | "dark" | "system";
export type BackgroundChoice = "auto" | Exclude<Scene, "celebrate">;

export interface Settings {
  dailyGoalMinutes: number;
  theme: ThemeChoice;
  background: BackgroundChoice;
  customBackgroundId?: string; // the person's own photo, kept in the media area
}
