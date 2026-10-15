import { useEffect, useState } from "react";
import { useFocus } from "../hooks/useFocus";
import { useSettings } from "../hooks/useSettings";
import { formatDuration } from "../utils/time";

// Plays gentle two-tone distraction alert using Web Audio API (no external mp3 needed)
export function playDistractionBeep() {
  try {
    const ctx = new (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = "sine";
    osc.frequency.setValueAtTime(440, ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(880, ctx.currentTime + 0.15);
    gain.gain.setValueAtTime(0.2, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.3);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + 0.3);
  } catch {
    // audio not allowed before user interaction
  }
}

// Covers the whole app when someone leaves a strict session, until they come back
export default function StrictOverlay() {
  const { needsFullscreen, returnToFullscreen, awayNotice, dismissAwayNotice } = useFocus();
  const { settings } = useSettings();
  const [wait, setWait] = useState(3);
  const showAway = awayNotice !== null;
  const blockedList = settings.blockList ?? [];

  // A short pause before "I'm back" works, and plays warning beep
  useEffect(() => {
    if (!showAway) return;
    playDistractionBeep();
    setWait(3);
    const id = window.setInterval(() => setWait((w) => Math.max(0, w - 1)), 1000);
    return () => window.clearInterval(id);
  }, [showAway, awayNotice]);

  if (needsFullscreen) {
    return (
      <div className="strict-overlay">
        <div className="card shield-overlay-card">
          <div className="overlay-emoji">🛡️</div>
          <h2>Full Screen Shield Required</h2>
          <p>
            You left full screen mode! Focus Shield is active to keep you away from distractions.
          </p>
          <button className="btn" onClick={returnToFullscreen}>
            Back to Full Screen
          </button>
        </div>
      </div>
    );
  }

  if (showAway) {
    const blockedNames = blockedList.slice(0, 4).join(", ");
    return (
      <div className="strict-overlay">
        <div className="card shield-overlay-card">
          <div className="overlay-emoji">🥀</div>
          <h2>Distraction Shield Engaged!</h2>
          <p>
            You were away for <strong>{formatDuration(awayNotice ?? 0)}</strong>.
            {blockedNames && (
              <span style={{ display: "block", margin: "8px 0", color: "var(--accent)", fontWeight: 700 }}>
                🚫 Distraction Block Active ({blockedNames}{blockedList.length > 4 ? "..." : ""})
              </span>
            )}
            {" "}Your plant wilted, but your timer is still running. Return to FocusMate now!
          </p>
          <button className="btn" disabled={wait > 0} onClick={dismissAwayNotice}>
            {wait > 0 ? `I'm back (${wait})` : "I'm back to study"}
          </button>
        </div>
      </div>
    );
  }

  return null;
}
