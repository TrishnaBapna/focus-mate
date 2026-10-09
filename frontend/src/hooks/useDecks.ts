import { useEffect, useState } from "react";
import { useAuth } from "./useAuth";
import { listenToDecks } from "../services/study";
import { describeError } from "../utils/errors";
import type { Deck } from "../types/study";

export function useDecks() {
  const { user } = useAuth();
  const [decks, setDecks] = useState<Deck[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!user) return;
    return listenToDecks(
      user.uid,
      (list) => {
        setDecks(list);
        setError("");
        setLoading(false);
      },
      (err) => {
        setError(describeError(err));
        setLoading(false);
      }
    );
  }, [user]);

  return { decks, loading, error };
}
