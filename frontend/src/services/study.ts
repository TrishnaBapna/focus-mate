import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  updateDoc,
  writeBatch,
} from "firebase/firestore";
import { db } from "./firebase";
import type { Deck, NewCard, StudyCard } from "../types/study";

const decksRef = (uid: string) => collection(db, "users", uid, "decks");
const cardsRef = (uid: string) => collection(db, "users", uid, "cards");

export function addDeck(uid: string, data: Omit<Deck, "id" | "createdAt">) {
  return addDoc(decksRef(uid), { ...data, createdAt: serverTimestamp() });
}

// Removes the deck and all of its cards
export async function deleteDeck(uid: string, deckId: string, cardIds: string[]) {
  for (let i = 0; i < cardIds.length; i += 400) {
    const batch = writeBatch(db);
    cardIds.slice(i, i + 400).forEach((id) => batch.delete(doc(db, "users", uid, "cards", id)));
    await batch.commit();
  }
  await deleteDoc(doc(db, "users", uid, "decks", deckId));
}

export async function addCards(uid: string, deckId: string, cards: NewCard[], today: string) {
  for (let i = 0; i < cards.length; i += 400) {
    const batch = writeBatch(db);
    cards.slice(i, i + 400).forEach((c) => {
      batch.set(doc(cardsRef(uid)), {
        deckId,
        front: c.front,
        back: c.back,
        box: 0,
        due: today,
        reps: 0,
        createdAt: serverTimestamp(),
      });
    });
    await batch.commit();
  }
}

export function updateCardText(uid: string, id: string, front: string, back: string) {
  return updateDoc(doc(db, "users", uid, "cards", id), { front, back });
}

export function recordReview(uid: string, id: string, box: number, due: string, reps: number) {
  return updateDoc(doc(db, "users", uid, "cards", id), { box, due, reps });
}

export function deleteCard(uid: string, id: string) {
  return deleteDoc(doc(db, "users", uid, "cards", id));
}

export function listenToDecks(
  uid: string,
  callback: (decks: Deck[]) => void,
  onError?: (err: unknown) => void
) {
  const q = query(decksRef(uid), orderBy("createdAt"));
  return onSnapshot(
    q,
    (snap) => {
      callback(snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<Deck, "id">) })));
    },
    (err) => {
      console.error("Loading decks failed", err);
      onError?.(err);
    }
  );
}

export function listenToCards(
  uid: string,
  callback: (cards: StudyCard[]) => void,
  onError?: (err: unknown) => void
) {
  return onSnapshot(
    cardsRef(uid),
    (snap) => {
      const cards = snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<StudyCard, "id">) }));
      // Oldest first (a card that was just added has no timestamp yet, so it goes last)
      cards.sort(
        (a, b) =>
          (a.createdAt?.toMillis() ?? Number.MAX_SAFE_INTEGER) -
          (b.createdAt?.toMillis() ?? Number.MAX_SAFE_INTEGER)
      );
      callback(cards);
    },
    (err) => {
      console.error("Loading cards failed", err);
      onError?.(err);
    }
  );
}
