import { useEffect, useState } from "react";
import { useAuth } from "./useAuth";
import { listenToCards } from "../services/study";
import type { StudyCard } from "../types/study";

export function useCards() {
  const { user } = useAuth();
  const [cards, setCards] = useState<StudyCard[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;
    return listenToCards(user.uid, (list) => {
      setCards(list);
      setLoading(false);
    });
  }, [user]);

  return { cards, loading };
}
