import type { Timestamp } from "firebase/firestore";

export interface Deck {
  id: string;
  name: string;
  subjectId: string;
  subjectName: string;
  subjectEmoji: string;
  createdAt?: Timestamp | null;
}

export interface StudyCard {
  id: string;
  deckId: string;
  front: string;
  back: string;
  box: number; // 0 = new, 1 = just learned or forgotten, 5 = well known
  due: string; // "YYYY-MM-DD": the day it should be reviewed
  reps: number; // how many times it has been reviewed
  createdAt?: Timestamp | null;
}

export interface NewCard {
  front: string;
  back: string;
}
