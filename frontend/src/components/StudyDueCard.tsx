import { Link } from "react-router-dom";
import { useCards } from "../hooks/useCards";
import { isDue } from "../utils/study";

export default function StudyDueCard() {
  const { cards } = useCards();
  const due = cards.filter((c) => isDue(c)).length;
  if (due === 0) return null;

  return (
    <section className="card">
      <h3>🃏 Flashcards</h3>
      <p>
        <span className="stat-big">{due}</span> card{due === 1 ? "" : "s"} due for review
      </p>
      <Link to="/study" className="link-btn view-all">
        Review now →
      </Link>
    </section>
  );
}
