import {
  collection,
  deleteDoc,
  doc,
  documentId,
  getDoc,
  onSnapshot,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
  writeBatch,
} from "firebase/firestore";
import { db } from "./firebase";
import type { Friendship, Profile } from "../types";

export const MAX_FRIENDS = 20;
const NICK_RE = /^[a-zA-Z0-9_]{3,20}$/;
export const isValidNickname = (n: string) => NICK_RE.test(n);

export async function saveNickname(uid: string, nickname: string, oldLower?: string) {
  const lower = nickname.toLowerCase();
  const existing = await getDoc(doc(db, "nicknames", lower));
  if (existing.exists() && existing.data().uid !== uid) throw new Error("nickname-taken");

  const batch = writeBatch(db);
  if (oldLower && oldLower !== lower) batch.delete(doc(db, "nicknames", oldLower));
  batch.set(doc(db, "nicknames", lower), { uid });
  batch.set(doc(db, "profiles", uid), { nickname, nicknameLower: lower }, { merge: true });
  await batch.commit();
}

export function updateWeekTotal(uid: string, weekKey: string, weekSeconds: number) {
  return updateDoc(doc(db, "profiles", uid), {
    weekKey,
    weekSeconds,
    updatedAt: serverTimestamp(),
  });
}

export function listenToMyProfile(uid: string, cb: (p: Profile | null) => void) {
  return onSnapshot(
    doc(db, "profiles", uid),
    (snap) => {
      cb(snap.exists() ? { id: snap.id, ...(snap.data() as Omit<Profile, "id">) } : null);
    },
    (err) => {
      console.warn("listenToMyProfile error:", err);
      cb(null);
    }
  );
}

export function listenToProfiles(uids: string[], cb: (p: Profile[]) => void) {
  if (uids.length === 0) {
    cb([]);
    return () => {};
  }
  const q = query(collection(db, "profiles"), where(documentId(), "in", uids));
  return onSnapshot(
    q,
    (snap) => {
      cb(snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<Profile, "id">) })));
    },
    (err) => {
      console.warn("listenToProfiles error:", err);
      cb([]);
    }
  );
}

export function listenToFriendships(uid: string, cb: (f: Friendship[]) => void) {
  const q = query(collection(db, "friendRequests"), where("members", "array-contains", uid));
  return onSnapshot(
    q,
    (snap) => {
      cb(snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<Friendship, "id">) })));
    },
    (err) => {
      console.warn("listenToFriendships error:", err);
      cb([]);
    }
  );
}

export async function sendRequest(
  me: { uid: string; nickname: string },
  targetNickname: string,
  existingUids: string[]
) {
  const nickSnap = await getDoc(doc(db, "nicknames", targetNickname.toLowerCase()));
  if (!nickSnap.exists()) throw new Error("not-found");

  const to = nickSnap.data().uid as string;
  if (to === me.uid) throw new Error("self");
  if (existingUids.includes(to)) throw new Error("exists");

  const profSnap = await getDoc(doc(db, "profiles", to));
  const toNickname = (profSnap.data()?.nickname as string) ?? targetNickname;

  const id = [me.uid, to].sort().join("_");
  await setDoc(doc(db, "friendRequests", id), {
    from: me.uid,
    to,
    fromNickname: me.nickname,
    toNickname,
    members: [me.uid, to],
    status: "pending",
    createdAt: serverTimestamp(),
  });
}

export function acceptRequest(id: string) {
  return updateDoc(doc(db, "friendRequests", id), { status: "accepted" });
}

// Used to decline, cancel, or remove a friend
export function removeFriendship(id: string) {
  return deleteDoc(doc(db, "friendRequests", id));
}
