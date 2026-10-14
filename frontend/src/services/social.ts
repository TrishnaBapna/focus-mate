import {
  collection,
  deleteDoc,
  doc,
  getCountFromServer,
  getDoc,
  getDocs,
  limit,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  where,
} from "firebase/firestore";
import { db } from "./firebase";
import type { BoardEntry, GroupInfo, SocialSettings } from "../types/social";

// ---------- What the person chose to share (private, in their own account) ----------
const settingsDoc = (uid: string) => doc(db, "users", uid, "settings", "social");

export function listenToSocial(uid: string, callback: (s: SocialSettings | null) => void) {
  return onSnapshot(settingsDoc(uid), (snap) => {
    if (!snap.exists()) return callback(null);
    const d = snap.data() as Partial<SocialSettings>;
    callback({
      nickname: d.nickname ?? "",
      emoji: d.emoji ?? "🌟",
      globalOn: !!d.globalOn,
      groupCodes: d.groupCodes ?? [],
    });
  });
}

export function saveSocial(uid: string, patch: Partial<SocialSettings>) {
  return setDoc(settingsDoc(uid), patch, { merge: true });
}

export function clearSocial(uid: string) {
  return deleteDoc(settingsDoc(uid));
}

// ---------- The global weekly board ----------
const entriesRef = (week: string) => collection(db, "leaderboards", week, "entries");
const entryRef = (week: string, uid: string) => doc(db, "leaderboards", week, "entries", uid);

type Stats = { nickname: string; emoji: string; level: number; weekSeconds: number };

export function publishEntry(week: string, uid: string, stats: Stats) {
  return setDoc(entryRef(week, uid), { ...stats, updatedAt: serverTimestamp() });
}

export async function removeEntries(uid: string, weeks: string[]) {
  await Promise.all(weeks.map((w) => deleteDoc(entryRef(w, uid)).catch(() => {})));
}

export async function fetchTop(week: string, count = 50): Promise<BoardEntry[]> {
  const snap = await getDocs(query(entriesRef(week), orderBy("weekSeconds", "desc"), limit(count)));
  return snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<BoardEntry, "id">) }));
}

// Your place on the board: how many people have more than you, plus one
export async function fetchRank(week: string, mine: number) {
  const snap = await getCountFromServer(query(entriesRef(week), where("weekSeconds", ">", mine)));
  return snap.data().count + 1;
}

// ---------- Groups ----------
const groupRef = (code: string) => doc(db, "groups", code);
const membersRef = (code: string) => collection(db, "groups", code, "members");
const memberRef = (code: string, uid: string) => doc(db, "groups", code, "members", uid);

export async function createGroupDoc(code: string, name: string, ownerUid: string) {
  await setDoc(groupRef(code), { name, ownerUid, createdAt: serverTimestamp() });
}

export async function fetchGroup(code: string): Promise<GroupInfo | null> {
  const snap = await getDoc(groupRef(code));
  if (!snap.exists()) return null;
  const d = snap.data() as { name?: string; ownerUid?: string };
  return { code, name: d.name ?? "Group", ownerUid: d.ownerUid ?? "" };
}

export function publishMember(code: string, uid: string, stats: Stats & { weekKey: string }) {
  return setDoc(memberRef(code, uid), { ...stats, updatedAt: serverTimestamp() });
}

export function removeMember(code: string, uid: string) {
  return deleteDoc(memberRef(code, uid));
}

export async function fetchMembers(code: string): Promise<BoardEntry[]> {
  const snap = await getDocs(membersRef(code));
  return snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<BoardEntry, "id">) }));
}

// Removes every member, then the group itself (only the owner can do this)
export async function deleteGroup(code: string) {
  const snap = await getDocs(membersRef(code));
  await Promise.all(snap.docs.map((d) => deleteDoc(d.ref)));
  await deleteDoc(groupRef(code));
}
