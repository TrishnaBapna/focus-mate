import { useState, type FormEvent } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import StudySession from "../components/StudySession";
import { useAuth } from "../hooks/useAuth";
import { useCards } from "../hooks/useCards";
import { useDecks } from "../hooks/useDecks";
import { addCards, deleteCard, deleteDeck, updateCardText } from "../services/study";
import { isDue, parseBulkCards, todayKey } from "../utils/study";
import type { StudyCard } from "../types/study";

function CardRow({ card, uid }: { card: StudyCard; uid: string }) {
  const [editing, setEditing] = useState(false);
  const [front, setFront] = useState(card.front);
  const [back, setBack] = useState(card.back);

  async function save() {
    if (!front.trim() || !back.trim()) return;
    await updateCardText(uid, card.id, front.trim(), back.trim());
    setEditing(false);
  }

  if (editing) {
    return (
      <li className="card-row editing">
        <div className="card-edit">
          <input value={front} onChange={(e) => setFront(e.target.value)} aria-label="Question" />
          <input value={back} onChange={(e) => setBack(e.target.value)} aria-label="Answer" />
          <div className="focus-controls">
            <button className="btn small" onClick={() => void save()}>
              Save
            </button>
            <button className="link-btn" onClick={() => setEditing(false)}>
              Cancel
            </button>
          </div>
        </div>
      </li>
    );
  }

  return (
    <li className="card-row">
      <div className="card-text">
        <strong>{card.front}</strong>
        <span className="muted">{card.back}</span>
      </div>
      <button className="task-delete" title="Edit" onClick={() => setEditing(true)}>
        ✎
      </button>
      <button className="task-delete" title="Delete" onClick={() => void deleteCard(uid, card.id)}>
        ✕
      </button>
    </li>
  );
}

export default function DeckPage() {
  const { deckId } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { decks, loading } = useDecks();
  const { cards } = useCards();

  const [front, setFront] = useState("");
  const [back, setBack] = useState("");
  const [bulk, setBulk] = useState("");
  const [bulkMessage, setBulkMessage] = useState("");
  const [reviewing, setReviewing] = useState(false);

  const deck = decks.find((d) => d.id === deckId);
  const deckCards = cards.filter((c) => c.deckId === deckId);
  const due = deckCards.filter((c) => isDue(c));

  if (loading) return <p>Loading…</p>;
  if (!deck || !user) {
    return (
      <section className="card">
        <p>Deck not found.</p>
        <Link to="/study">← Back to Study</Link>
      </section>
    );
  }

  if (reviewing) return <StudySession cards={due} onDone={() => setReviewing(false)} />;

  async function handleAddOne(e: FormEvent) {
    e.preventDefault();
    if (!user || !deck || !front.trim() || !back.trim()) return;
    await addCards(user.uid, deck.id, [{ front: front.trim(), back: back.trim() }], todayKey());
    setFront("");
    setBack("");
  }

  async function handleAddBulk() {
    if (!user || !deck) return;
    const { cards: parsed, skipped } = parseBulkCards(bulk);
    if (parsed.length === 0) {
      setBulkMessage("No cards found. Write one per line like: question | answer");
      return;
    }
    await addCards(user.uid, deck.id, parsed, todayKey());
    setBulk("");
    setBulkMessage(
      `Added ${parsed.length} card${parsed.length === 1 ? "" : "s"}${skipped ? ` (${skipped} line${skipped === 1 ? "" : "s"} skipped)` : ""} ✅`
    );
  }

  async function handleDeleteDeck() {
    if (!user || !deck) return;
    if (!window.confirm(`Delete "${deck.name}" and all ${deckCards.length} of its cards?`)) return;
    await deleteDeck(user.uid, deck.id, deckCards.map((c) => c.id));
    navigate("/study");
  }

  return (
    <>
      <Link to="/study" className="link-btn back-link">
        ← Back to Study
      </Link>

      <div className="notes-header">
        <h1>{deck.name}</h1>
        <button className="btn" disabled={due.length === 0} onClick={() => setReviewing(true)}>
          Study due ({due.length})
        </button>
      </div>
      {deck.subjectName && (
        <p className="muted deck-sub">
          {deck.subjectEmoji} {deck.subjectName}
        </p>
      )}

      <form className="card card-form" onSubmit={handleAddOne}>
        <h3>Add a card</h3>
        <input placeholder="Question" value={front} onChange={(e) => setFront(e.target.value)} />
        <textarea placeholder="Answer" value={back} onChange={(e) => setBack(e.target.value)} />
        <button className="btn align-start" type="submit">
          Add card
        </button>
      </form>

      <section className="card card-form">
        <h3>Paste many cards</h3>
        <p className="muted">One card per line, like: question | answer</p>
        <textarea
          className="bulk-input"
          placeholder={"Newton's first law | An object stays at rest unless a force acts on it\nUnit of force | Newton (N)"}
          value={bulk}
          onChange={(e) => setBulk(e.target.value)}
        />
        <button className="btn secondary align-start" onClick={() => void handleAddBulk()}>
          Add all
        </button>
        {bulkMessage && <p className="muted">{bulkMessage}</p>}
      </section>

      <section className="card card-form">
        <h3>Cards ({deckCards.length})</h3>
        {deckCards.length === 0 ? (
          <p className="empty-note">No cards yet.</p>
        ) : (
          <ul className="card-list">
            {deckCards.map((c) => (
              <CardRow key={c.id} card={c} uid={user.uid} />
            ))}
          </ul>
        )}
      </section>

      <button className="link-btn danger align-start" onClick={() => void handleDeleteDeck()}>
        Delete this deck
      </button>
    </>
  );
}
