import { useEffect, useState } from "react";
import { useAuth } from "./useAuth";
import { listenToCards } from "../services/study";
import { describeError } from "../utils/errors";
import type { StudyCard } from "../types/study";

export function useCards() {
  const { user } = useAuth();
  const [cards, setCards] = useState<StudyCard[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!user) return;
    return listenToCards(
      user.uid,
      (list) => {
        setCards(list);
        setError("");
        setLoading(false);
      },
      (err) => {
        setError(describeError(err));
        setLoading(false);
      }
    );
  }, [user]);

  return { cards, loading, error };
}
