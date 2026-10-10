import { useEffect, useState } from "react";
import { useFocus } from "../hooks/useFocus";
import { formatDuration } from "../utils/time";

// Covers the whole app when someone leaves a strict session, until they come back
export default function StrictOverlay() {
  const { needsFullscreen, returnToFullscreen, awayNotice, dismissAwayNotice } = useFocus();
  const [wait, setWait] = useState(3);
  const showAway = awayNotice !== null;

  // A short pause before "I'm back" works, so leaving isn't free
  useEffect(() => {
    if (!showAway) return;
    setWait(3);
    const id = window.setInterval(() => setWait((w) => Math.max(0, w - 1)), 1000);
    return () => window.clearInterval(id);
  }, [showAway, awayNotice]);

  if (needsFullscreen) {
    return (
      <div className="strict-overlay">
        <div className="card">
          <div className="overlay-emoji">🥀</div>
          <h2>You left full screen!</h2>
          <p>Your plant is wilting. Hop back in to keep going.</p>
          <button className="btn" onClick={returnToFullscreen}>
            Back to full screen
          </button>
        </div>
      </div>
    );
  }

  if (showAway) {
    return (
      <div className="strict-overlay">
        <div className="card">
          <div className="overlay-emoji">🥀</div>
          <h2>Welcome back!</h2>
          <p>
            You were away for {formatDuration(awayNotice ?? 0)}. Your plant wilted, but the timer is
            still running. Let's get back to it.
          </p>
          <button className="btn" disabled={wait > 0} onClick={dismissAwayNotice}>
            {wait > 0 ? `I'm back (${wait})` : "I'm back"}
          </button>
        </div>
      </div>
    );
  }

  return null;
}
