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
} from "firebase/firestore";
import { db } from "./firebase";
import type { Note } from "../types";

export type NoteInput = Omit<Note, "id" | "createdAt" | "updatedAt">;

const notesRef = (uid: string) => collection(db, "users", uid, "notes");

export function addNote(uid: string, data: NoteInput) {
  return addDoc(notesRef(uid), {
    ...data,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
}

export function updateNote(uid: string, id: string, data: NoteInput) {
  return updateDoc(doc(db, "users", uid, "notes", id), {
    ...data,
    updatedAt: serverTimestamp(),
  });
}

export function deleteNote(uid: string, id: string) {
  return deleteDoc(doc(db, "users", uid, "notes", id));
}

export function listenToNotes(uid: string, callback: (notes: Note[]) => void) {
  const q = query(notesRef(uid), orderBy("updatedAt", "desc"));
  return onSnapshot(q, (snap) => {
    callback(
      snap.docs.map((d) => ({
        id: d.id,
        ...(d.data() as Omit<Note, "id">),
      }))
    );
  });
}
