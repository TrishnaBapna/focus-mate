import { useEffect, useMemo, useState, type ReactNode } from "react";
import { MusicContext, type MusicTab } from "./MusicContext";
import { AmbientEngine, type AmbientKind } from "../utils/ambient";
import { cleanSpotifyLink, parseSpotify } from "../utils/spotify";

const STORE = "focusmate-music";

// Remembered on this device only: volume and the Spotify link
function readStore(): { volume: number; spotifyUrl: string } {
  try {
    const raw = localStorage.getItem(STORE);
    if (raw) {
      const saved = JSON.parse(raw);
      return {
        volume: typeof saved.volume === "number" ? saved.volume : 0.5,
        spotifyUrl: typeof saved.spotifyUrl === "string" ? saved.spotifyUrl : "",
      };
    }
  } catch {
    // ignore
  }
  return { volume: 0.5, spotifyUrl: "" };
}

function writeStore(volume: number, spotifyUrl: string) {
  try {
    localStorage.setItem(STORE, JSON.stringify({ volume, spotifyUrl }));
  } catch {
    // ignore
  }
}

export default function MusicProvider({ children }: { children: ReactNode }) {
  const [engine] = useState(() => new AmbientEngine());
  const [initial] = useState(readStore);

  const [ambient, setAmbient] = useState<AmbientKind | null>(null);
  const [volume, setVolumeState] = useState(initial.volume);
  const [spotifyUrl, setSpotifyUrl] = useState(initial.spotifyUrl);
  const [panelOpen, setPanelOpen] = useState(false);
  const [tab, setTab] = useState<MusicTab>("ambient");

  const spotify = useMemo(() => (spotifyUrl ? parseSpotify(spotifyUrl) : null), [spotifyUrl]);

  useEffect(() => {
    engine.setVolume(initial.volume);
    return () => engine.dispose();
  }, [engine, initial.volume]);

  function toggleAmbient(kind: AmbientKind) {
    if (ambient === kind) {
      engine.stop();
      setAmbient(null);
    } else {
      engine.start(kind);
      setAmbient(kind);
    }
  }

  function stopAmbient() {
    engine.stop();
    setAmbient(null);
  }

  function setVolume(value: number) {
    setVolumeState(value);
    engine.setVolume(value);
    writeStore(value, spotifyUrl);
  }

  function loadSpotify(input: string) {
    const parsed = parseSpotify(input);
    if (!parsed) return false;
    const clean = cleanSpotifyLink(parsed);
    setSpotifyUrl(clean);
    writeStore(volume, clean);
    return true;
  }

  function clearSpotify() {
    setSpotifyUrl("");
    writeStore(volume, "");
  }

  return (
    <MusicContext.Provider
      value={{
        ambient,
        volume,
        spotify,
        panelOpen,
        tab,
        setTab,
        togglePanel: () => setPanelOpen((open) => !open),
        toggleAmbient,
        stopAmbient,
        setVolume,
        loadSpotify,
        clearSpotify,
      }}
    >
      {children}
    </MusicContext.Provider>
  );
}
