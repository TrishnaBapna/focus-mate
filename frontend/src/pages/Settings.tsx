import { useState } from "react";
import { updateProfile } from "firebase/auth";
import { useAuth } from "../hooks/useAuth";
import { useSettings } from "../hooks/useSettings";
import { logout } from "../services/auth";
import InstallCard from "../components/InstallCard";
import type { BackgroundChoice, ThemeChoice } from "../types/settings";

const THEMES: { id: ThemeChoice; label: string }[] = [
  { id: "light", label: "☀️ Light" },
  { id: "dark", label: "🌙 Dark" },
  { id: "system", label: "💻 System" },
];

const GOAL_PRESETS = [60, 120, 180, 240];

const BACKGROUNDS: { id: BackgroundChoice; label: string }[] = [
  { id: "auto", label: "Automatic" },
  { id: "sunrise", label: "Sunrise" },
  { id: "afternoon", label: "Afternoon" },
  { id: "sunset", label: "Sunset" },
  { id: "night", label: "Night" },
  { id: "focus", label: "Deep focus" },
  { id: "break", label: "Cozy" },
];

export default function Settings() {
  const { user } = useAuth();
  const { settings, update } = useSettings();

  const [name, setName] = useState(user?.displayName ?? "");
  const [nameSaved, setNameSaved] = useState(false);
  const [goal, setGoal] = useState(String(settings.dailyGoalMinutes));
  const [goalSaved, setGoalSaved] = useState(false);

  async function saveName() {
    if (!user || !name.trim()) return;
    await updateProfile(user, { displayName: name.trim() });
    setNameSaved(true);
  }

  function saveGoal(minutes: number) {
    const clean = Math.min(1440, Math.max(10, Math.round(minutes) || 120));
    update({ dailyGoalMinutes: clean });
    setGoal(String(clean));
    setGoalSaved(true);
  }

  return (
    <>
      <h1 className="page-title">Settings ⚙️</h1>

      <div className="settings-grid">
        <section className="card settings-section">
          <h3>Profile</h3>
          <p className="muted settings-email">{user?.email}</p>
          <div className="settings-row">
            <input
              placeholder="Your name"
              value={name}
              onChange={(e) => {
                setName(e.target.value);
                setNameSaved(false);
              }}
            />
            <button className="btn" onClick={saveName}>
              Save name
            </button>
            {nameSaved && <span className="saved-note">Saved ✓</span>}
          </div>
        </section>

        <section className="card settings-section">
          <h3>Daily focus goal</h3>
          <div className="settings-row">
            {GOAL_PRESETS.map((m) => (
              <button
                key={m}
                type="button"
                className={`chip ${settings.dailyGoalMinutes === m ? "selected" : ""}`}
                onClick={() => saveGoal(m)}
              >
                {m / 60}h
              </button>
            ))}
          </div>
          <div className="settings-row goal-row">
            <input
              className="minutes-input"
              type="number"
              min={10}
              value={goal}
              onChange={(e) => {
                setGoal(e.target.value);
                setGoalSaved(false);
              }}
            />
            <span className="muted">minutes per day</span>
            <button className="btn secondary small" onClick={() => saveGoal(Number(goal))}>
              Save
            </button>
            {goalSaved && <span className="saved-note">Saved ✓</span>}
          </div>
        </section>

        <section className="card settings-section">
          <h3>Theme</h3>
          <div className="settings-row">
            {THEMES.map((t) => (
              <button
                key={t.id}
                type="button"
                className={`chip ${settings.theme === t.id ? "selected" : ""}`}
                onClick={() => update({ theme: t.id })}
              >
                {t.label}
              </button>
            ))}
          </div>
        </section>

        <section className="card settings-section">
          <h3>Background</h3>
          <p className="muted settings-hint">
            Automatic changes with the time of day, during focus sessions, and on breaks.
            Picking a scene keeps it fixed.
          </p>
          <div className="bg-tiles">
            {BACKGROUNDS.map((b) => (
              <button
                key={b.id}
                type="button"
                className={`bg-tile ${settings.background === b.id ? "selected" : ""}`}
                onClick={() => update({ background: b.id })}
              >
                <span className={`bg-swatch ${b.id === "auto" ? "bg-auto" : `bg-${b.id}`}`} />
                <span>{b.label}</span>
              </button>
            ))}
          </div>
        </section>

        <InstallCard />

        <section className="card settings-section">
          <h3>Account</h3>
          <button className="btn secondary" onClick={() => logout()}>
            Log out
          </button>
        </section>
      </div>
    </>
  );
}
