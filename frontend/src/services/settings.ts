import { doc, onSnapshot, setDoc } from "firebase/firestore";
import { db } from "./firebase";
import type { Settings } from "../types/settings";

const settingsDoc = (uid: string) => doc(db, "users", uid, "settings", "preferences");

export function listenToSettings(
  uid: string,
  callback: (settings: Partial<Settings> | undefined) => void
) {
  return onSnapshot(settingsDoc(uid), (snap) => {
    callback(snap.exists() ? (snap.data() as Partial<Settings>) : undefined);
  });
}

export function saveSettings(uid: string, patch: Partial<Settings>) {
  return setDoc(settingsDoc(uid), patch, { merge: true });
}
