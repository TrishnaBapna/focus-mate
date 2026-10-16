import { useEffect, useState } from "react";
import { useAuth } from "./useAuth";
import { getMediaUrl } from "../services/media";

// Loads a saved file from Firebase Storage or legacy media area and gives back a playable/showable URL.
export function useMediaUrl(mediaId: string | undefined) {
  const { user } = useAuth();
  const [loaded, setLoaded] = useState<{ id?: string; url: string | null; failed: boolean }>({
    id: undefined,
    url: null,
    failed: false,
  });

  const loading = !!(user && mediaId && loaded.id !== mediaId);
  const url = loaded.id === mediaId ? loaded.url : null;
  const failed = loaded.id === mediaId ? loaded.failed : false;

  useEffect(() => {
    if (!user || !mediaId) return;
    let cancelled = false;
    let objectUrl: string | null = null;

    getMediaUrl(user.uid, mediaId)
      .then((resUrl) => {
        if (cancelled) return;
        if (!resUrl) {
          setLoaded({ id: mediaId, url: null, failed: true });
          return;
        }
        if (resUrl.startsWith("blob:")) {
          objectUrl = resUrl;
        }
        setLoaded({ id: mediaId, url: resUrl, failed: false });
      })
      .catch((err) => {
        if (cancelled) return;
        console.warn("useMediaUrl error:", err);
        setLoaded({ id: mediaId, url: null, failed: true });
      });

    return () => {
      cancelled = true;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [user, mediaId]);

  return { url, loading, failed };
}
