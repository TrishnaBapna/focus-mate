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

// Module-level cache for Storage availability to prevent repeated 3.5s timeouts on multiple pages
let storageAvailable: boolean | null = null;
let lastStorageCheck = 0;
const STORAGE_RETRY_INTERVAL = 60 * 1000; // retry Storage after 1 minute

/**
 * Compresses an image blob in browser environment to fit under maxBytes (e.g. 800 KB for Firestore).
 */
async function compressImageForFallback(blob: Blob, maxBytes = 800000): Promise<Blob> {
  if (typeof document === "undefined" || blob.size <= maxBytes) return blob;
  return new Promise((resolve) => {
    const url = URL.createObjectURL(blob);
    const img = new Image();
    img.onload = async () => {
      URL.revokeObjectURL(url);
      let scale = 0.85;
      let quality = 0.75;
      const canvas = document.createElement("canvas");
      let currentBlob: Blob = blob;

      for (let attempt = 0; attempt < 5; attempt++) {
        const w = Math.max(1, Math.round(img.naturalWidth * scale));
        const h = Math.max(1, Math.round(img.naturalHeight * scale));
        canvas.width = w;
        canvas.height = h;
        const ctx = canvas.getContext("2d");
        if (!ctx) break;
        ctx.fillStyle = "#ffffff";
        ctx.fillRect(0, 0, w, h);
        ctx.drawImage(img, 0, 0, w, h);

        const candidate = await new Promise<Blob | null>((res) =>
          canvas.toBlob(res, "image/jpeg", quality)
        );
        if (candidate) {
          currentBlob = candidate;
          if (candidate.size <= maxBytes) {
            resolve(candidate);
            return;
          }
        }
        scale *= 0.8;
        quality = Math.max(0.4, quality - 0.1);
      }
      resolve(currentBlob);
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      resolve(blob);
    };
    img.src = url;
  });
}

/**
 * Resilient dual-tier media saver:
 * 1. Attempts Firebase Storage with a strict 3.5s timeout.
 * 2. If Storage is unavailable (e.g. bucket 404, unprovisioned, CORS blocked, or timeout),
 *    automatically and seamlessly falls back to Firestore document storage (data: Bytes).
 * 3. Never leaves the save operation hanging indefinitely.
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

  async function saveToFirestore(dataBlob: Blob): Promise<string> {
    const arrayBuffer = await dataBlob.arrayBuffer();
    const bytes = Bytes.fromUint8Array(new Uint8Array(arrayBuffer));
    await setDoc(doc(db, "users", uid, "media", id), {
      mime: dataBlob.type || "application/octet-stream",
      size: dataBlob.size,
      storage: false,
      data: bytes,
      category,
      createdAt: serverTimestamp(),
    });
    return id;
  }

  // Determine whether to attempt Firebase Storage
  const now = Date.now();
  const shouldTryStorage =
    storageAvailable !== false || (now - lastStorageCheck > STORAGE_RETRY_INTERVAL);

  if (shouldTryStorage) {
    try {
      const storageRef = ref(storage, storagePath);
      let downloadUrl = "";

      const uploadPromise = new Promise<void>((resolve, reject) => {
        const uploadTask = uploadBytesResumable(storageRef, blob, {
          contentType: blob.type || "application/octet-stream",
        });

        if (opts.signal) {
          opts.signal.addEventListener("abort", () => {
            uploadTask.cancel();
            reject(new Error("aborted"));
          });
        }

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

      // Strict race timeout (3.5s) to prevent infinite hangs on unprovisioned/404 buckets
      await Promise.race([
        uploadPromise,
        new Promise<never>((_, reject) =>
          setTimeout(() => reject(new Error("storage-timeout")), 3500)
        ),
      ]);

      // Storage succeeded! Save metadata to Firestore
      await setDoc(doc(db, "users", uid, "media", id), {
        mime: blob.type || "application/octet-stream",
        size: blob.size,
        storage: true,
        storagePath,
        downloadUrl,
        category,
        createdAt: serverTimestamp(),
      });

      storageAvailable = true;
      return id;
    } catch (err) {
      console.warn("Firebase Storage unavailable or timed out; falling back to Firestore:", err);
      storageAvailable = false;
      lastStorageCheck = Date.now();
    }
  }

  // Tier 2: Resilient Firestore Fallback
  if (blob.size <= 850000) {
    return await saveToFirestore(blob);
  }

  // If image is larger than 850 KB, compress it to fit under Firestore document limits
  if (blob.type.startsWith("image/")) {
    try {
      const compressed = await compressImageForFallback(blob, 800000);
      return await saveToFirestore(compressed);
    } catch (compressErr) {
      console.warn("Failed to compress image for fallback:", compressErr);
    }
  }

  // If payload cannot fit in Firestore and Cloud Storage is unreachable
  throw new Error("storage-unreachable");
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

    // 1. Direct Firestore Bytes (either fallback or legacy)
    if (data.data) {
      const bytes = (data.data as Bytes).toUint8Array();
      return new Blob([new Uint8Array(bytes)], { type: (data.mime as string) || "application/octet-stream" });
    }

    // 2. New format: stored in Firebase Storage
    if (data.storage === true || data.storagePath) {
      if (data.downloadUrl) {
        try {
          const res = await fetch(data.downloadUrl as string);
          if (res.ok) return await res.blob();
        } catch {
          // Fall through to storageRef
        }
      }
      const storagePath = (data.storagePath as string) || `users/${uid}/media/${id}`;
      const storageRef = ref(storage, storagePath);
      return await getBlob(storageRef);
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

    // Direct Firestore Bytes (either fallback or legacy)
    if (data.data) {
      const bytes = (data.data as Bytes).toUint8Array();
      const blob = new Blob([new Uint8Array(bytes)], { type: (data.mime as string) || "application/octet-stream" });
      return URL.createObjectURL(blob);
    }

    if (data.storage === true || data.storagePath) {
      const storagePath = (data.storagePath as string) || `users/${uid}/media/${id}`;
      const storageRef = ref(storage, storagePath);
      return await getDownloadURL(storageRef);
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
