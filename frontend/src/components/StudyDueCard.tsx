import { Link } from "react-router-dom";
import { useCards } from "../hooks/useCards";
import { isDue } from "../utils/study";

export default function StudyDueCard() {
  const { cards, loading } = useCards();
  const due = cards.filter((c) => isDue(c)).length;

  return (
    <section className="card">
      <h3>🃏 Flashcards</h3>
      {loading ? (
        <p className="muted">Loading…</p>
      ) : cards.length === 0 ? (
        <p className="empty-note">No cards yet. Make your first deck.</p>
      ) : due === 0 ? (
        <p className="empty-note">All caught up. Nothing to review right now ✨</p>
      ) : (
        <p>
          <span className="stat-big">{due}</span> card{due === 1 ? "" : "s"} due for review
        </p>
      )}
      <Link to="/study" className="link-btn view-all">
        {due > 0 ? "Review now →" : "Open Study →"}
      </Link>
    </section>
  );
}
