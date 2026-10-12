import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../hooks/useAuth";
import { useFocus } from "../hooks/useFocus";
import { useTodayItems } from "../hooks/useTodayItems";
import { setTaskStatus } from "../services/tasks";
import { formatTime } from "../utils/plans";
import { deadlineInfo } from "../utils/tasks";
import type { Plan, Task, TaskPriority } from "../types";
import Icon from "./Icon";

const PRIORITY_COLOR: Record<TaskPriority, string> = {
  high: "#ef476f",
  medium: "#ffb26b",
  low: "#5fcf80",
};

function rightText(task: Task) {
  return (
    deadlineInfo(task.deadline)?.text ??
    (task.estimatedMinutes ? `${task.estimatedMinutes} min` : "Anytime")
  );
}

export default function TodayTasksCard() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const focus = useFocus();
  const today = useTodayItems();

  // Opens Focus with this study block's details filled in
  function startBlock(p: Plan) {
    if (focus.phase === "setup" || focus.phase === "focusDone") {
      if (focus.phase === "focusDone") focus.backToSetup();
      focus.setMode("timer");
      focus.setSubjectId(p.subjectId);
      focus.setTopic(p.topic);
      focus.setFocusMinutes(p.durationMinutes);
    }
    navigate("/focus");
  }

  const empty = today.plans.length === 0 && today.tasks.length === 0;

  return (
    <section className="wf-card">
      <h3>Today's Tasks</h3>

      {empty ? (
        <p className="muted small">Nothing for today yet. Add a task below ✨</p>
      ) : (
        <ul className="wf-task-list">
          {today.plans.map((p) => (
            <li key={`plan-${p.id}`} className="wf-task">
              <button className="check play" onClick={() => startBlock(p)} title="Start this study block">
                <Icon name="play" size={10} />
              </button>
              <div className="wf-task-main">
                <strong>
                  {p.subjectEmoji} {p.subjectName}
                  {p.topic && ` · ${p.topic}`}
                </strong>
                <span className="wf-sub">
                  <i className="dot-sm" style={{ background: "#ff8a4c" }} />
                  Study block
                </span>
              </div>
              <span className="wf-time">{formatTime(p.startTime)}</span>
            </li>
          ))}

          {today.tasks.map((t) => {
            const overdue = deadlineInfo(t.deadline)?.overdue;
            return (
              <li key={t.id} className="wf-task">
                <button
                  className="check"
                  aria-label={`Mark "${t.title}" done`}
                  onClick={() => user && setTaskStatus(user.uid, t.id, "done")}
                />
                <div className="wf-task-main">
                  <strong>{t.title}</strong>
                  <span className="wf-sub">
                    <i className="dot-sm" style={{ background: PRIORITY_COLOR[t.priority] }} />
                    {t.subjectName || "No subject"}
                  </span>
                </div>
                <span className={`wf-time ${overdue ? "overdue" : ""}`}>{rightText(t)}</span>
              </li>
            );
          })}
        </ul>
      )}

      <Link to="/tasks" className="link-btn view-all">
        All tasks →
      </Link>
    </section>
  );
}
