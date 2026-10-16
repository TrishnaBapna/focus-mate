import { useState, type FormEvent } from "react";
import { useSubjects } from "../hooks/useSubjects";
import type { AssessmentInput } from "../services/assessments";
import type { AssessmentSource } from "../types/assessment";

interface LogAssessmentModalProps {
  onClose: () => void;
  onSave: (data: AssessmentInput) => Promise<unknown>;
  defaultTopic?: string;
  defaultSubjectId?: string;
}

export default function LogAssessmentModal({
  onClose,
  onSave,
  defaultTopic = "",
  defaultSubjectId = "",
}: LogAssessmentModalProps) {
  const { subjects } = useSubjects();
  const [subjectId, setSubjectId] = useState(defaultSubjectId);
  const [topic, setTopic] = useState(defaultTopic);
  const [score, setScore] = useState<number | "">("");
  const [totalQuestions, setTotalQuestions] = useState<number | "">(5);
  const [source, setSource] = useState<AssessmentSource>("quiz");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError("");

    const trimmedTopic = topic.trim();
    if (!trimmedTopic) {
      setError("Please enter a topic name.");
      return;
    }

    const numScore = Number(score);
    const numTotal = Number(totalQuestions);

    if (isNaN(numScore) || numScore < 0) {
      setError("Score must be a positive number.");
      return;
    }
    if (isNaN(numTotal) || numTotal <= 0) {
      setError("Total questions must be greater than zero.");
      return;
    }
    if (numScore > numTotal) {
      setError("Score cannot be greater than the total questions.");
      return;
    }

    setBusy(true);
    try {
      const selectedSubject = subjects.find((s) => s.id === subjectId);
      await onSave({
        subjectId: subjectId || "",
        subjectName: selectedSubject?.name || "General",
        subjectEmoji: selectedSubject?.emoji || "📚",
        topic: trimmedTopic,
        score: numScore,
        totalQuestions: numTotal,
        source,
      });
      onClose();
    } catch (err) {
      console.error("Failed to log assessment:", err);
      setError("Failed to save assessment score. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="modal-backdrop" onClick={onClose} role="dialog" aria-modal="true">
      <div
        className="modal-card log-assessment-modal"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="modal-header">
          <h3>📊 Log Quiz or Test Score</h3>
          <button className="link-btn close-btn" onClick={onClose} aria-label="Close modal">
            ✕
          </button>
        </div>

        <p className="modal-desc muted">
          Record your results from an in-class quiz, mock test, or practice problem set. FocusMate will use real accuracy data to detect your weak spots.
        </p>

        <form onSubmit={handleSubmit} className="assessment-form">
          {error && <p className="auth-error">{error}</p>}

          <label className="form-label">
            <span>Subject</span>
            <select
              value={subjectId}
              onChange={(e) => setSubjectId(e.target.value)}
              className="form-select"
            >
              <option value="">General / No Subject</option>
              {subjects.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.emoji} {s.name}
                </option>
              ))}
            </select>
          </label>

          <label className="form-label">
            <span>Topic Name *</span>
            <input
              type="text"
              placeholder="e.g. Thermodynamics, Kinematics, Cell Division"
              value={topic}
              onChange={(e) => setTopic(e.target.value)}
              required
              className="form-input"
              autoFocus
            />
          </label>

          <div className="form-row-two">
            <label className="form-label">
              <span>Correct Questions *</span>
              <input
                type="number"
                min="0"
                max={totalQuestions === "" ? 100 : Number(totalQuestions)}
                value={score}
                onChange={(e) => setScore(e.target.value === "" ? "" : Number(e.target.value))}
                required
                className="form-input"
                placeholder="4"
              />
            </label>

            <label className="form-label">
              <span>Total Questions *</span>
              <input
                type="number"
                min="1"
                max="500"
                value={totalQuestions}
                onChange={(e) => setTotalQuestions(e.target.value === "" ? "" : Number(e.target.value))}
                required
                className="form-input"
                placeholder="5"
              />
            </label>
          </div>

          <label className="form-label">
            <span>Assessment Source</span>
            <select
              value={source}
              onChange={(e) => setSource(e.target.value as AssessmentSource)}
              className="form-select"
            >
              <option value="quiz">Class / Practice Quiz</option>
              <option value="test">Mock Exam / Test</option>
              <option value="flashcards">Flashcard Review</option>
              <option value="manual">Self-Study Practice</option>
            </select>
          </label>

          <div className="modal-actions">
            <button type="button" className="link-btn" onClick={onClose} disabled={busy}>
              Cancel
            </button>
            <button type="submit" className="btn" disabled={busy}>
              {busy ? "Saving…" : "Save Score"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
