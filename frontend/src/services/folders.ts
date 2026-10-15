import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDocs,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  updateDoc,
  where,
  writeBatch,
} from "firebase/firestore";
import { db } from "./firebase";
import type { NoteFolder } from "../types";

const foldersRef = (uid: string) => collection(db, "users", uid, "folders");

export async function addFolder(uid: string, name: string): Promise<string> {
  const cleanName = name.trim();
  if (!cleanName) throw new Error("Folder name cannot be empty");
  const ref = await addDoc(foldersRef(uid), {
    name: cleanName,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
  return ref.id;
}

export async function renameFolder(uid: string, folderId: string, name: string): Promise<void> {
  const cleanName = name.trim();
  if (!cleanName) throw new Error("Folder name cannot be empty");

  // 1. Update the folder document
  await updateDoc(doc(db, "users", uid, "folders", folderId), {
    name: cleanName,
    updatedAt: serverTimestamp(),
  });

  // 2. Denormalize new folderName onto existing notes in this folder
  try {
    const notesQuery = query(collection(db, "users", uid, "notes"), where("folderId", "==", folderId));
    const snap = await getDocs(notesQuery);
    if (!snap.empty) {
      const batch = writeBatch(db);
      snap.docs.forEach((docSnap) => {
        batch.update(docSnap.ref, {
          folderName: cleanName,
          updatedAt: serverTimestamp(),
        });
      });
      await batch.commit();
    }
  } catch (err) {
    console.warn("Failed to update folderName on notes:", err);
  }
}

export async function deleteFolder(uid: string, folderId: string): Promise<void> {
  // Safe deletion: move all notes in this folder to Unfiled first so no notes are lost
  const notesQuery = query(collection(db, "users", uid, "notes"), where("folderId", "==", folderId));
  const snap = await getDocs(notesQuery);
  if (!snap.empty) {
    const batch = writeBatch(db);
    snap.docs.forEach((docSnap) => {
      batch.update(docSnap.ref, {
        folderId: null,
        folderName: "",
        updatedAt: serverTimestamp(),
      });
    });
    await batch.commit();
  }

  // Delete the folder document
  await deleteDoc(doc(db, "users", uid, "folders", folderId));
}

export function listenToFolders(uid: string, callback: (folders: NoteFolder[]) => void) {
  const q = query(foldersRef(uid), orderBy("name", "asc"));
  return onSnapshot(
    q,
    (snap) => {
      callback(
        snap.docs.map((d) => ({
          id: d.id,
          name: (d.data().name as string) || "Untitled Folder",
          createdAt: d.data().createdAt ?? null,
          updatedAt: d.data().updatedAt ?? null,
        }))
      );
    },
    (err) => {
      console.warn("listenToFolders error:", err);
    }
  );
}

export function moveNoteToFolder(
  uid: string,
  noteId: string,
  folderId: string | null,
  folderName: string = ""
) {
  return updateDoc(doc(db, "users", uid, "notes", noteId), {
    folderId: folderId || null,
    folderName: folderId ? folderName : "",
    updatedAt: serverTimestamp(),
  });
}
