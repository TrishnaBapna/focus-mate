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
import { deleteMedia, extractAssociatedMediaIds } from "./media";
import type { Note } from "../types";

export type NoteInput = Omit<Note, "id" | "createdAt" | "updatedAt">;

const notesRef = (uid: string) => collection(db, "users", uid, "notes");

function cleanPayload<T extends Record<string, any>>(obj: T): Partial<T> {
  const clean: Record<string, any> = {};
  for (const [k, v] of Object.entries(obj)) {
    if (v !== undefined) {
      clean[k] = v;
    }
  }
  return clean as Partial<T>;
}

export function addNote(uid: string, data: NoteInput) {
  return addDoc(notesRef(uid), {
    ...cleanPayload(data),
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
}

export function updateNote(uid: string, id: string, data: NoteInput) {
  return updateDoc(doc(db, "users", uid, "notes", id), {
    ...cleanPayload(data),
    updatedAt: serverTimestamp(),
  });
}

export function deleteNote(uid: string, id: string) {
  return deleteDoc(doc(db, "users", uid, "notes", id));
}

export async function deleteNoteWithMedia(uid: string, note: Note): Promise<void> {
  await deleteNote(uid, note.id);
  const mediaIds = extractAssociatedMediaIds(note);
  await Promise.all(mediaIds.map((mid) => deleteMedia(uid, mid).catch(() => {})));
}

export function listenToNotes(uid: string, callback: (notes: Note[]) => void) {
  const q = query(notesRef(uid), orderBy("updatedAt", "desc"));
  return onSnapshot(
    q,
    (snap) => {
      callback(
        snap.docs.map((d) => ({
          id: d.id,
          ...(d.data() as Omit<Note, "id">),
        }))
      );
    },
    (err) => {
      console.warn("listenToNotes error:", err);
    }
  );
}
