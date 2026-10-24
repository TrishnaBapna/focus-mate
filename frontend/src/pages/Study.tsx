import { useState, type FormEvent } from "react";
import { Link } from "react-router-dom";
import StudySession from "../components/StudySession";
import { useAuth } from "../hooks/useAuth";
import { useCards } from "../hooks/useCards";
import { useDecks } from "../hooks/useDecks";
import { useSubjects } from "../hooks/useSubjects";
import { addDeck } from "../services/study";
import { isDue, todayKey } from "../utils/study";
import TargetedAssessmentModal from "../components/TargetedAssessmentModal";
import type { Deck, StudyCard } from "../types/study";

export default function Study() {
  const { user } = useAuth();
  const { subjects } = useSubjects();
  const { decks, loading } = useDecks();
  const { cards } = useCards();

  const [name, setName] = useState("");
  const [subjectId, setSubjectId] = useState("");
  const [reviewing, setReviewing] = useState<StudyCard[] | null>(null);
  const [quizDeck, setQuizDeck] = useState<Deck | null>(null);

  const today = todayKey();
  const dueAll = cards.filter((c) => isDue(c, today));

  if (reviewing) {
    return <StudySession cards={reviewing} onDone={() => setReviewing(null)} />;
  }

  async function handleAdd(e: FormEvent) {
    e.preventDefault();
    if (!user || !name.trim()) return;
    const subject = subjects.find((s) => s.id === subjectId);
    await addDeck(user.uid, {
      name: name.trim(),
      subjectId,
      subjectName: subject?.name ?? "",
      subjectEmoji: subject?.emoji ?? "",
    });
    setName("");
  }

  return (
    <>
      <div className="notes-header">
        <h1>Study 🃏</h1>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
          <Link
            to="/planner"
            className="btn secondary"
            style={{ textDecoration: "none", display: "inline-flex", alignItems: "center", gap: 6 }}
          >
            ⚡ Revision Planner
          </Link>
          <button
            className="btn"
            disabled={dueAll.length === 0}
            onClick={() => setReviewing(dueAll)}
          >
            Review all due ({dueAll.length})
          </button>
        </div>
      </div>

      <form className="card deck-form" onSubmit={handleAdd}>
        <input
          className="deck-name-input"
          placeholder="New deck name (e.g. Physics: Friction)"
          value={name}
          onChange={(e) => setName(e.target.value)}
          required
        />
        <select value={subjectId} onChange={(e) => setSubjectId(e.target.value)}>
          <option value="">No subject</option>
          {subjects.map((s) => (
            <option key={s.id} value={s.id}>
              {s.emoji} {s.name}
            </option>
          ))}
        </select>
        <button className="btn" type="submit">
          Create deck
        </button>
      </form>

      {loading ? (
        <p>Loading…</p>
      ) : decks.length === 0 ? (
        <p className="empty-note">No decks yet. Create your first one above ✨</p>
      ) : (
        <div className="deck-grid">
          {decks.map((deck) => {
            const deckCards = cards.filter((c) => c.deckId === deck.id);
            const due = deckCards.filter((c) => isDue(c, today));
            return (
              <section key={deck.id} className="card deck-card">
                <div className="deck-title">{deck.name}</div>
                {deck.subjectName && (
                  <div className="muted">
                    {deck.subjectEmoji} {deck.subjectName}
                  </div>
                )}
                <div className="deck-counts">
                  <span className="pill">{deckCards.length} cards</span>
                  {due.length > 0 && <span className="pill due">{due.length} due</span>}
                </div>
                <div className="focus-controls deck-actions">
                  <button
                    className="btn small"
                    disabled={due.length === 0}
                    onClick={() => setReviewing(due)}
                  >
                    Study
                  </button>
                  <Link to={`/study/${deck.id}`} className="btn secondary small">
                    Open
                  </Link>
                  <button
                    type="button"
                    className="btn secondary small"
                    style={{
                      background: "rgba(170, 59, 255, 0.08)",
                      color: "#9333ea",
                      borderColor: "rgba(170, 59, 255, 0.25)",
                    }}
                    onClick={() => setQuizDeck(deck)}
                    title={`Generate practice quiz on ${deck.name}`}
                  >
                    🎯 Quiz
                  </button>
                </div>
              </section>
            );
          })}
        </div>
      )}

      {quizDeck && (
        <TargetedAssessmentModal
          isOpen={Boolean(quizDeck)}
          onClose={() => setQuizDeck(null)}
          initialTopic={quizDeck.name}
          initialSubjectId={quizDeck.subjectId}
          initialSubjectName={quizDeck.subjectName}
          initialSubjectEmoji={quizDeck.subjectEmoji}
        />
      )}
    </>
  );
}
