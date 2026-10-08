import { useEffect, useState } from "react";
import { useAuth } from "./useAuth";
import { loadMedia } from "../services/media";

// Loads a saved file from the media area and gives back a playable/showable URL.
export function useMediaUrl(mediaId: string | undefined) {
  const { user } = useAuth();
  const [url, setUrl] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    if (!user || !mediaId) return;
    let cancelled = false;
    let objectUrl: string | null = null;

    loadMedia(user.uid, mediaId)
      .then((blob) => {
        if (cancelled) return;
        if (!blob) {
          setFailed(true);
          return;
        }
        objectUrl = URL.createObjectURL(blob);
        setUrl(objectUrl);
      })
      .catch(() => {
        if (!cancelled) setFailed(true);
      });

    return () => {
      cancelled = true;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [user, mediaId]);

  return { url, failed };
}
