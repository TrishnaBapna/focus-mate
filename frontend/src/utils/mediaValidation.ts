import type { Note } from "../types";

// Storage limits
export const MAX_MEDIA_BYTES = 25 * 1024 * 1024; // 25 MB max file size
export const MAX_IMAGE_BYTES = 10 * 1024 * 1024; // 10 MB for photos / scans
export const MAX_AUDIO_BYTES = 25 * 1024 * 1024; // 25 MB for audio recordings

export const ALLOWED_IMAGE_TYPES = [
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
];

export const ALLOWED_AUDIO_TYPES = [
  "audio/webm",
  "audio/mp4",
  "audio/ogg",
  "audio/wav",
  "audio/mpeg",
  "audio/aac",
];

export function validateMedia(
  blob: Blob,
  expectedKind: "image" | "audio" | "any" = "any"
): { valid: boolean; error?: string } {
  if (!blob || !(blob instanceof Blob)) {
    return { valid: false, error: "invalid-file" };
  }

  const mime = blob.type.toLowerCase().trim();
  const baseMime = mime.split(";")[0].trim();
  const size = blob.size;

  if (size <= 0) {
    return { valid: false, error: "empty-file" };
  }

  if (expectedKind === "image" || (expectedKind === "any" && mime.startsWith("image/"))) {
    if (!mime.startsWith("image/")) {
      return { valid: false, error: "unsupported-image-type" };
    }
    if (size > MAX_IMAGE_BYTES) {
      return { valid: false, error: "image-too-large" };
    }
    if (!ALLOWED_IMAGE_TYPES.includes(baseMime)) {
      return { valid: false, error: "unsupported-image-type" };
    }
  } else if (expectedKind === "audio" || (expectedKind === "any" && mime.startsWith("audio/"))) {
    if (!mime.startsWith("audio/")) {
      return { valid: false, error: "unsupported-audio-type" };
    }
    if (size > MAX_AUDIO_BYTES) {
      return { valid: false, error: "audio-too-large" };
    }
    if (!ALLOWED_AUDIO_TYPES.includes(baseMime)) {
      return { valid: false, error: "unsupported-audio-type" };
    }
  } else {
    if (size > MAX_MEDIA_BYTES) {
      return { valid: false, error: "too-big" };
    }
  }

  return { valid: true };
}

export function extractAssociatedMediaIds(note: Note): string[] {
  const mediaIds: string[] = [];
  if (note.audioId) mediaIds.push(note.audioId);
  if (note.imageId) mediaIds.push(note.imageId);
  if (note.strokesMediaId) mediaIds.push(note.strokesMediaId);
  if (note.pages) {
    for (const p of note.pages) {
      if (p.imageId && !mediaIds.includes(p.imageId)) {
        mediaIds.push(p.imageId);
      }
    }
  }
  return mediaIds;
}
