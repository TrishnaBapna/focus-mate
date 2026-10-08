import { useState, type FormEvent } from "react";
import { useAuth } from "../hooks/useAuth";
import { useExams } from "../hooks/useExams";
import { useSubjects } from "../hooks/useSubjects";
import { addExam, deleteExam, setSyllabus } from "../services/exams";
import { daysUntil, newId } from "../utils/exams";
import ExamCard from "../components/ExamCard";
import type { Exam, SyllabusItem } from "../types/exam";

export default function Exams() {
  const { user } = useAuth();
  const { subjects } = useSubjects();
  const { exams, loading } = useExams();

  const [name, setName] = useState("");
  const [subjectId, setSubjectId] = useState("");
  const [date, setDate] = useState("");

  const upcoming = exams.filter((e) => daysUntil(e.date) >= 0);
  const past = exams.filter((e) => daysUntil(e.date) < 0).reverse();

  async function handleAdd(e: FormEvent) {
    e.preventDefault();
    if (!user || !name.trim() || !date) return;
    const subject = subjects.find((s) => s.id === subjectId);

    await addExam(user.uid, {
      name: name.trim(),
      subjectId,
      subjectName: subject?.name ?? "",
      subjectEmoji: subject?.emoji ?? "",
      date,
      syllabus: [],
    });
    setName("");
    setDate("");
  }

  function save(exam: Exam, syllabus: SyllabusItem[]) {
    if (user) void setSyllabus(user.uid, exam.id, syllabus);
  }

  function renderCard(exam: Exam) {
    return (
      <ExamCard
        key={exam.id}
        exam={exam}
        onToggle={(id) =>
          save(exam, exam.syllabus.map((i) => (i.id === id ? { ...i, done: !i.done } : i)))
        }
        onAddTopics={(titles) =>
          save(exam, [
            ...exam.syllabus,
            ...titles.map((title) => ({ id: newId(), title, done: false })),
          ])
        }
        onRemoveTopic={(id) => save(exam, exam.syllabus.filter((i) => i.id !== id))}
        onDelete={() => {
          if (user && window.confirm(`Delete "${exam.name}"?`)) void deleteExam(user.uid, exam.id);
        }}
      />
    );
  }

  return (
    <>
      <h1 className="page-title">Exams 🎓</h1>

      <form className="card exam-form" onSubmit={handleAdd}>
        <input
          className="exam-name-input"
          placeholder="Exam name (e.g. Engineering Mathematics)"
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
        <input type="date" value={date} onChange={(e) => setDate(e.target.value)} required />
        <button className="btn" type="submit">
          Add exam
        </button>
      </form>

      {loading ? (
        <p>Loading…</p>
      ) : (
        <>
          {upcoming.length === 0 ? (
            <p className="empty-note">No upcoming exams. Add one above ✨</p>
          ) : (
            <div className="exam-list">{upcoming.map(renderCard)}</div>
          )}

          {past.length > 0 && (
            <>
              <h3 className="past-title">Past exams</h3>
              <div className="exam-list">{past.map(renderCard)}</div>
            </>
          )}
        </>
      )}
    </>
  );
}
