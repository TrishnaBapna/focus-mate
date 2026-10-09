import { dayKey } from "./stats";
import type { StudyCard } from "../types/study";

// Days until the next review once a card lands in box 1 ... 5
const INTERVAL_DAYS = [0, 1, 3, 7, 14, 30];

// "Got it" moves the card up a box (so it comes back later).
// "Again" drops it to box 1 and it comes back today.
export function nextReview(box: number, gotIt: boolean, today = new Date()) {
  const newBox = gotIt ? Math.min(5, box + 1) : 1;
  const due = new Date(today);
  due.setDate(due.getDate() + (gotIt ? INTERVAL_DAYS[newBox] : 0));
  return { box: newBox, due: dayKey(due) };
}

export const todayKey = () => dayKey(new Date());

export function isDue(card: StudyCard, key = todayKey()) {
  return card.due <= key;
}

export function shuffle<T>(items: T[]): T[] {
  const copy = [...items];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

// Turns pasted text into cards. One card per line: "question | answer" (or separated by a tab).
export function parseBulkCards(text: string) {
  const cards: { front: string; back: string }[] = [];
  let skipped = 0;

  for (const line of text.split("\n")) {
    if (!line.trim()) continue;
    const separator = line.includes("|") ? "|" : line.includes("\t") ? "\t" : "";
    if (!separator) {
      skipped++;
      continue;
    }
    const index = line.indexOf(separator);
    const front = line.slice(0, index).trim();
    const back = line.slice(index + 1).trim();
    if (front && back) cards.push({ front, back });
    else skipped++;
  }
  return { cards, skipped };
}
