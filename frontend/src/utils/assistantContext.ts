import { computeAnalytics } from "./analytics";
import { daysUntil } from "./exams";
import { formatTime, occursOn } from "./plans";
import { computeStats, dayKey } from "./stats";
import { isDue } from "./study";
import { deadlineInfo, sortTasks } from "./tasks";
import { formatDuration } from "./time";
import type { FocusSession, Note, Plan, Subject, Task } from "../types";
import type { Exam } from "../types/exam";
import type { StudyCard } from "../types/study";

export const ASSISTANT_SYSTEM = `You are "Mate", a friendly study buddy inside the Focus Mate app. Use the student's data below to give specific, practical advice.
Rules:
- Never invent tasks, exams, notes, or numbers that are not in the data. If something is missing, say so and suggest how to add it in the app.
- Keep answers short (under 180 words unless asked for more), warm, and easy to read for any age: simple words, short sentences.
- Use plain text only: no markdown symbols (no #, no asterisks, no backticks). Use "• " for bullet points and blank lines between sections. At most one emoji per message.
- For "what should I study today", give a short ordered plan (at most 4 items, each with minutes) based on exams, deadlines, today's study blocks, and neglected subjects.
- If the student seems stressed or discouraged, be kind and suggest one small first step.
- Do not give medical or legal advice.
- Reply in the language the student writes in.`;

export interface AssistantData {
  name: string;
  sessions: FocusSession[];
  tasks: Task[];
  exams: Exam[];
  plans: Plan[];
  subjects: Subject[];
  notes: Note[];
  cards: StudyCard[];
  goalMinutes: number;
  level: number;
}

const minutes = (seconds: number) => (seconds < 60 ? "0 min" : formatDuration(seconds));

// A short summary of the student's situation, sent along with each question
export function buildSnapshot(d: AssistantData): string {
  const now = new Date();
  const todayKey = dayKey(now);
  const stats = computeStats(d.sessions);
  const week = computeAnalytics(d.sessions, "week");
  const lines: string[] = [];

  lines.push(
    `TODAY: ${now.toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long", year: "numeric" })}, ${now.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" })}`
  );
  lines.push(`STUDENT: ${d.name}`);
  lines.push(
    `PROGRESS: daily goal ${d.goalMinutes} min; focused today ${minutes(stats.todaySeconds)}; streak ${stats.currentStreak} day(s); level ${d.level}`
  );

  const bySubject = week.bySubject.map((s) => `${s.name} ${minutes(s.seconds)}`).join(", ");
  lines.push(
    `LAST 7 DAYS: total ${minutes(week.totalSeconds)}${bySubject ? `; by subject: ${bySubject}` : ""}${week.bestWindow ? `; best focus time ${week.bestWindow}` : ""}`
  );

  const upcoming = d.exams
    .filter((e) => {
      const days = daysUntil(e.date);
      return days >= 0 && days <= 90;
    })
    .slice(0, 5);
  lines.push(
    upcoming.length === 0
      ? "EXAMS: none added"
      : "EXAMS:\n" +
          upcoming
            .map((e) => {
              const days = daysUntil(e.date);
              const when = days === 0 ? "today" : days === 1 ? "tomorrow" : `in ${days} days`;
              const notReady = e.syllabus.filter((i) => !i.done).map((i) => i.title);
              const ready = e.syllabus.length - notReady.length;
              return `- ${e.name}${e.subjectName ? ` (${e.subjectName})` : ""} on ${e.date}, ${when}: ${
                e.syllabus.length === 0 ? "no topics added yet" : `${ready} of ${e.syllabus.length} topics ready`
              }${notReady.length > 0 ? `; not ready: ${notReady.join(", ")}` : ""}`;
            })
            .join("\n")
  );

  const open = sortTasks(d.tasks.filter((t) => t.status !== "done")).slice(0, 15);
  lines.push(
    open.length === 0
      ? "OPEN TASKS: none"
      : "OPEN TASKS:\n" +
          open
            .map((t) => {
              const due = deadlineInfo(t.deadline)?.text;
              return `- [${t.priority}] ${t.title}${t.subjectName ? ` (${t.subjectName})` : ""}${due ? `, ${due}` : ""}${t.estimatedMinutes ? `, about ${t.estimatedMinutes} min` : ""}`;
            })
            .join("\n")
  );

  const blocks = d.plans
    .filter((p) => occursOn(p, todayKey))
    .sort((a, b) => a.startTime.localeCompare(b.startTime));
  lines.push(
    blocks.length === 0
      ? "STUDY BLOCKS TODAY: none"
      : "STUDY BLOCKS TODAY:\n" +
          blocks
            .map((p) => `- ${formatTime(p.startTime)} ${p.subjectName}${p.topic ? ` (${p.topic})` : ""}, ${p.durationMinutes} min`)
            .join("\n")
  );

  lines.push(`FLASHCARDS DUE: ${d.cards.filter((c) => isDue(c)).length}`);
  lines.push(`SUBJECTS: ${d.subjects.map((s) => s.name).join(", ") || "none yet"}`);

  const index = d.notes.slice(0, 25);
  lines.push(
    index.length === 0
      ? "NOTES: none yet"
      : "NOTES (titles only):\n" +
          index
            .map((n) => `- "${n.title || "Untitled"}" (${n.subjectName || "no subject"}${n.topic ? `, ${n.topic}` : ""}, ${n.type ?? "typed"})`)
            .join("\n")
  );

  return lines.join("\n");
}

const STOP = new Set([
  "what", "should", "study", "today", "quiz", "about", "notes", "note", "make", "give", "explain",
  "summarize", "summary", "from", "with", "tell", "please", "need", "help", "want", "my", "me",
  "flashcards", "flashcard", "test", "this", "that", "have", "does", "could", "would", "plan",
]);

// Which notes should Mate read for this question? Attached ones, subjects named, or matching words.
export function pickNotes(question: string, notes: Note[], subjects: Subject[], attachedIds: string[]) {
  const q = question.toLowerCase();
  const chosen: Note[] = [];
  const add = (n: Note) => {
    if (chosen.length < 5 && !chosen.some((c) => c.id === n.id)) chosen.push(n);
  };

  for (const id of attachedIds) {
    const n = notes.find((x) => x.id === id);
    if (n) add(n);
  }

  for (const s of subjects) {
    if (q.includes(s.name.toLowerCase())) {
      notes.filter((n) => n.subjectId === s.id).slice(0, 4).forEach(add);
    }
  }

  const words = q.split(/[^a-z0-9]+/).filter((w) => w.length >= 4 && !STOP.has(w));
  if (words.length > 0) {
    for (const n of notes) {
      const hay = `${n.title} ${n.topic}`.toLowerCase();
      if (words.some((w) => hay.includes(w))) add(n);
    }
  }
  return chosen;
}

function noteBody(n: Note, max = 6000) {
  const text = n.content.trim();
  return text ? text.slice(0, max) : "(this note has no readable text, for example a handwritten note)";
}

// The note texts, as one block of material (used for quizzes and flashcards)
export function notesMaterial(chosen: Note[]) {
  return chosen
    .map((n) => `${n.title || "Untitled"}\n${noteBody(n)}`)
    .join("\n\n")
    .slice(0, 24000);
}

// The same notes, labelled, for ordinary questions
export function notesSection(chosen: Note[]) {
  const body = chosen
    .map((n) => `--- ${n.title || "Untitled"} (${n.subjectName || "no subject"}) ---\n${noteBody(n)}`)
    .join("\n\n")
    .slice(0, 24000);
  return `NOTES THE STUDENT ATTACHED OR MENTIONED:\n${body}`;
}

export function historyText(messages: { role: "user" | "assistant"; text: string }[]) {
  const recent = messages.slice(-8);
  if (recent.length === 0) return "";
  return (
    "CONVERSATION SO FAR:\n" +
    recent
      .map((m) => `${m.role === "user" ? "Student" : "Assistant"}: ${m.text.slice(0, 600)}`)
      .join("\n")
  );
}
