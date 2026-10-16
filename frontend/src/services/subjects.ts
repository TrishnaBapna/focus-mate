import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
} from "firebase/firestore";
import { db } from "./firebase";
import type { Subject } from "../types";

const subjectsRef = (uid: string) => collection(db, "users", uid, "subjects");

export function addSubject(uid: string, data: Omit<Subject, "id">) {
  return addDoc(subjectsRef(uid), { ...data, createdAt: serverTimestamp() });
}

export async function deleteSubject(uid: string, id: string) {
  // Delete subject document
  await deleteDoc(doc(db, "users", uid, "subjects", id));

  // Clean up any associated study goal
  try {
    await deleteDoc(doc(db, "users", uid, "subjectGoals", id));
  } catch (err) {
    console.warn("Failed to delete associated subject goal:", err);
  }
}

export function listenToSubjects(
  uid: string,
  callback: (subjects: Subject[]) => void
) {
  const q = query(subjectsRef(uid), orderBy("createdAt"));
  return onSnapshot(
    q,
    (snap) => {
      callback(
        snap.docs.map((d) => ({
          id: d.id,
          ...(d.data() as Omit<Subject, "id">),
        }))
      );
    },
    (err) => {
      console.warn("listenToSubjects error:", err);
    }
  );
}
