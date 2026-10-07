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

export function deleteSubject(uid: string, id: string) {
  return deleteDoc(doc(db, "users", uid, "subjects", id));
}

export function listenToSubjects(
  uid: string,
  callback: (subjects: Subject[]) => void
) {
  const q = query(subjectsRef(uid), orderBy("createdAt"));
  return onSnapshot(q, (snap) => {
    callback(
      snap.docs.map((d) => ({
        id: d.id,
        ...(d.data() as Omit<Subject, "id">),
      }))
    );
  });
}
