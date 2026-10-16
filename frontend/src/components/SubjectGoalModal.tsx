import { useState, type FormEvent } from "react";
import type { Subject, SubjectGoal } from "../types";

interface Props {
  subjects: Subject[];
  initialGoal?: SubjectGoal | null;
  initialSubjectId?: string;
  onClose: () => void;
  onSave: (subjectId: string, hours: number) => Promise<void>;
}

const PRESETS = [2, 4, 5, 8, 10, 15];

export default function SubjectGoalModal({
  subjects,
  initialGoal,
  initialSubjectId,
  onClose,
  onSave,
}: Props) {
  const isEditing = !!initialGoal;
  const defaultSubjectId =
    initialGoal?.subjectId ?? initialSubjectId ?? subjects[0]?.id ?? "";

  const [subjectId, setSubjectId] = useState(defaultSubjectId);
  const [hours, setHours] = useState(initialGoal?.targetHours ? String(initialGoal.targetHours) : "5");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  const selectedSubject = subjects.find((s) => s.id === subjectId);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!subjectId) {
      setError("Please select a subject.");
      return;
    }
    const val = parseFloat(hours);
    if (isNaN(val) || val <= 0) {
      setError("Please enter a target greater than 0 hours.");
      return;
    }
    if (val > 168) {
      setError("Target cannot exceed 168 hours in a week.");
      return;
    }

    setSubmitting(true);
    setError("");
    try {
      await onSave(subjectId, val);
      onClose();
    } catch (err) {
      console.error(err);
      setError("Failed to save goal. Please try again.");
      setSubmitting(false);
    }
  }

  return (
    <div className="modal-backdrop" onClick={onClose} role="dialog" aria-modal="true">
      <div className="card modal goal-modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-head">
          <h3>{isEditing ? "Edit Weekly Study Goal 🎯" : "Set Weekly Study Goal 🎯"}</h3>
        </div>

        <form onSubmit={handleSubmit} className="goal-form">
          <label className="goal-label">
            Subject
            <select
              value={subjectId}
              onChange={(e) => setSubjectId(e.target.value)}
              disabled={isEditing}
              className="goal-select"
            >
              {subjects.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.emoji} {s.name}
                </option>
              ))}
            </select>
          </label>

          <label className="goal-label">
            Weekly Target (Hours)
            <div className="goal-input-row">
              <input
                type="number"
                step="0.5"
                min="0.5"
                max="168"
                className="goal-hours-input"
                value={hours}
                onChange={(e) => setHours(e.target.value)}
                placeholder="e.g. 5"
                autoFocus
                required
              />
              <span className="goal-hours-unit">hours / week</span>
            </div>
          </label>

          <div className="goal-presets">
            <span className="preset-label">Quick presets:</span>
            <div className="preset-chips">
              {PRESETS.map((p) => (
                <button
                  key={p}
                  type="button"
                  className={`chip small ${parseFloat(hours) === p ? "selected" : ""}`}
                  onClick={() => setHours(String(p))}
                >
                  {p}h
                </button>
              ))}
            </div>
          </div>

          <p className="goal-tip">
            💡 Calculated automatically from focus sessions for{" "}
            <strong>{selectedSubject?.name || "this subject"}</strong> between Monday 00:00 and
            Sunday 23:59.
          </p>

          {error && <p className="auth-error">{error}</p>}

          <div className="modal-actions">
            <button className="btn" type="submit" disabled={submitting}>
              {submitting ? "Saving…" : isEditing ? "Save target" : "Set goal"}
            </button>
            <button className="link-btn" type="button" onClick={onClose}>
              Cancel
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
