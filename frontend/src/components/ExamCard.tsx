import { useState, type FormEvent } from "react";
import {
  countdownText,
  daysUntil,
  formatExamDate,
  syllabusProgress,
  urgency,
} from "../utils/exams";
import type { Exam } from "../types/exam";

interface Props {
  exam: Exam;
  onToggle: (itemId: string) => void;
  onAddTopics: (titles: string[]) => void;
  onRemoveTopic: (itemId: string) => void;
  onDelete: () => void;
}

export default function ExamCard({ exam, onToggle, onAddTopics, onRemoveTopic, onDelete }: Props) {
  const [topicText, setTopicText] = useState("");
  const days = daysUntil(exam.date);
  const progress = syllabusProgress(exam);

  function handleAdd(e: FormEvent) {
    e.preventDefault();
    const titles = topicText
      .split(",")
      .map((t) => t.trim())
      .filter(Boolean);
    if (titles.length === 0) return;
    onAddTopics(titles);
    setTopicText("");
  }

  return (
    <section className="card exam-card">
      <div className="exam-head">
        <div>
          <div className="exam-name">{exam.name}</div>
          <div className="muted">
            {exam.subjectName ? `${exam.subjectEmoji} ${exam.subjectName} · ` : ""}
            {formatExamDate(exam.date)}
          </div>
        </div>
        <span className={`countdown-badge cd-${urgency(days)}`}>{countdownText(days)}</span>
      </div>

      {progress.total > 0 && (
        <>
          <div className="progress">
            <div className="progress-fill" style={{ width: `${progress.percent}%` }} />
          </div>
          <p className="muted">
            {progress.done} of {progress.total} topics ready
          </p>
        </>
      )}

      {exam.syllabus.length > 0 && (
        <ul className="syllabus">
          {exam.syllabus.map((item) => (
            <li key={item.id} className={item.done ? "done" : ""}>
              <button
                className="status-btn"
                onClick={() => onToggle(item.id)}
                title={item.done ? "Mark as not ready" : "Mark as ready"}
              >
                {item.done ? "✓" : "○"}
              </button>
              <span className="syllabus-title">{item.title}</span>
              <button className="task-delete" onClick={() => onRemoveTopic(item.id)} title="Remove topic">
                ✕
              </button>
            </li>
          ))}
        </ul>
      )}

      {days >= 0 && (
        <form className="topic-form" onSubmit={handleAdd}>
          <input
            placeholder="Add topics (e.g. Integration, Matrices)"
            value={topicText}
            onChange={(e) => setTopicText(e.target.value)}
          />
          <button className="btn secondary small" type="submit">
            Add
          </button>
        </form>
      )}

      <button className="link-btn danger align-start" onClick={onDelete}>
        Delete exam
      </button>
    </section>
  );
}
