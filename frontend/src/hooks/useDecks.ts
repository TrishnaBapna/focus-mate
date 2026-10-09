import { useEffect, useState } from "react";
import { useAuth } from "./useAuth";
import { listenToDecks } from "../services/study";
import type { Deck } from "../types/study";

export function useDecks() {
  const { user } = useAuth();
  const [decks, setDecks] = useState<Deck[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;
    return listenToDecks(user.uid, (list) => {
      setDecks(list);
      setLoading(false);
    });
  }, [user]);

  return { decks, loading };
}
