import { extractJson } from "../services/ai";
import type { Flashcard, QuizQuestion } from "../types/ai";

export type ToolKind = "text" | "quiz" | "cards";

export interface AiTool {
  id: string;
  icon: string;
  label: string;
  kind: ToolKind;
  instruction: string;
  maxTokens: number;
  longInstruction?: string; // used instead when the note is a long document
  longMaxTokens?: number;
}

export const LONG_NOTE_CHARS = 6000; // about 3 to 4 pages
export const MAX_NOTE_CHARS = 120000; // roughly 40 pages of text

export const SYSTEM_PROMPT =
  "You are a friendly study assistant inside a student's notes app. Work only from the note you are given and do not invent facts that the note does not support. Reply in the same language as the note. When you write plain text, use no markdown symb  "You are a friendly study assistant inside a student's notes app. Work only from the note you are given and do not invent facts that the note does not support. Reply in the same l"summary",
    icon: "✨",
    label: "Summarize",
    kind: "text",
    maxTokens: 600,
    instruction:
      "Summarize this note in 4 to 6 short bullet points, then add one sentence starting with 'Takeaway:'.",
    longMaxTokens: 1400,
    longInstruction:
      "This is a long document. Summarize it section by section: for each main section write a short heading line, then 2 to 3 bullet points. Finish with up to 3 sentences starting with 'Overall:'.",
  },
  {
    id: "explain",
    icon: "🧠",
    label: "Explain simply",
    kind: "text",
    maxTokens: 700,
    instruction:
      "Explain the main ideas in this note in simple language, as if to a first-year student. Include one everyday example. Stay under 200 words.",
    longMaxTokens: 1000,
    longInstruction:
      "Explain the main ideas of this long document in simple language, as if to a first-year student. Give one everyday example for the two or three hardest ideas. Stay under 350 words.",
  },
  {
    id: "points",
    icon: "📌",
    label: "Key points",
    kind: "text",
    maxTokens: 600,
    instruction:
      "List the most important things to remember from this note as at most 8 bullet points, most important first.",
    longMaxTokens: 1200,
    longInstruction:
      "List the most important things to remember from this long document as at most 15 bullet points, grouped under short headings by topic.",
  },
  {
    id: "formulas",
    icon: "🔍",
    label: "Formulas",
    kind: "text",
    maxTokens: 700,
    instruction:
      "Extract every formula, equation, definition, and rule from this note. For each one, write it in plain text, then a short line saying what it means. If there are none, say so.",
    longMaxTokens: 1600,
  },
  {
    id: "quiz",
    icon: "❓",
    label: "Quiz me",
    kind: "quiz",
    maxTokens: 2000,
    instruction:
      'Write 5 multiple-choice questions that test understanding of this note. Reply with ONLY valid JSON in exactly this shape and nothing else: {"questions":[{"question":"...","options":["...","...","...","..."],"answerIndex":0,"explanation":"..."}]}. Each question has exactly 4 options, answerIndex is the 0-based position of the one correct option, and explanation is one short sentence.',
    longMaxTokens: 3600,
    longInstruction:
      'Write 10 multiple-choice questions that test understanding of this long document. Spread them evenly across the whole document, not just the beginning. Reply with ONLY valid JSON in exactly this shape and nothing else: {"questions":[{"question":"...","options":["...","...","...","..."],"answerIndex":0,"explanation":"..."}]}. Each question has exactly 4 options, answerIndex is the 0-based position of the one correct option, and explanation is one short sentence.',
  },
  {
    id: "cards",
    icon: "🃏",
    label: "Flashcards",
    kind: "cards",
    maxTokens: 1500,
    instruction:
      'Make 8 flashcards from this note. Reply with ONLY valid JSON in exactly this shape and nothing else: {"cards":[{"front":"...","back":"..."}]}. Keep each front short (a term or a question) and each back under 25 words.',
    longMaxTokens: 2800,
    longInstruction:
      'Make 16 flashcards from this long document, spread evenly across the whole document. Reply with ONLY valid JSON in exactly this shape and nothing else: {"cards":[{"front":"...","back":"..."}]}. Keep each front short (a term or a question) and each back under 25 words.',
  },
];

function isLong(noteText: string) {
  return noteText.length > LONG_NOTE_CHARS;
}

export function tokensFor(tool: AiTool, noteText: string) {
  return isLong(noteText) && tool.longMaxTokens ? tool.longMaxTokens : tool.maxTokens;
}

export function buildPrompt(tool: AiTool, noteText: string) {
  const instruction = isLong(noteText) && tool.longInstruction ? tool.longInstruction : tool.instruction;
  return `${instruction}\n\nNOTE:\n"""\n${noteText.slice(0, MAX_NOTE_CHARS)}\n"""`;
}

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null;
}

export function parseQuiz(text: string): QuizQuestion[] {
  const data = extractJson(text);
  const list = isRecord(data) && Array.isArray(data.questions) ? data.questions : [];
  const questions: QuizQuestion[] = [];

  for (const q of list) {
    if (!isRecord(q) || typeof q.question !== "string") continue;
    if (!Array.isArray(q.options) || typeof q.answerIndex !== "number") continue;
    const options = q.options.filter((o): o is string => typeof o === "string");
    if (options.length < 2 || q.answerIndex < 0 || q.answerIndex >= options.length) continue;
    questions.push({
      question: q.question,
      options,
      answerIndex: q.answerIndex,
      explanation: typeof q.explanation === "string" ? q.explanation : "",
    });
  }

  if (questions.length === 0) throw new Error("Couldn't build a quiz from that. Please try again.");
  return questions;
}

export function parseCards(text: string): Flashcard[] {
  const data = extractJson(text);
  const list = isRecord(data) && Array.isArray(data.cards) ? data.cards : [];
  const cards: Flashcard[] = [];

  for (const c of list) {
    if (isRecord(c) && typeof c.front === "string" && typeof c.back === "string") {
      cards.push({ front: c.front, back: c.back });
    }
  }

  if (cards.length === 0) throw new Error("Couldn't make flashcards from that. Please try again.");
  return cards;
}
