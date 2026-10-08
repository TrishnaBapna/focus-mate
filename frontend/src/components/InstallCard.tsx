import { useSyncExternalStore } from "react";
import {
  canInstallNow,
  isIos,
  isStandalone,
  promptInstall,
  subscribeInstall,
} from "../utils/install";

export default function InstallCard() {
  const canInstall = useSyncExternalStore(subscribeInstall, canInstallNow);

  return (
    <section className="card settings-section">
      <h3>Install Focus Mate</h3>

      {isStandalone() ? (
        <p className="muted">✅ You're using the installed app.</p>
      ) : canInstall ? (
        <>
          <p className="muted settings-hint">
            Add Focus Mate to your home screen or desktop and open it like any other app.
          </p>
          <button className="btn" onClick={() => void promptInstall()}>
            Install app
          </button>
        </>
      ) : isIos() ? (
        <p className="muted">
          On iPhone or iPad: tap the <strong>Share</strong> button in Safari, then{" "}
          <strong>Add to Home Screen</strong>.
        </p>
      ) : (
        <p className="muted">
          Open the live (https) version of Focus Mate, then use your browser's menu and choose{" "}
          <strong>Install app</strong> or <strong>Add to Home screen</strong>.
        </p>
      )}
    </section>
  );
}
