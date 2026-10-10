import { useRef, useState, type ChangeEvent } from "react";
import { useAuth } from "../hooks/useAuth";
import { useMediaUrl } from "../hooks/useMediaUrl";
import { useSettings } from "../hooks/useSettings";
import { deleteMedia, saveMedia } from "../services/media";
import { prepareImage } from "../utils/image";

// Lets someone use their own photo (from a phone or laptop) as the app background
export default function CustomBackgroundCard() {
  const { user } = useAuth();
  const { settings, update } = useSettings();
  const fileRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const savedId = settings.customBackgroundId ?? "";
  const { url } = useMediaUrl(savedId || undefined);
  const inUse = settings.background === "custom";

  async function handleFile(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file || !user) return;

    setError("");
    setBusy(true);
    try {
      const prepared = await prepareImage(file); // shrinks it so it fits in your free storage
      const id = await saveMedia(user.uid, prepared.blob);
      const oldId = savedId;
      update({ customBackgroundId: id, background: "custom" });
      if (oldId) void deleteMedia(user.uid, oldId);
    } catch (err) {
      console.error("Background upload failed", err);
      setError("Couldn't use that image. Try a different photo.");
    } finally {
      setBusy(false);
    }
  }

  function applyPhoto() {
    update({ background: "custom" });
  }

  function removePhoto() {
    if (!user) return;
    const oldId = savedId;
    update({ customBackgroundId: "", background: "auto" });
    if (oldId) void deleteMedia(user.uid, oldId);
  }

  return (
    <section className="card settings-section">
      <h3>My photo background</h3>
      <p className="muted settings-hint">
        Use any picture from your phone or laptop as the background. It's shrunk automatically and
        kept in your own account, so it follows you to your other devices.
      </p>

      {url && <img className="bg-preview" src={url} alt="Your background" />}

      <input ref={fileRef} type="file" accept="image/*" hidden onChange={handleFile} />
      <div className="settings-row">
        <button className="btn" onClick={() => fileRef.current?.click()} disabled={busy}>
          {busy ? "Saving…" : savedId ? "Change photo" : "Choose a photo"}
        </button>
        {savedId && !inUse && (
          <button className="btn secondary" onClick={applyPhoto}>
            Use my photo
          </button>
        )}
        {savedId && (
          <button className="link-btn danger" onClick={removePhoto}>
            Remove
          </button>
        )}
      </div>
      {error && <p className="auth-error">{error}</p>}
    </section>
  );
}
