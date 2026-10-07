import { useEffect, useState } from "react";
import { useAuth } from "./useAuth";
import { listenToNotes } from "../services/notes";
import type { Note } from "../types";

export function useNotes() {
  const { user } = useAuth();
  const [notes, setNotes] = useState<Note[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;
    return listenToNotes(user.uid, (list) => {
      setNotes(list);
      setLoading(false);
    });
  }, [user]);

  return { notes, loading };
}
