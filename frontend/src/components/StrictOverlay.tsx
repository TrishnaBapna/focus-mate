import { useEffect, useState } from "react";
import { useFocus } from "../hooks/useFocus";
import { useSettings } from "../hooks/useSettings";
import { playDistractionBeep } from "../utils/chime";
import { formatDuration } from "../utils/time";

function AwayDialog({
  awayNotice,
  blockedList,
  onDismiss,
}: {
  awayNotice: number;
  blockedList: string[];
  onDismiss: () => void;
}) {
  const [wait, setWait] = useState(3);

  useEffect(() => {
    playDistractionBeep();
    const id = window.setInterval(() => setWait((w) => Math.max(0, w - 1)), 1000);
    return () => window.clearInterval(id);
  }, []);

  const blockedNames = blockedList.slice(0, 4).join(", ");
  return (
    <div className="strict-overlay">
      <div className="card shield-overlay-card">
        <div className="overlay-emoji">🥀</div>
        <h2>Distraction Shield Engaged!</h2>
        <p>
          You were away for <strong>{formatDuration(awayNotice)}</strong>.
          {blockedNames && (
            <span style={{ display: "block", margin: "8px 0", color: "var(--accent)", fontWeight: 700 }}>
              🚫 Distraction Block Active ({blockedNames}{blockedList.length > 4 ? "..." : ""})
            </span>
          )}
          {" "}Your plant wilted, but your timer is still running. Return to FocusMate now!
        </p>
        <button className="btn" disabled={wait > 0} onClick={onDismiss}>
          {wait > 0 ? `I'm back (${wait})` : "I'm back to study"}
        </button>
      </div>
    </div>
  );
}

// Covers the whole app when someone leaves a strict session, until they come back
export default function StrictOverlay() {
  const { needsFullscreen, returnToFullscreen, awayNotice, dismissAwayNotice } = useFocus();
  const { settings } = useSettings();
  const blockedList = settings.blockList ?? [];

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

  if (awayNotice !== null) {
    return (
      <AwayDialog
        key={awayNotice}
        awayNotice={awayNotice}
        blockedList={blockedList}
        onDismiss={dismissAwayNotice}
      />
    );
  }

  return null;
}
