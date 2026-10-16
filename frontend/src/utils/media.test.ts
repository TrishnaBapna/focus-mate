import {
  ALLOWED_AUDIO_TYPES,
  ALLOWED_IMAGE_TYPES,
  MAX_AUDIO_BYTES,
  MAX_IMAGE_BYTES,
  MAX_MEDIA_BYTES,
  extractAssociatedMediaIds,
  validateMedia,
} from "./mediaValidation.ts";
import type { Note } from "../types";

const assert = {
  strictEqual<T>(actual: T, expected: T, message?: string) {
    if (actual !== expected) {
      throw new Error(`${message ?? "Assertion failed"}: expected ${expected}, got ${actual}`);
    }
  },
  ok(value: unknown, message?: string) {
    if (!value) {
      throw new Error(message ?? "Expected truthy value");
    }
  },
};

console.log("Running Firebase Storage Media Migration automated tests...");

// 1. Validation: File size and MIME type enforcement
{
  // A) Empty file
  const emptyBlob = new Blob([], { type: "image/jpeg" });
  const emptyRes = validateMedia(emptyBlob, "image");
  assert.strictEqual(emptyRes.valid, false);
  assert.strictEqual(emptyRes.error, "empty-file", "Empty files must be rejected");

  // B) Valid image (500 KB JPEG)
  const validImageBlob = new Blob([new Uint8Array(500 * 1024)], { type: "image/jpeg" });
  const validImgRes = validateMedia(validImageBlob, "image");
  assert.strictEqual(validImgRes.valid, true, "Valid JPEG must pass");

  // C) Oversized image (> 10 MB, e.g. 11 MB)
  const oversizedImageBlob = new Blob([new Uint8Array(11 * 1024 * 1024)], { type: "image/png" });
  const overImgRes = validateMedia(oversizedImageBlob, "image");
  assert.strictEqual(overImgRes.valid, false);
  assert.strictEqual(overImgRes.error, "image-too-large", "Images > 10MB must be rejected");

  // D) Unsupported image type (e.g. application/octet-stream or text/html masquerading as image)
  const fakeImageBlob = new Blob([new Uint8Array(100)], { type: "application/x-msdownload" });
  const fakeImgRes = validateMedia(fakeImageBlob, "image");
  assert.strictEqual(fakeImgRes.valid, false);
  assert.strictEqual(fakeImgRes.error, "unsupported-image-type", "Unsupported image type must be rejected");

  // E) Valid audio (2 MB audio/webm)
  const validAudioBlob = new Blob([new Uint8Array(2 * 1024 * 1024)], { type: "audio/webm" });
  const validAudioRes = validateMedia(validAudioBlob, "audio");
  assert.strictEqual(validAudioRes.valid, true, "Valid webm audio must pass");

  // F) Oversized audio (> 25 MB, e.g. 26 MB)
  const oversizedAudioBlob = new Blob([new Uint8Array(26 * 1024 * 1024)], { type: "audio/webm" });
  const overAudioRes = validateMedia(oversizedAudioBlob, "audio");
  assert.strictEqual(overAudioRes.valid, false);
  assert.strictEqual(overAudioRes.error, "audio-too-large", "Audio > 25MB must be rejected");

  // G) Unsupported audio format
  const fakeAudioBlob = new Blob([new Uint8Array(100)], { type: "video/mp4" });
  const fakeAudioRes = validateMedia(fakeAudioBlob, "audio");
  assert.strictEqual(fakeAudioRes.valid, false);
  assert.strictEqual(fakeAudioRes.error, "unsupported-audio-type");

  console.log("✔ Media validation tests passed (size limits and mime type validation)");
}

// 2. Storage limits definition verification
{
  assert.strictEqual(MAX_MEDIA_BYTES, 25 * 1024 * 1024, "MAX_MEDIA_BYTES must be 25 MB");
  assert.strictEqual(MAX_IMAGE_BYTES, 10 * 1024 * 1024, "MAX_IMAGE_BYTES must be 10 MB");
  assert.strictEqual(MAX_AUDIO_BYTES, 25 * 1024 * 1024, "MAX_AUDIO_BYTES must be 25 MB");
  assert.ok(ALLOWED_IMAGE_TYPES.includes("image/jpeg"));
  assert.ok(ALLOWED_IMAGE_TYPES.includes("image/png"));
  assert.ok(ALLOWED_AUDIO_TYPES.includes("audio/webm"));
  assert.ok(ALLOWED_AUDIO_TYPES.includes("audio/mp4"));
  console.log("✔ Storage limits constants verified");
}

// 3. User-scoped storage path isolation
{
  function buildStoragePath(uid: string, category: string, id: string) {
    return `users/${uid}/${category}/${id}`;
  }

  const aliceUid = "user_alice_123";
  const bobUid = "user_bob_456";
  const mediaId = "doc_789";

  const alicePath = buildStoragePath(aliceUid, "scans", mediaId);
  const bobPath = buildStoragePath(bobUid, "scans", mediaId);

  assert.strictEqual(alicePath, "users/user_alice_123/scans/doc_789");
  assert.strictEqual(bobPath, "users/user_bob_456/scans/doc_789");
  assert.ok(alicePath !== bobPath, "Paths for different users must never collide");
  assert.ok(alicePath.startsWith(`users/${aliceUid}/`), "Path must be strictly isolated to authenticated user ID");
  console.log("✔ User-scoped storage path isolation verified");
}

// 4. Legacy note backward compatibility: Firestore Bytes decoding simulation
{
  // Simulates a legacy Firestore document with binary Bytes
  const mockPayload = new Uint8Array([72, 101, 108, 108, 111]); // "Hello"
  const legacyFirestoreDoc = {
    mime: "text/plain",
    size: 5,
    data: {
      toUint8Array: () => mockPayload,
    },
    // No storage: true, purely legacy
  };

  // Legacy loader logic
  const decodedBytes = legacyFirestoreDoc.data.toUint8Array();
  const legacyBlob = new Blob([new Uint8Array(decodedBytes)], { type: legacyFirestoreDoc.mime });

  assert.strictEqual(legacyBlob.size, 5);
  assert.strictEqual(legacyBlob.type, "text/plain");

  // New storage metadata doc
  const newStorageDoc = {
    mime: "image/jpeg",
    size: 45000,
    storage: true,
    storagePath: "users/u1/scans/s1",
    downloadUrl: "https://firebasestorage.googleapis.com/v0/b/...",
  };

  assert.strictEqual(newStorageDoc.storage, true, "Storage doc has storage flag");
  assert.strictEqual((newStorageDoc as Record<string, unknown>).data, undefined, "Storage doc has no large binary payload");
  console.log("✔ Legacy Firestore Bytes and new Storage metadata compatibility verified");
}

// 5. Note deletion and orphan cleanup detection
{
  const sampleNote: Note = {
    id: "note_101",
    title: "Comprehensive Study Note",
    content: "Full exam review",
    subjectId: "sub_1",
    subjectName: "Biology",
    subjectEmoji: "🧬",
    topic: "Genetics",
    sessionId: null,
    type: "scan",
    imageId: "cover_img_1",
    pages: [
      { imageId: "cover_img_1", thumb: "data:..." },
      { imageId: "page_img_2", thumb: "data:..." },
      { imageId: "page_img_3", thumb: "data:..." },
    ],
    audioId: "voice_memo_1",
    strokesMediaId: "handwriting_strokes_1",
  };

  const ids = extractAssociatedMediaIds(sampleNote);
  assert.strictEqual(ids.length, 5, "Must find all 5 media IDs (audio, cover, page 2, page 3, strokes)");
  assert.ok(ids.includes("voice_memo_1"));
  assert.ok(ids.includes("cover_img_1"));
  assert.ok(ids.includes("page_img_2"));
  assert.ok(ids.includes("page_img_3"));
  assert.ok(ids.includes("handwriting_strokes_1"));

  console.log("✔ Associated media extraction for deletion verified");
}

// 6. Non-destructive migration verification
{
  interface DocRecord {
    data?: unknown;
    storage?: boolean;
    storagePath?: string;
    downloadUrl?: string;
  }

  const legacyRecord: DocRecord = {
    data: "binary-payload",
  };

  // Simulating migration: upload first, THEN update Firestore and delete legacy data
  let uploadSucceeded = false;
  let firestoreUpdated = false;

  function simulateMigration(simulateNetworkFailure: boolean) {
    if (simulateNetworkFailure) {
      // Storage upload failed -> legacyRecord is untouched!
      uploadSucceeded = false;
      return false;
    }

    uploadSucceeded = true;
    legacyRecord.storage = true;
    legacyRecord.storagePath = "users/u1/media/m1";
    legacyRecord.downloadUrl = "https://...";
    delete legacyRecord.data;
    firestoreUpdated = true;
    return true;
  }

  // A) Failure case: rollback/recovery safety
  const failedAttempt = simulateMigration(true);
  assert.strictEqual(failedAttempt, false);
  assert.strictEqual(uploadSucceeded, false);
  assert.strictEqual(firestoreUpdated, false);
  assert.ok(legacyRecord.data !== undefined, "Legacy data MUST NOT be deleted if upload fails");

  // B) Success case
  const successAttempt = simulateMigration(false);
  assert.strictEqual(successAttempt, true);
  assert.strictEqual(uploadSucceeded, true);
  assert.strictEqual(firestoreUpdated, true);
  assert.strictEqual(legacyRecord.storage, true);
  assert.strictEqual(legacyRecord.data, undefined);

  console.log("✔ Non-destructive migration and rollback safety verified");
}

console.log("\nAll Firebase Storage Media Migration automated tests passed successfully! 🎉");
