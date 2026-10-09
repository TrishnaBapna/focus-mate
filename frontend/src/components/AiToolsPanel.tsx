import { useState } from "react";
import { useAiSettings } from "../hooks/useAiSettings";
import { askAi } from "../services/ai";
import {
  SYSTEM_PROMPT,
  TOOLS,
  buildPrompt,
  parseCards,
  parseQuiz,
  type AiTool,
} from "../utils/aiTools";
import type { Flashcard, QuizQuestion } from "../types/ai";
import AiFlashcards from "./AiFlashcards";
import AiQuiz from "./AiQuiz";

type Output =
  | { kind: "text"; label: string; text: string }
  | { kind: "quiz"; questions: QuizQuestion[]; run: number }
  | { kind: "cards"; cards: Flashcard[]; run: number };

export default function AiToolsPanel({
  text,
  onInsert,
}: {
  text: string;
  onInsert: (text: string) => void;
}) {
  const { provider, apiKey, model } = useAiSettings();
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [output, setOutput] = useState<Output | null>(null);

  async function run(tool: AiTool) {
    const note = text.trim();
    if (note.length < 20) {
      setError("Write a little more in your note first (a sentence or two).");
      return;
    }

    setError("");
    setBusy(tool.id);
    try {
      const answer = await askAi({
        provider,
        apiKey,
        model,
        system: SYSTEM_PROMPT,
        prompt: buildPrompt(tool, note),
        maxTokens: tool.maxTokens,
        json: tool.kind !== "text",
      });

      if (tool.kind === "quiz") {
        setOutput({ kind: "quiz", questions: parseQuiz(answer), run: Date.now() });
      } else if (tool.kind === "cards") {
        setOutput({ kind: "cards", cards: parseCards(answer), run: Date.now() });
      } else {
        setOutput({ kind: "text", label: `${tool.icon} ${tool.label}`, text: answer });
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong. Please try again.");
    } finally {
      setBusy(null);
    }
  }

  return (
    <section className="ai-panel">
      <h4>✨ AI study tools</h4>

      {!apiKey ? (
        <p className="muted">
          Add a free API key in{" "}
          <a href="/settings" target="_blank" rel="noreferrer">
            Settings
          </a>{" "}
          (it opens in a new tab, so you won't lose this note), then come back here.
        </p>
      ) : (
        <>
          <div className="tool-group ai-tools">
            {TOOLS.map((t) => (
              <button
                key={t.id}
                type="button"
                className="chip"
                disabled={busy !== null}
                onClick={() => void run(t)}
              >
                {busy === t.id ? "Thinking…" : `${t.icon} ${t.label}`}
              </button>
            ))}
          </div>

          {error && <p className="auth-error">{error}</p>}

          {output && (
            <div className="ai-output">
              {output.kind === "text" && (
                <>
                  <div className="ai-output-head">
                    <strong>{output.label}</strong>
                    <button
                      type="button"
                      className="chip"
                      onClick={() => onInsert(`${output.label}\n${output.text}`)}
                    >
                      ➕ Add to note
                    </button>
                  </div>
                  <div className="ai-text">{output.text}</div>
                </>
              )}
              {output.kind === "quiz" && (
                <>
                  <strong>❓ Quiz</strong>
                  <AiQuiz key={output.run} questions={output.questions} />
                </>
              )}
              {output.kind === "cards" && (
                <>
                  <strong>🃏 Flashcards</strong>
                  <AiFlashcards key={output.run} cards={output.cards} />
                </>
              )}
              <button type="button" className="link-btn align-start" onClick={() => setOutput(null)}>
                Dismiss
              </button>
            </div>
          )}

          <p className="ai-foot">
            {provider === "gemini"
              ? "The text of this note is sent to Google (free tier: Google may use it to improve its products, so avoid private information). "
              : "The text of this note is sent to Anthropic and uses your own API credit. "}
            AI can make mistakes, so double-check important facts.
          </p>
        </>
      )}
    </section>
  );
}
