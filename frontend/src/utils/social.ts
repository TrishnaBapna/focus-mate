import { dayKey, sessionDate } from "./stats";
import type { FocusSession } from "../types";

export const MAX_GROUP_SIZE = 30;
const MAX_WEEK_SECONDS = 604800; // 168 hours: nobody can focus more than a week has
const ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789"; // no 0/O or 1/I to avoid mix-ups

// The Monday that starts the week a date belongs to, as "YYYY-MM-DD"
export function weekStartKey(date = new Date()) {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() - ((d.getDay() + 6) % 7));
  return dayKey(d);
}

// This week's Monday and the Mondays before it
export function weekKeysBack(count: number) {
  const keys: string[] = [];
  const d = new Date();
  for (let i = 0; i < count; i++) {
    keys.push(weekStartKey(d));
    d.setDate(d.getDate() - 7);
  }
  return keys;
}

export function weekSecondsFor(sessions: FocusSession[], weekKey: string) {
  let total = 0;
  for (const s of sessions) {
    if (dayKey(sessionDate(s)) >= weekKey) total += s.durationSeconds;
  }
  return Math.min(Math.floor(total), MAX_WEEK_SECONDS);
}

export function makeCode(length = 6) {
  const bytes = new Uint8Array(length);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => ALPHABET[b % ALPHABET.length]).join("");
}

export function cleanCode(input: string) {
  return input.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 6);
}

export function describeError(err: unknown) {
  const code = (err as { code?: string }).code;
  if (code === "permission-denied") {
    return "Firebase blocked that. Make sure the new security rules are published (see the setup step).";
  }
  return "Something went wrong. Please try again.";
}
