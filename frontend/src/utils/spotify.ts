export interface SpotifyEmbed {
  type: string;
  id: string;
  src: string; // the address of Spotify's own player for this link
}

const TYPES = ["playlist", "album", "track", "episode", "show", "artist"];

// Accepts a Spotify share link (or a spotify: code) and returns what we need to show its player.
export function parseSpotify(input: string): SpotifyEmbed | null {
  const text = input.trim();
  let type: string;
  let id: string;

  const uri = text.match(/^spotify:(\w+):([A-Za-z0-9]+)$/);
  if (uri) {
    type = uri[1];
    id = uri[2];
  } else {
    try {
      const url = new URL(text);
      if (!/(^|\.)spotify\.com$/.test(url.hostname)) return null;
      // Links can look like /playlist/ID, /intl-in/playlist/ID, or /embed/playlist/ID
      const parts = url.pathname.split("/").filter(Boolean);
      const at = parts.findIndex((p) => TYPES.includes(p));
      if (at === -1 || !parts[at + 1]) return null;
      type = parts[at];
      id = parts[at + 1];
    } catch {
      return null;
    }
  }

  if (!TYPES.includes(type) || !/^[A-Za-z0-9]+$/.test(id)) return null;
  return {
    type,
    id,
    src: `https://open.spotify.com/embed/${type}/${id}?utm_source=generator`,
  };
}

// A short, clean version of the link, which is what gets remembered
export function cleanSpotifyLink(embed: SpotifyEmbed) {
  return `https://open.spotify.com/${embed.type}/${embed.id}`;
}
