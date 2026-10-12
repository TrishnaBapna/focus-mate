import { useState, type FormEvent } from "react";
import { useMusic } from "../hooks/useMusic";
import { AMBIENT_SOUNDS } from "../utils/ambient";
import Icon from "./Icon";

// The floating 🎧 button and its music panel. It lives above every page, so music keeps playing.
export default function MusicDock() {
  const m = useMusic();
  const [input, setInput] = useState("");
  const [error, setError] = useState("");
  const [big, setBig] = useState(false);
  const [opened, setOpened] = useState(false);

  // The Spotify player only loads after the Spotify tab is opened once
  if (m.panelOpen && m.tab === "spotify" && !opened) setOpened(true);
  const showSpotify = m.panelOpen && m.tab === "spotify";
  const playing = m.ambient !== null;

  function submit(e: FormEvent) {
    e.preventDefault();
    if (m.loadSpotify(input)) {
      setInput("");
      setError("");
    } else {
      setError(
        "That doesn't look like a Spotify link. In Spotify, open a playlist, album, or song, then choose Share → Copy link."
      );
    }
  }

  return (
    <div className="music-dock">
      <div className={`music-panel ${m.panelOpen ? "open" : ""}`}>
        <div className="music-head">
          <strong>🎧 Focus music</strong>
          <button className="music-x" onClick={m.togglePanel} aria-label="Close music">
            <Icon name="x" size={14} />
          </button>
        </div>

        <div className="music-tabs">
          <button
            className={`chip ${m.tab === "ambient" ? "selected" : ""}`}
            onClick={() => m.setTab("ambient")}
          >
            🌧️ Ambient
          </button>
          <button
            className={`chip ${m.tab === "spotify" ? "selected" : ""}`}
            onClick={() => m.setTab("spotify")}
          >
            🎵 Spotify
          </button>
        </div>

        {m.tab === "ambient" && (
          <div className="music-body">
            <div className="sound-grid">
              {AMBIENT_SOUNDS.map((s) => (
                <button
                  key={s.id}
                  className={`sound-btn ${m.ambient === s.id ? "on" : ""}`}
                  onClick={() => m.toggleAmbient(s.id)}
                >
                  <span className="sound-emoji">{s.emoji}</span>
                  {s.label}
                </button>
              ))}
            </div>

            <label className="vol">
              <span>🔈</span>
              <input
                type="range"
                min={0}
                max={1}
                step={0.05}
                value={m.volume}
                onChange={(e) => m.setVolume(Number(e.target.value))}
                aria-label="Volume"
              />
              <span>🔊</span>
            </label>

            {playing && (
              <button className="link-btn" onClick={m.stopAmbient}>
                Stop sound
              </button>
            )}
            <p className="music-hint">Music keeps playing while you move around the app.</p>
          </div>
        )}

        <div className={`music-body ${showSpotify ? "" : "keep-alive"}`}>
          {m.spotify ? (
            <>
              {opened && (
                <iframe
                  title="Spotify player"
                  src={m.spotify.src}
                  width="100%"
                  height={big ? 352 : 152}
                  style={{ border: 0, borderRadius: 12 }}
                  allow="autoplay; clipboard-write; encrypted-media; fullscreen; picture-in-picture"
                />
              )}
              <div className="music-links">
                <button className="link-btn" onClick={() => setBig(!big)}>
                  {big ? "Smaller player" : "Bigger player"}
                </button>
                <button className="link-btn danger" onClick={m.clearSpotify}>
                  Change link
                </button>
              </div>
              <p className="music-hint">
                Logged-in Spotify users get fuller playback; otherwise you may only hear previews.
              </p>
            </>
          ) : (
            <form onSubmit={submit} className="music-form">
              <p className="music-hint">
                Paste a link to any Spotify playlist, album, or song. In Spotify, choose Share →
                Copy link.
              </p>
              <input
                placeholder="https://open.spotify.com/playlist/…"
                value={input}
                onChange={(e) => setInput(e.target.value)}
              />
              <button className="btn small" type="submit">
                Load player
              </button>
              {error && <p className="auth-error">{error}</p>}
            </form>
          )}
        </div>
      </div>

      <button
        className={`music-fab ${playing ? "playing" : ""}`}
        onClick={m.togglePanel}
        aria-label="Focus music"
        title="Focus music"
      >
        {playing ? (
          <span className="eq" aria-hidden="true">
            <i />
            <i />
            <i />
          </span>
        ) : (
          "🎧"
        )}
      </button>
    </div>
  );
}
