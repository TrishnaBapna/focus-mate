import { createContext } from "react";
import type { AmbientKind } from "../utils/ambient";
import type { SpotifyEmbed } from "../utils/spotify";

export type MusicTab = "ambient" | "spotify";

export interface MusicValue {
  ambient: AmbientKind | null; // which ambient sound is playing
  volume: number; // 0 to 1
  spotify: SpotifyEmbed | null;
  panelOpen: boolean;
  tab: MusicTab;
  setTab: (tab: MusicTab) => void;
  togglePanel: () => void;
  toggleAmbient: (kind: AmbientKind) => void;
  stopAmbient: () => void;
  setVolume: (value: number) => void;
  loadSpotify: (input: string) => boolean; // false if it isn't a Spotify link
  clearSpotify: () => void;
}

export const MusicContext = createContext<MusicValue | null>(null);
