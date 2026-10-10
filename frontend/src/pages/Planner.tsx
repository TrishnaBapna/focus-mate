import { useMemo, useState, type FormEvent } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../hooks/useAuth";
import { useExams } from "../hooks/useExams";
import { useFocus } from "../hooks/useFocus";
import { usePlans } from "../hooks/usePlans";
import { useSessions } from "../hooks/useSessions";
import { useSubjects } from "../hooks/useSubjects";
import { useTasks } from "../hooks/useTasks";
import { addPlan, deletePlan } from "../services/plans";
import { setTaskStatus } from "../services/tasks";
import { dayKey, sessionDate } from "../utils/stats";
import {
  endTime,
  formatDayLabel,
  formatTime,
  occursOn,
  REPEAT_LABEL,
} from "../utils/plans";
import { nextStatus } from "../utils/tasks";
import { formatDuration } from "../utils/time";
import MonthCalendar from "../components/MonthCalendar";
import TaskRow from "../components/TaskRow";
import type { Plan, PlanRepeat } from "../types";

function firstOfMonth(d: Date) {
  return new Date(d.getFullYear(), d.getMonth(), 1);
}

export default function Planner() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const focus = useFocus();
  const { subjects } = useSubjects();
  const { plans } = usePlans();
  const { tasks } = useTasks();
  const { sessions } = useSessions(500);
  const { exams } = useExams();

  const todayKey = dayKey(new Date());
  const [selectedKey, setSelectedKey] = useState(todayKey);
  const [viewMonth, setViewMonth] = useState(() => firstOfMonth(new Date()));

  // "Add study block" form
  const [showForm, setShowForm] = useState(false);
  const [subjectId, setSubjectId] = useState("");
  const [topic, setTopic] = useState("");
  const [formDate, setFormDate] = useState(todayKey);
  const [startTime, setStartTime] = useState("17:00");
  const [duration, setDuration] = useState("45");
  const [repeat, setRepeat] = useState<PlanRepeat>("none");

  const studiedDays = useMemo(
    () => new Set(sessions.map((s) => dayKey(sessionDate(s)))),
    [sessions]
  );
  const taskDays = useMemo(
    () => new Set(tasks.filter((t) => t.status !== "done" && t.deadline).map((t) => t.deadline)),
    [tasks]
  );

  const examDays = useMemo(() => new Set(exams.map((e) => e.date)), [exams]);

  const getMarks = (key: string) => ({
    plan: plans.some((p) => occursOn(p, key)),
    task: taskDays.has(key),
    studied: studiedDays.has(key),
    exam: examDays.has(key),
  });

  const dayPlans = plans
    .filter((p) => occursOn(p, selectedKey))
    .sort((a, b) => a.startTime.localeCompare(b.startTime));
  const dayTasks = tasks.filter((t) => t.deadline === selectedKey);
  const dayExams = exams.filter((e) => e.date === selectedKey);
  const daySessions = sessions.filter((s) => dayKey(sessionDate(s)) === selectedKey);

  function selectDay(key: string) {
    setSelectedKey(key);
    setFormDate(key);
  }

  function goToday() {
    setViewMonth(firstOfMonth(new Date()));
    selectDay(todayKey);
  }

  async function handleAdd(e: FormEvent) {
    e.preventDefault();
    const subject = subjects.find((s) => s.id === subjectId);
    if (!user || !subject || !formDate || !startTime) return;

    await addPlan(user.uid, {
      subjectId: subject.id,
      subjectName: subject.name,
      subjectEmoji: subject.emoji,
      topic: topic.trim(),
      date: formDate,
      startTime,
      durationMinutes: Math.max(5, Math.round(Number(duration)) || 45),
      repeat,
    });

    const [y, m] = formDate.split("-").map(Number);
    setViewMonth(new Date(y, m - 1, 1));
    setSelectedKey(formDate);
    setTopic("");
    setShowForm(false);
  }

  function handleDelete(p: Plan) {
    if (!user) return;
    const message =
      p.repeat === "none"
        ? "Delete this study block?"
        : "Delete this repeating block? All of its repeats will be removed.";
    if (window.confirm(message)) void deletePlan(user.uid, p.id);
  }

  // Open the Focus page with this block's details pre-filled
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

  return (
    <>
      <h1 className="page-title">Planner 📅</h1>

      <div className="planner-grid">
        <section className="card">
          <MonthCalendar
            month={viewMonth}
            selectedKey={selectedKey}
            getMarks={getMarks}
            onSelect={selectDay}
            onPrev={() => setViewMonth(new Date(viewMonth.getFullYear(), viewMonth.getMonth() - 1, 1))}
            onNext={() => setViewMonth(new Date(viewMonth.getFullYear(), viewMonth.getMonth() + 1, 1))}
            onToday={goToday}
          />
        </section>

        <section className="card agenda">
          <div className="agenda-header">
            <h3>{formatDayLabel(selectedKey)}</h3>
            <button className="btn" onClick={() => setShowForm(!showForm)}>
              {showForm ? "Close" : "+ Study block"}
            </button>
          </div>

          {showForm &&
            (subjects.length === 0 ? (
              <p className="empty-note">Create a subject first, then you can schedule it here.</p>
            ) : (
              <form className="plan-form" onSubmit={handleAdd}>
                <select value={subjectId} onChange={(e) => setSubjectId(e.target.value)} required>
                  <option value="">Choose a subject…</option>
                  {subjects.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.emoji} {s.name}
                    </option>
                  ))}
                </select>
                <input
                  placeholder="Topic (optional)"
                  value={topic}
                  onChange={(e) => setTopic(e.target.value)}
                />
                <div className="plan-form-row">
                  <input
                    type="date"
                    value={formDate}
                    onChange={(e) => setFormDate(e.target.value)}
                    required
                  />
                  <input
                    type="time"
                    value={startTime}
                    onChange={(e) => setStartTime(e.target.value)}
                    required
                  />
                  <input
                    className="minutes-input"
                    type="number"
                    min={5}
                    value={duration}
                    onChange={(e) => setDuration(e.target.value)}
                    aria-label="Duration in minutes"
                  />
                  <span className="muted">min</span>
                </div>
                <select value={repeat} onChange={(e) => setRepeat(e.target.value as PlanRepeat)}>
                  {(Object.keys(REPEAT_LABEL) as PlanRepeat[]).map((r) => (
                    <option key={r} value={r}>
                      {REPEAT_LABEL[r]}
                    </option>
                  ))}
                </select>
                <button className="btn" type="submit">
                  Add block
                </button>
              </form>
            ))}

          <h4>Study blocks</h4>
          {dayPlans.length === 0 ? (
            <p className="empty-note">Nothing planned for this day.</p>
          ) : (
            <ul className="plan-list">
              {dayPlans.map((p) => {
                const color = subjects.find((s) => s.id === p.subjectId)?.color ?? "#ffd6c2";
                return (
                  <li key={p.id} className="plan-row" style={{ borderLeftColor: color }}>
                    <div className="plan-main">
                      <span className="plan-time">
                        {formatTime(p.startTime)} – {formatTime(endTime(p.startTime, p.durationMinutes))}
                      </span>
                      <span className="plan-title">
                        {p.subjectEmoji} {p.subjectName}
                        {p.topic && ` · ${p.topic}`}
                      </span>
                      <span className="task-meta">
                        {formatDuration(p.durationMinutes * 60)}
                        {p.repeat !== "none" && ` · 🔁 ${REPEAT_LABEL[p.repeat]}`}
                      </span>
                    </div>
                    <button className="btn secondary small" onClick={() => startBlock(p)}>
                      Start
                    </button>
                    <button className="task-delete" onClick={() => handleDelete(p)} title="Delete">
                      ✕
                    </button>
                  </li>
                );
              })}
            </ul>
          )}

          {dayExams.length > 0 && (
            <>
              <h4>Exams</h4>
              <ul className="plan-list">
                {dayExams.map((e) => (
                  <li key={e.id} className="plan-row">
                    <div className="plan-main">
                      <span className="plan-title">🎓 {e.name}</span>
                      {e.subjectName && (
                        <span className="task-meta">
                          {e.subjectEmoji} {e.subjectName}
                        </span>
                      )}
                    </div>
                    <Link to="/exams" className="btn secondary small">
                      Open
                    </Link>
                  </li>
                ))}
              </ul>
            </>
          )}

          {dayTasks.length > 0 && (
            <>
              <h4>Tasks due</h4>
              <ul className="task-list">
                {dayTasks.map((t) => (
                  <TaskRow
                    key={t.id}
                    task={t}
                    onStatusClick={() => user && setTaskStatus(user.uid, t.id, nextStatus(t.status))}
                  />
                ))}
              </ul>
            </>
          )}

          {daySessions.length > 0 && (
            <>
              <h4>Studied</h4>
              <ul className="history-list">
                {daySessions.map((s) => (
                  <li key={s.id}>
                    <span className="history-main">
                      {s.subjectEmoji} {s.subjectName}
                      {s.topic && ` · ${s.topic}`}
                    </span>
                    <strong>{formatDuration(s.durationSeconds)}</strong>
                  </li>
                ))}
              </ul>
            </>
          )}
        </section>
      </div>
    </>
  );
}
