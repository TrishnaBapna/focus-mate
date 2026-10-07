import { PRIORITY_ICON, STATUS_ICON, deadlineInfo } from "../utils/tasks";
import type { Task } from "../types";

interface Props {
  task: Task;
  onStatusClick: () => void;
  onDelete?: () => void;
}

export default function TaskRow({ task, onStatusClick, onDelete }: Props) {
  const isDone = task.status === "done";
  const due = isDone ? null : deadlineInfo(task.deadline);

  return (
    <li className={`task-row ${isDone ? "done" : ""}`}>
      <button className="status-btn" onClick={onStatusClick} title="Update status">
        {STATUS_ICON[task.status]}
      </button>

      <div className="task-main">
        <span className="task-title">{task.title}</span>
        <span className="task-meta">
          {task.subjectName && `${task.subjectEmoji} ${task.subjectName}`}
          {task.estimatedMinutes ? ` · ⏱ ${task.estimatedMinutes} min` : ""}
          {due && (
            <span className={due.overdue ? "overdue" : ""}> · {due.text}</span>
          )}
        </span>
      </div>

      <span title={`${task.priority} priority`}>{PRIORITY_ICON[task.priority]}</span>

      {onDelete && (
        <button className="task-delete" onClick={onDelete} title="Delete task">
          ✕
        </button>
      )}
    </li>
  );
}
