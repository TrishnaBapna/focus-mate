import { useState, type FormEvent } from "react";
import { useAuth } from "../hooks/useAuth";
import { useSubjects } from "../hooks/useSubjects";
import { addTask } from "../services/tasks";
import { dayKey } from "../utils/stats";
import Icon from "./Icon";

// "Add New Task for Today" bar under the task list
export default function QuickAddTask() {
  const { user } = useAuth();
  const { subjects } = useSubjects();
  const [title, setTitle] = useState("");
  const [subjectId, setSubjectId] = useState("");
  const [minutes, setMinutes] = useState("");
  const [showMinutes, setShowMinutes] = useState(false);

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (!user || !title.trim()) return;
    const subject = subjects.find((s) => s.id === subjectId);
    const estimate = Math.round(Number(minutes));

    await addTask(user.uid, {
      title: title.trim(),
      subjectId,
      subjectName: subject?.name ?? "",
      subjectEmoji: subject?.emoji ?? "",
      priority: "medium",
      deadline: dayKey(new Date()),
      estimatedMinutes: estimate > 0 ? estimate : null,
    });

    setTitle("");
    setMinutes("");
    setShowMinutes(false);
  }

  return (
    <form className="wf-add" onSubmit={submit}>
      <label className="wf-add-input">
        <Icon name="plus" size={16} />
        <input
          className="bare"
          placeholder="Add New Task for Today"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
        />
      </label>

      {showMinutes && (
        <input
          className="bare wf-minutes"
          type="number"
          min={1}
          placeholder="min"
          value={minutes}
          onChange={(e) => setMinutes(e.target.value)}
        />
      )}

      <button
        type="button"
        className="wf-icon-btn"
        title="Add a time estimate"
        aria-label="Add a time estimate"
        onClick={() => setShowMinutes(!showMinutes)}
      >
        <Icon name="clock" size={16} />
      </button>

      <label className="wf-pill">
        <select value={subjectId} onChange={(e) => setSubjectId(e.target.value)} aria-label="Subject">
          <option value="">Subject</option>
          {subjects.map((s) => (
            <option key={s.id} value={s.id}>
              {s.emoji} {s.name}
            </option>
          ))}
        </select>
        <Icon name="chevron" size={12} />
      </label>

      <button type="submit" className="wf-send" aria-label="Add task">
        <Icon name="send" size={16} />
      </button>
    </form>
  );
}
