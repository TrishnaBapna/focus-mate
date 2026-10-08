import { useMediaUrl } from "../hooks/useMediaUrl";

export default function AudioPlayer({ audioId }: { audioId: string }) {
  const { url, failed } = useMediaUrl(audioId);

  if (failed) return <p className="auth-error">Couldn't load the audio.</p>;
  if (!url) return <p className="muted">Loading audio…</p>;
  return <audio className="audio-el" controls src={url} />;
}
