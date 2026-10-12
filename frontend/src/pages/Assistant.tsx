import { useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import { Link } from "react-router-dom";
import AiFlashcards from "../components/AiFlashcards";
import AiQuiz from "../components/AiQuiz";
import { useAchievements } from "../hooks/useAchievements";
import { useAiSettings } from "../hooks/useAiSettings";
import { useAuth } from "../hooks/useAuth";
import { useCards } from "../hooks/useCards";
import { useExams } from "../hooks/useExams";
import { useNotes } from "../hooks/useNotes";
import { usePlans } from "../hooks/usePlans";
import { useSettings } from "../hooks/useSettings";
import { useSubjects } from "../hooks/useSubjects";
import { askAi } from "../services/ai";
import {
  ASSISTANT_SYSTEM,
  buildSnapshot,
  historyText,
  notesMaterial,
  notesSection,
  pickNotes,
} from "../utils/assistantContext";
import { SYSTEM_PROMPT, TOOLS, buildPrompt, parseCards, parseQuiz, tokensFor } from "../utils/aiTools";
import { newId } from "../utils/exams";
import type { Flashcard, QuizQuestion } from "../types/ai";
import type { Note } from "../types";

type Message =
  | { id: string; role: "user" | "assistant"; kind: "text"; text: string }
  | { id: string; role: "assistant"; kind: "quiz"; text: string; questions: QuizQuestion[] }
  | { id: string; role: "assistant"; kind: "cards"; text: string; cards: Flashcard[] };

const SUGGESTIONS = [
  "What should I study today?",
  "Make a study plan for my next exam",
  "How was my week?",
  "Quiz me on my notes",
  "Which subject am I neglecting?",
];

const QUIZ_RE = /\b(quiz|test me|mcq|practice questions?)\b/i;
const CARDS_RE = /\bflash ?cards?\b/i;
const CHAT_KEY = "focusmate-chat";

// Only the text of the chat is kept between visits (quizzes and cards are not)
function readChat(): Message[] {
  try {
    const raw = localStorage.getItem(CHAT_KEY);
    if (!raw) return [];
    const list = JSON.parse(raw);
    if (!Array.isArray(list)) return [];
    return list
      .filter((m) => m && (m.role === "user" || m.role === "assistant") && typeof m.text === "string")
      .map((m) => ({
        id: String(m.id),
        role: m.role as "user" | "assistant",
        kind: "text" as const,
        text: m.text as string,
      }));
  } catch {
    return [];
  }
}

export default function Assistant() {
  const { user } = useAuth();
  const { provider, apiKey, model } = useAiSettings();
  const { settings } = useSettings();
  const { sessions, tasks, progress } = useAchievements();
  const { exams } = useExams();
  const { plans } = usePlans();
  const { subjects } = useSubjects();
  const { notes } = useNotes();
  const { cards } = useCards();

  const [messages, setMessages] = useState<Message[]>(readChat);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [attached, setAttached] = useState<string[]>([]);
  const [error, setError] = useState("");
  const endRef = useRef<HTMLDivElement>(null);

  const name = user?.displayName?.split(" ")[0] ?? "the student";

  const data = useMemo(
    () => ({
      name,
      sessions,
      tasks,
      exams,
      plans,
      subjects,
      notes,
      cards,
      goalMinutes: settings.dailyGoalMinutes,
      level: progress.level.level,
    }),
    [name, sessions, tasks, exams, plans, subjects, notes, cards, settings.dailyGoalMinutes, progress.level.level]
  );

  useEffect(() => {
    try {
      localStorage.setItem(CHAT_KEY, JSON.stringify(messages.filter((m) => m.kind === "text").slice(-40)));
    } catch {
      // ignore
    }
  }, [messages]);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [messages, busy]);

  async function respond(question: string, chosen: Note[], history: Message[]): Promise<Message> {
    const base = { provider, apiKey, model };
    const wantsQuiz = QUIZ_RE.test(question);
    const wantsCards = CARDS_RE.test(question);

    if (wantsQuiz || wantsCards) {
      if (chosen.length === 0) {
        return {
          id: newId(),
          role: "assistant",
          kind: "text",
          text: "Which notes should I use? Attach a note with the 📎 menu below, or name a subject (like “Quiz me on my Physics notes”).",
        };
      }
      const material = notesMaterial(chosen);
      if (material.replace(/\(this note has no readable text[^)]*\)/g, "").trim().length < 20) {
        return {
          id: newId(),
          role: "assistant",
          kind: "text",
          text: "Those notes don't have text I can read yet (handwritten notes can't be read). Try a typed, voice, or scanned note.",
        };
      }

      const tool = TOOLS.find((t) => t.id === (wantsQuiz ? "quiz" : "cards"));
      if (!tool) throw new Error("That tool isn't available.");
      const answer = await askAi({
        ...base,
        system: SYSTEM_PROMPT,
        prompt: buildPrompt(tool, material),
        maxTokens: tokensFor(tool, material),
        json: true,
      });
      const titles = chosen.map((n) => `“${n.title || "Untitled"}”`).join(", ");

      return wantsQuiz
        ? { id: newId(), role: "assistant", kind: "quiz", text: `Here's a quiz from ${titles}.`, questions: parseQuiz(answer) }
        : { id: newId(), role: "assistant", kind: "cards", text: `Here are flashcards from ${titles}.`, cards: parseCards(answer) };
    }

    const prompt = [
      buildSnapshot(data),
      chosen.length > 0 ? notesSection(chosen) : "",
      historyText(history.slice(0, -1)),
      `Student: ${question}`,
      "Assistant:",
    ]
      .filter(Boolean)
      .join("\n\n");

    const answer = await askAi({ ...base, system: ASSISTANT_SYSTEM, prompt, maxTokens: 900 });
    return { id: newId(), role: "assistant", kind: "text", text: answer };
  }

  async function send(raw: string) {
    const question = raw.trim();
    if (!question || busy) return;

    setError("");
    setInput("");
    const asked: Message = { id: newId(), role: "user", kind: "text", text: question };
    const history = [...messages, asked];
    setMessages(history);
    setBusy(true);

    try {
      const chosen = pickNotes(question, notes, subjects, attached);
      const reply = await respond(question, chosen, history);
      setMessages((prev) => [...prev, reply]);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    void send(input);
  }

  function clearChat() {
    setMessages([]);
    setError("");
  }

  if (!apiKey) {
    return (
      <section className="card">
        <h3>Meet Mate 🦉</h3>
        <p>
          Mate is your study buddy. It knows your tasks, exams, and notes, and can plan your day or
          quiz you. To use it, add a free API key (it takes a minute).
        </p>
        <Link to="/settings" className="btn">
          Open Settings
        </Link>
      </section>
    );
  }

  const attachable = notes.filter((n) => !attached.includes(n.id));

  return (
    <div className="chat-page">
      <div className="card chat-box">
        <div className="chat-scroll">
          {messages.length === 0 && (
            <div className="chat-empty">
              <div className="chat-owl">🦉</div>
              <h3>Hi, I'm Mate!</h3>
              <p className="muted">
                Ask me what to study, how your week went, or to quiz you on your notes.
              </p>
              <div className="chat-chips">
                {SUGGESTIONS.map((s) => (
                  <button key={s} className="chip" onClick={() => void send(s)} disabled={busy}>
                    {s}
                  </button>
                ))}
              </div>
            </div>
          )}

          {messages.map((m) => (
            <div key={m.id} className={`bubble ${m.role}`}>
              <span className="bubble-text">{m.text}</span>
              {m.kind === "quiz" && (
                <div className="ai-output">
                  <AiQuiz questions={m.questions} />
                </div>
              )}
              {m.kind === "cards" && (
                <div className="ai-output">
                  <AiFlashcards cards={m.cards} />
                </div>
              )}
            </div>
          ))}

          {busy && <div className="bubble assistant typing">Mate is thinking…</div>}
          {error && <p className="auth-error">{error}</p>}
          <div ref={endRef} />
        </div>

        <div className="attach-row">
          <select
            value=""
            onChange={(e) => {
              if (e.target.value) setAttached((prev) => [...prev, e.target.value]);
            }}
            aria-label="Attach a note"
          >
            <option value="">📎 Attach a note…</option>
            {attachable.map((n) => (
              <option key={n.id} value={n.id}>
                {n.title || "Untitled"}
                {n.subjectName ? ` (${n.subjectName})` : ""}
              </option>
            ))}
          </select>

          {attached.map((id) => {
            const n = notes.find((x) => x.id === id);
            return (
              <button
                key={id}
                className="attached-chip"
                onClick={() => setAttached((prev) => prev.filter((x) => x !== id))}
                title="Remove"
              >
                {n?.title || "Note"} ✕
              </button>
            );
          })}

          {messages.length > 0 && (
            <button className="link-btn" onClick={clearChat}>
              Clear chat
            </button>
          )}
        </div>

        <form className="chat-input" onSubmit={onSubmit}>
          <input
            placeholder="Ask Mate anything about your studies…"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            disabled={busy}
          />
          <button className="btn" type="submit" disabled={busy || !input.trim()}>
            Send
          </button>
        </form>

        <p className="chat-foot">
          Mate sees your tasks, exams, plan, study time, and the notes you attach or mention. When you
          ask, they are sent to {provider === "gemini" ? "Google (free tier: Google may use it to improve its products)" : "Anthropic"}.
          AI can make mistakes, so double-check important facts.
        </p>
      </div>
    </div>
  );
}
