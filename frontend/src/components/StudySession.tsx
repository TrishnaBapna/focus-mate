import { useEffect, useState } from "react";
import { useAuth } from "../hooks/useAuth";
import { recordReview } from "../services/study";
import { nextReview, shuffle } from "../utils/study";
import type { StudyCard } from "../types/study";

export default function StudySession({
  cards,
  onDone,
}: {
  cards: StudyCard[];
  onDone: () => void;
}) {
  const { user } = useAuth();
  const [queue, setQueue] = useState<StudyCard[]>(() => shuffle(cards));
  const [initial] = useState(cards.length);
  const [flipped, setFlipped] = useState(false);
  const [reviewed, setReviewed] = useState(0);
  const [remembered, setRemembered] = useState(0);

  const current = queue[0];

  function answer(gotIt: boolean) {
    if (!current || !user) return;
    const next = nextReview(current.box, gotIt);
    void recordReview(user.uid, current.id, next.box, next.due, current.reps + 1);

    setReviewed((r) => r + 1);
    if (gotIt) {
      setRemembered((r) => r + 1);
      setQueue((q) => q.slice(1));
    } else {
      // Missed cards go to the back of the line and come around again
      setQueue((q) => [...q.slice(1), { ...q[0], box: next.box, due: next.due, reps: q[0].reps + 1 }]);
    }
    setFlipped(false);
  }

  // Keyboard: Space = show answer, 1 = Again, 2 = Got it
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (!current) return;
      if (e.code === "Space") {
        e.preventDefault();
        setFlipped(true);
      } else if (flipped && e.key === "1") {
        answer(false);
      } else if (flipped && e.key === "2") {
        answer(true);
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  if (!current) {
    return (
      <div className="card focus-running">
        <h2>🎉 Session done!</h2>
        <p>
          You went through {reviewed} answer{reviewed === 1 ? "" : "s"} and remembered {remembered}.
          Cards you remembered will come back later, so you won't see them again for a while.
        </p>
        <button className="btn" onClick={onDone}>
          Back to decks
        </button>
      </div>
    );
  }

  const progress = initial > 0 ? Math.max(0, 100 - (queue.length / initial) * 100) : 100;

  return (
    <div className="study-wrap">
      <div className="study-top">
        <button className="link-btn" onClick={onDone}>
          ← Stop
        </button>
        <span className="muted">{queue.length} left</span>
      </div>
      <div className="progress">
        <div className="progress-fill" style={{ width: `${progress}%` }} />
      </div>

      <button className="study-card" onClick={() => setFlipped(true)}>
        <span className="fc-label">{flipped ? "Answer" : "Question"}</span>
        {flipped && <span className="study-front">{current.front}</span>}
        <span className="fc-text">{flipped ? current.back : current.front}</span>
        {!flipped && <span className="muted study-hint">Tap or press Space to show the answer</span>}
      </button>

      {flipped ? (
        <div className="focus-controls">
          <button className="btn secondary" onClick={() => answer(false)}>
            Again (1)
          </button>
          <button className="btn" onClick={() => answer(true)}>
            Got it (2)
          </button>
        </div>
      ) : (
        <div className="focus-controls">
          <button className="btn" onClick={() => setFlipped(true)}>
            Show answer
          </button>
        </div>
      )}
    </div>
  );
}
