import {
  Bytes,
  collection,
  deleteDoc,
  deleteField,
  doc,
  getDoc,
  serverTimestamp,
  setDoc,
  updateDoc,
} from "firebase/firestore";
import {
  deleteObject,
  getBlob,
  getDownloadURL,
  ref,
  uploadBytesResumable,
} from "firebase/storage";
import { db, storage } from "./firebase";

import { validateMedia } from "../utils/mediaValidation";
export * from "../utils/mediaValidation";

export interface SaveMediaOptions {
  category?: "voice" | "scans" | "handwriting" | "backgrounds" | "media";
  onProgress?: (percent: number) => void;
  signal?: AbortSignal;
  customId?: string;
}

const mediaRef = (uid: string) => collection(db, "users", uid, "media");

/**
 * Uploads media to user-scoped Firebase Storage and stores metadata in Firestore.
 * Avoids large binary payloads in Firestore while maintaining ID compatibility.
 */
export async function saveMedia(
  uid: string,
  blob: Blob,
  options?: SaveMediaOptions | ((pct: number) => void)
): Promise<string> {
  const opts: SaveMediaOptions =
    typeof options === "function" ? { onProgress: options } : options ?? {};

  const validation = validateMedia(blob, opts.category === "voice" ? "audio" : "any");
  if (!validation.valid) {
    throw new Error(validation.error ?? "too-big");
  }

  const id = opts.customId || doc(mediaRef(uid)).id;
  const category = opts.category || "media";
  const storagePath = `users/${uid}/${category}/${id}`;
  const storageRef = ref(storage, storagePath);

  // 1. Upload to Firebase Storage with resumable task and progress tracking
  let downloadUrl = "";
  try {
    const uploadTask = uploadBytesResumable(storageRef, blob, {
      contentType: blob.type || "application/octet-stream",
    });

    if (opts.signal) {
      opts.signal.addEventListener("abort", () => {
        uploadTask.cancel();
      });
    }

    await new Promise<void>((resolve, reject) => {
      uploadTask.on(
        "state_changed",
        (snapshot) => {
          if (snapshot.totalBytes > 0 && opts.onProgress) {
            const pct = Math.round(
              (snapshot.bytesTransferred / snapshot.totalBytes) * 100
            );
            opts.onProgress(pct);
          }
        },
        (err) => reject(err),
        async () => {
          try {
            downloadUrl = await getDownloadURL(uploadTask.snapshot.ref);
            resolve();
          } catch (e) {
            reject(e);
          }
        }
      );
    });
  } catch (err) {
    console.error("Storage upload failed:", err);
    throw err;
  }

  // 2. Save reference metadata document in Firestore (no large binary payload)
  try {
    await setDoc(doc(db, "users", uid, "media", id), {
      mime: blob.type || "application/octet-stream",
      size: blob.size,
      storage: true,
      storagePath,
      downloadUrl,
      category,
      createdAt: serverTimestamp(),
    });
  } catch (err) {
    console.error("Failed to save media metadata to Firestore, cleaning up Storage:", err);
    // Clean up uploaded Storage file to prevent orphaned objects
    await deleteObject(storageRef).catch(() => {});
    throw err;
  }

  return id;
}

/**
 * Loads a media blob either from Firebase Storage (new) or legacy Firestore Bytes (old).
 * Provides 100% backward compatibility for all existing notes.
 */
export async function loadMedia(uid: string, id: string): Promise<Blob | null> {
  try {
    const snap = await getDoc(doc(db, "users", uid, "media", id));
    if (!snap.exists()) return null;
    const data = snap.data();

    // New format: stored in Firebase Storage
    if (data.storage === true || data.storagePath) {
      const storagePath = (data.storagePath as string) || `users/${uid}/media/${id}`;
      const storageRef = ref(storage, storagePath);
      return await getBlob(storageRef);
    }

    // Legacy format: stored directly in Firestore as Bytes
    if (data.data) {
      const bytes = (data.data as Bytes).toUint8Array();
      return new Blob([new Uint8Array(bytes)], { type: (data.mime as string) || "application/octet-stream" });
    }

    return null;
  } catch (err) {
    console.warn("Failed to load media:", err);
    return null;
  }
}

/**
 * Returns a direct download/preview URL for a media item.
 * For Storage objects, returns the HTTPS download URL.
 * For legacy Firestore Bytes, returns an Object URL.
 */
export async function getMediaUrl(uid: string, id: string): Promise<string | null> {
  try {
    const snap = await getDoc(doc(db, "users", uid, "media", id));
    if (!snap.exists()) return null;
    const data = snap.data();

    if (data.downloadUrl) {
      return data.downloadUrl as string;
    }

    if (data.storage === true || data.storagePath) {
      const storagePath = (data.storagePath as string) || `users/${uid}/media/${id}`;
      const storageRef = ref(storage, storagePath);
      return await getDownloadURL(storageRef);
    }

    // Legacy document: decode bytes and create object URL
    if (data.data) {
      const bytes = (data.data as Bytes).toUint8Array();
      const blob = new Blob([new Uint8Array(bytes)], { type: (data.mime as string) || "application/octet-stream" });
      return URL.createObjectURL(blob);
    }

    return null;
  } catch (err) {
    console.warn("Failed to get media URL:", err);
    return null;
  }
}

/**
 * Deletes media from both Firebase Storage and Firestore.
 * Prevents orphaned objects and handles already-deleted items safely.
 */
export async function deleteMedia(uid: string, id: string): Promise<void> {
  try {
    const mediaDocRef = doc(db, "users", uid, "media", id);
    const snap = await getDoc(mediaDocRef);

    if (snap.exists()) {
      const data = snap.data();
      if (data.storage === true || data.storagePath) {
        const storagePath = (data.storagePath as string) || `users/${uid}/media/${id}`;
        await deleteObject(ref(storage, storagePath)).catch((err) => {
          // Object might already have been removed, that's fine
          console.warn("Storage deleteObject notice:", err);
        });
      }
      await deleteDoc(mediaDocRef);
    }
  } catch (err) {
    console.warn("Failed to delete media:", err);
  }
}

/**
 * Safe, non-destructive migration helper for legacy Firestore-stored media to Firebase Storage.
 * Only replaces Firestore bytes once Firebase Storage upload is verified.
 */
export async function migrateLegacyMedia(uid: string, id: string): Promise<boolean> {
  try {
    const mediaDocRef = doc(db, "users", uid, "media", id);
    const snap = await getDoc(mediaDocRef);
    if (!snap.exists()) return false;

    const data = snap.data();
    if (data.storage === true && data.storagePath) {
      return true; // already migrated
    }

    if (!data.data) {
      return false; // no data to migrate
    }

    const bytes = (data.data as Bytes).toUint8Array();
    const mime = (data.mime as string) || "application/octet-stream";
    const blob = new Blob([new Uint8Array(bytes)], { type: mime });

    const storagePath = `users/${uid}/media/${id}`;
    const storageRef = ref(storage, storagePath);

    // 1. Upload to Storage
    const uploadTask = uploadBytesResumable(storageRef, blob, { contentType: mime });
    await uploadTask;
    const downloadUrl = await getDownloadURL(storageRef);

    // 2. Update Firestore metadata and safely delete legacy binary field
    await updateDoc(mediaDocRef, {
      storage: true,
      storagePath,
      downloadUrl,
      size: blob.size,
      data: deleteField(),
    });

    return true;
  } catch (err) {
    console.error("Non-destructive migration failed for media", id, err);
    return false;
  }
}
