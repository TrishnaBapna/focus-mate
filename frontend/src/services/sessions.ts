import {
  addDoc,
  collection,
  limit,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
} from "firebase/firestore";
import { db } from "./firebase";
import type { FocusSession } from "../types";

const sessionsRef = (uid: string) => collection(db, "users", uid, "sessions");

export function addSession(uid: string, data: Omit<FocusSession, "id">) {
  return addDoc(sessionsRef(uid), { ...data, completedAt: serverTimestamp() });
}

export function listenToSessions(
  uid: string,
  count: number,
  callback: (sessions: FocusSession[]) => void
) {
  const q = query(sessionsRef(uid), orderBy("completedAt", "desc"), limit(count));
  return onSnapshot(q, (snap) => {
    callback(
      snap.docs.map((d) => ({
        id: d.id,
        ...(d.data() as Omit<FocusSession, "id">),
      }))
    );
  });
}
