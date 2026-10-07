import { useEffect, useState, type ReactNode } from "react";
import { useAuth } from "./useAuth";
import { DEFAULT_SETTINGS, SettingsContext } from "./SettingsContext";
import { listenToSettings, saveSettings } from "../services/settings";
import type { Settings } from "../types/settings";

const CACHE_KEY = "focusmate-settings";

// The browser cache lets the theme apply instantly, before Firestore responds.
function readCache(): Settings {
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    return raw ? { ...DEFAULT_SETTINGS, ...JSON.parse(raw) } : DEFAULT_SETTINGS;
  } catch {
    return DEFAULT_SETTINGS;
  }
}

function writeCache(settings: Settings) {
  try {
    localStorage.setItem(CACHE_KEY, JSON.stringify(settings));
  } catch {
    // ignore (private mode, storage full, ...)
  }
}

export default function SettingsProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const [settings, setSettings] = useState<Settings>(readCache);
  const [systemDark, setSystemDark] = useState(
    () => window.matchMedia("(prefers-color-scheme: dark)").matches
  );

  // Load this user's saved settings from Firestore
  useEffect(() => {
    if (!user) return;
    return listenToSettings(user.uid, (remote) => {
      const merged = { ...DEFAULT_SETTINGS, ...(remote ?? {}) };
      setSettings(merged);
      writeCache(merged);
    });
  }, [user]);

  // Follow the operating system's light/dark setting when theme = "system"
  useEffect(() => {
    const query = window.matchMedia("(prefers-color-scheme: dark)");
    const handler = (e: MediaQueryListEvent) => setSystemDark(e.matches);
    query.addEventListener("change", handler);
    return () => query.removeEventListener("change", handler);
  }, []);

  const resolvedTheme =
    settings.theme === "system" ? (systemDark ? "dark" : "light") : settings.theme;

  useEffect(() => {
    document.documentElement.dataset.theme = resolvedTheme;
    return () => {
      delete document.documentElement.dataset.theme;
    };
  }, [resolvedTheme]);

  function update(patch: Partial<Settings>) {
    const next = { ...settings, ...patch };
    setSettings(next);
    writeCache(next);
    if (user) void saveSettings(user.uid, patch);
  }

  return (
    <SettingsContext.Provider value={{ settings, update }}>
      {children}
    </SettingsContext.Provider>
  );
}
