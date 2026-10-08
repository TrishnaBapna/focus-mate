import { doc, onSnapshot, setDoc } from "firebase/firestore";
import { db } from "./firebase";

export interface UnlockedDoc {
  unlocked: Record<string, string>; // achievement id -> ISO date ("" = earned before tracking began)
}

const achievementsDoc = (uid: string) => doc(db, "users", uid, "settings", "achievements");

// Calls back with null when the document doesn't exist yet.
export function listenToUnlocked(uid: string, callback: (doc: UnlockedDoc | null) => void) {
  return onSnapshot(achievementsDoc(uid), (snap) => {
    callback(
      snap.exists()
        ? { unlocked: (snap.data().unlocked ?? {}) as Record<string, string> }
        : null
    );
  });
}

export function saveUnlocked(uid: string, entries: Record<string, string>) {
  return setDoc(achievementsDoc(uid), { unlocked: entries }, { merge: true });
}
