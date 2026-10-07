import { useState, type FormEvent } from "react";
import { useAuth } from "../hooks/useAuth";
import { useSubjects } from "../hooks/useSubjects";
import { useTasks } from "../hooks/useTasks";
import { addTask, deleteTask, setTaskStatus } from "../services/tasks";
import { nextStatus, sortTasks } from "../utils/tasks";
import TaskRow from "../components/TaskRow";
import type { TaskPriority } from "../types";

const PRIORITIES: { id: TaskPriority; label: string }[] = [
  { id: "high", label: "🔴 High" },
  { id: "medium", label: "🟡 Medium" },
  { id: "low", label: "🟢 Low" },
];

export default function Tasks() {
  const { user } = useAuth();
  const { subjects } = useSubjects();
  const { tasks, loading } = useTasks();

  const [title, setTitle] = useState("");
  const [subjectId, setSubjectId] = useState("");
  const [priority, setPriority] = useState<TaskPriority>("medium");
  const [deadline, setDeadline] = useState("");
  const [estimate, setEstimate] = useState("");

  const open = sortTasks(tasks.filter((t) => t.status !== "done"));
  const done = tasks.filter((t) => t.status === "done");

  async function handleAdd(e: FormEvent) {
    e.preventDefault();
    if (!user || !title.trim()) return;

    const subject = subjects.find((s) => s.id === subjectId);
    const minutes = Math.round(Number(estimate));

    await addTask(user.uid, {
      title: title.trim(),
      subjectId,
      subjectName: subject?.name ?? "",
      subjectEmoji: subject?.emoji ?? "",
      priority,
      deadline,
      estimatedMinutes: minutes > 0 ? minutes : null,
    });

    setTitle("");
    setDeadline("");
    setEstimate("");
  }

  return (
    <>
      <h1 className="page-title">Tasks ✅</h1>

      <form className="card task-form" onSubmit={handleAdd}>
        <input
          className="task-title-input"
          placeholder="What do you need to do? (e.g. Complete Integration assignment)"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
        />

        <div className="task-form-row">
          <select value={subjectId} onChange={(e) => setSubjectId(e.target.value)}>
            <option value="">No subject</option>
            {subjects.map((s) => (
              <option key={s.id} value={s.id}>
                {s.emoji} {s.name}
              </option>
            ))}
          </select>

          <input
            type="date"
            value={deadline}
            onChange={(e) => setDeadline(e.target.value)}
            aria-label="Deadline"
          />

          <input
            className="minutes-input"
            type="number"
            min={1}
            placeholder="Est. min"
            value={estimate}
            onChange={(e) => setEstimate(e.target.value)}
          />
        </div>

        <div className="task-form-row">
          <div className="mode-tabs">
            {PRIORITIES.map((p) => (
              <button
                key={p.id}
                type="button"
                className={`chip ${priority === p.id ? "selected" : ""}`}
                onClick={() => setPriority(p.id)}
              >
                {p.label}
              </button>
            ))}
          </div>
          <button className="btn" type="submit">
            Add task
          </button>
        </div>
      </form>

      {loading ? (
        <p>Loading…</p>
      ) : (
        <>
          <section className="card task-section">
            <h3>To do ({open.length})</h3>
            {open.length === 0 ? (
              <p className="empty-note">Nothing open. Add a task above ✨</p>
            ) : (
              <ul className="task-list">
                {open.map((t) => (
                  <TaskRow
                    key={t.id}
                    task={t}
                    onStatusClick={() => user && setTaskStatus(user.uid, t.id, nextStatus(t.status))}
                    onDelete={() => user && deleteTask(user.uid, t.id)}
                  />
                ))}
              </ul>
            )}
          </section>

          {done.length > 0 && (
            <section className="card task-section">
              <h3>Completed ({done.length})</h3>
              <ul className="task-list">
                {done.map((t) => (
                  <TaskRow
                    key={t.id}
                    task={t}
                    onStatusClick={() => user && setTaskStatus(user.uid, t.id, nextStatus(t.status))}
                    onDelete={() => user && deleteTask(user.uid, t.id)}
                  />
                ))}
              </ul>
            </section>
          )}
        </>
      )}
    </>
  );
}
