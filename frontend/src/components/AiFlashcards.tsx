import { useState } from "react";
import { useAuth } from "../hooks/useAuth";
import { useDecks } from "../hooks/useDecks";
import { addCards, addDeck } from "../services/study";
import { todayKey } from "../utils/study";
import type { Flashcard } from "../types/ai";

export default function AiFlashcards({ cards }: { cards: Flashcard[] }) {
  const { user } = useAuth();
  const { decks } = useDecks();

  const [index, setIndex] = useState(0);
  const [flipped, setFlipped] = useState(false);
  const [target, setTarget] = useState("new");
  const [newName, setNewName] = useState("");
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const card = cards[index];

  function go(step: number) {
    setIndex((i) => (i + step + cards.length) % cards.length);
    setFlipped(false);
  }

  async function save() {
    if (!user) return;
    setSaving(true);
    setMessage("");
    try {
      let deckId = target;
      let deckName = decks.find((d) => d.id === target)?.name ?? "";

      if (target === "new") {
        deckName = newName.trim() || "AI flashcards";
        const ref = await addDeck(user.uid, {
          name: deckName,
          subjectId: "",
          subjectName: "",
          subjectEmoji: "",
        });
        deckId = ref.id;
      }

      await addCards(
        user.uid,
        deckId,
        cards.map((c) => ({ front: c.front, back: c.back })),
        todayKey()
      );
      setMessage(`Saved ${cards.length} cards to “${deckName}” ✅ Find them on the Study page.`);
    } catch (err) {
      console.error("Failed to save cards", err);
      setMessage("Couldn't save the cards. Please try again.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="flashcards">
      <button className={`flashcard ${flipped ? "flipped" : ""}`} onClick={() => setFlipped(!flipped)}>
        <span className="fc-label">{flipped ? "Answer" : "Question"}</span>
        <span className="fc-text">{flipped ? card.back : card.front}</span>
      </button>
      <div className="focus-controls">
        <button className="chip" onClick={() => go(-1)}>
          ← Prev
        </button>
        <span className="muted">
          {index + 1} / {cards.length}
        </span>
        <button className="chip" onClick={() => go(1)}>
          Next →
        </button>
      </div>
      <p className="muted">Tap the card to flip it.</p>

      <div className="save-cards">
        <strong>💾 Save these cards to study later</strong>
        <div className="settings-row">
          <select value={target} onChange={(e) => setTarget(e.target.value)}>
            <option value="new">➕ New deck</option>
            {decks.map((d) => (
              <option key={d.id} value={d.id}>
                {d.name}
              </option>
            ))}
          </select>
          {target === "new" && (
            <input
              placeholder="Deck name"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
            />
          )}
          <button className="btn small" onClick={() => void save()} disabled={saving}>
            {saving ? "Saving…" : "Save"}
          </button>
        </div>
        {message && <p className="muted">{message}</p>}
      </div>
    </div>
  );
}
