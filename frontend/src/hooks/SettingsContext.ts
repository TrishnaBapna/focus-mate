import { createContext } from "react";
import type { Settings } from "../types/settings";

export const DEFAULT_SETTINGS: Settings = {
  dailyGoalMinutes: 120,
  theme: "system",
  background: "classic",
  blockList: [],
};

export interface SettingsContextValue {
  settings: Settings;
  update: (patch: Partial<Settings>) => void;
}

export const SettingsContext = createContext<SettingsContextValue>({
  settings: DEFAULT_SETTINGS,
  update: () => {},
});
