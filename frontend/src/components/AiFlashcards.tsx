import { useState } from "react";
import type { Flashcard } from "../types/ai";

export default function AiFlashcards({ cards }: { cards: Flashcard[] }) {
  const [index, setIndex] = useState(0);
  const [flipped, setFlipped] = useState(false);
  const card = cards[index];

  function go(step: number) {
    setIndex((i) => (i + step + cards.length) % cards.length);
    setFlipped(false);
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
    </div>
  );
}
