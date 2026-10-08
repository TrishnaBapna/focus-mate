import { Bytes, addDoc, collection, deleteDoc, doc, getDoc, serverTimestamp } from "firebase/firestore";
import { db } from "./firebase";

// A Firestore document can hold about 1 MB, so each file has to stay under this.
export const MAX_MEDIA_BYTES = 900000;

const mediaRef = (uid: string) => collection(db, "users", uid, "media");

// All audio and photos go through these three functions. If you ever move to
// Firebase Storage, this is the only file that needs to change.
export async function saveMedia(uid: string, blob: Blob): Promise<string> {
  if (blob.size > MAX_MEDIA_BYTES) throw new Error("too-big");
  const bytes = Bytes.fromUint8Array(new Uint8Array(await blob.arrayBuffer()));
  const ref = await addDoc(mediaRef(uid), {
    mime: blob.type,
    size: blob.size,
    data: bytes,
    createdAt: serverTimestamp(),
  });
  return ref.id;
}

export async function loadMedia(uid: string, id: string): Promise<Blob | null> {
  const snap = await getDoc(doc(db, "users", uid, "media", id));
  if (!snap.exists()) return null;
  const data = snap.data();
  const bytes = (data.data as Bytes).toUint8Array();
  return new Blob([new Uint8Array(bytes)], { type: data.mime as string });
}

export function deleteMedia(uid: string, id: string) {
  return deleteDoc(doc(db, "users", uid, "media", id));
}
