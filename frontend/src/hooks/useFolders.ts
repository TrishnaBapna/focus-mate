import { useEffect, useState } from "react";
import { useAuth } from "./useAuth";
import { listenToFolders } from "../services/folders";
import type { NoteFolder } from "../types";

export function useFolders() {
  const { user } = useAuth();
  const [folders, setFolders] = useState<NoteFolder[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;
    return listenToFolders(user.uid, (list) => {
      setFolders(list);
      setLoading(false);
    });
  }, [user]);

  return { folders, loading: user ? loading : false };
}
