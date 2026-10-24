import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useRevisionPlanner } from "../hooks/useRevisionPlanner";
import { useFocus } from "../hooks/useFocus";
import TargetedAssessmentModal from "./TargetedAssessmentModal";
import type { RevisionFilterTab, RevisionTask } from "../types/revision";

export default function RevisionPlannerView() {
  const navigate = useNavigate();
  const focus = useFocus();

  const {
    currentFilteredTasks,
    todayTasks,
    upcomingTasks,
    overdueTasks,
    completedTasks,
    subjectProgress,
    filter,
    setFilter,
    loading,
    savingTaskId,
    feedbackMessage,
    errorMessage,
    todayDate,
    updateStatus,
    reschedule,
    scheduleToStudyCalendar,
    exportToMainTasks,
  } = useRevisionPlanner();

  // Modal / Reschedule popover state
  const [reschedulingTask, setReschedulingTask] = useState<RevisionTask | null>(null);
  const [newDueDate, setNewDueDate] = useState<string>("");
  const [rescheduleNotes, setRescheduleNotes] = useState<string>("");

  // Targeted Assessment Modal state
  const [quizModal, setQuizModal] = useState<{
    isOpen: boolean;
    topic?: string;
    subjectId?: string;
    subjectName?: string;
    subjectEmoji?: string;
    mistakeTag?: string;
    linkedRevisionTaskId?: string;
  }>({ isOpen: false });

  // Start Focus session with prefilled details
  function handleStartFocus(task: RevisionTask) {
    if (focus.phase === "setup" || focus.phase === "focusDone") {
      if (focus.phase === "focusDone") focus.backToSetup();
      focus.setMode("timer");
      if (task.subjectId) focus.setSubjectId(task.subjectId);
      if (task.topic) focus.setTopic(task.topic);
      focus.setFocusMinutes(task.suggestedDurationMinutes || 30);
    }
    navigate("/focus");
  }

  function openReschedule(task: RevisionTask) {
    setReschedulingTask(task);
    setNewDueDate(task.dueDate || todayDate);
    setRescheduleNotes(task.notes || "");
  }

  async function handleConfirmReschedule() {
    if (!reschedulingTask || !newDueDate) return;
    await reschedule(reschedulingTask.id, newDueDate, rescheduleNotes);
    setReschedulingTask(null);
  }

  const filterTabs: { id: RevisionFilterTab; label: string; count: number }[] = [
    { id: "today", label: "Today", count: todayTasks.length },
    { id: "upcoming", label: "Upcoming", count: upcomingTasks.length },
    { id: "overdue", label: "Overdue", count: overdueTasks.length },
    { id: "completed", label: "Completed", count: completedTasks.length },
    { id: "by_subject", label: "By Subject", count: subjectProgress.length },
  ];

  if (loading) {
    return (
      <div className="card" style={{ padding: 24, textAlign: "center" }}>
        <p className="muted">Analyzing academic evidence and generating personalized revision tasks…</p>
      </div>
    );
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      {/* Toast Feedback Messages */}
      {feedbackMessage && (
        <div
          role="status"
          aria-live="polite"
          style={{
            padding: "10px 16px",
            background: "rgba(16, 185, 129, 0.15)",
            border: "1px solid rgba(16, 185, 129, 0.4)",
            color: "var(--text-h)",
            borderRadius: 8,
            fontSize: 14,
            display: "flex",
            alignItems: "center",
            gap: 8,
          }}
        >
          <span>{feedbackMessage}</span>
        </div>
      )}

      {errorMessage && (
        <div
          role="alert"
          style={{
            padding: "10px 16px",
            background: "rgba(239, 68, 68, 0.15)",
            border: "1px solid rgba(239, 68, 68, 0.4)",
            color: "#ef4444",
            borderRadius: 8,
            fontSize: 14,
          }}
        >
          {errorMessage}
        </div>
      )}

      {/* Filter Navigation Tabs */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 12 }}>
        <div className="mode-tabs" role="tablist" aria-label="Revision Task Filters">
          {filterTabs.map((tab) => (
            <button
              key={tab.id}
              type="button"
              role="tab"
              aria-selected={filter === tab.id}
              className={`chip ${filter === tab.id ? "selected" : ""}`}
              onClick={() => setFilter(tab.id)}
            >
              {tab.label}
              {tab.count > 0 && (
                <span
                  style={{
                    marginLeft: 6,
                    padding: "1px 6px",
                    borderRadius: 10,
                    fontSize: 11,
                    background:
                      tab.id === "overdue"
                        ? "rgba(239, 68, 68, 0.25)"
                        : filter === tab.id
                        ? "rgba(255, 255, 255, 0.3)"
                        : "var(--border)",
                    color: tab.id === "overdue" && filter !== tab.id ? "#ef4444" : "inherit",
                  }}
                >
                  {tab.count}
                </span>
              )}
            </button>
          ))}
        </div>

        <Link to="/papers/new" className="btn small secondary" style={{ textDecoration: "none" }}>
          📄 + Analyze Paper
        </Link>
      </div>

      {/* View 1: Subject Progress Matrix */}
      {filter === "by_subject" ? (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", gap: 14 }}>
          {subjectProgress.length === 0 ? (
            <div className="card" style={{ gridColumn: "1 / -1", padding: 24, textAlign: "center" }}>
              <p className="muted">No subjects configured yet. Add subjects in the Subjects tab to track progress.</p>
            </div>
          ) : (
            subjectProgress.map((sub) => (
              <div key={sub.subjectId} className="card" style={{ padding: 18 }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 10 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <span style={{ fontSize: 24 }}>{sub.subjectEmoji}</span>
                    <div>
                      <h4 style={{ margin: 0, fontSize: 16 }}>{sub.subjectName}</h4>
                      {sub.upcomingExamDate ? (
                        <span style={{ fontSize: 12, color: sub.daysUntilExam && sub.daysUntilExam <= 3 ? "#ef4444" : "var(--accent)" }}>
                          🎓 Exam in {sub.daysUntilExam === 0 ? "today" : `${sub.daysUntilExam}d`} ({sub.upcomingExamDate})
                        </span>
                      ) : (
                        <span className="muted" style={{ fontSize: 12 }}>No exam scheduled</span>
                      )}
                    </div>
                  </div>
                  {sub.urgentTasks > 0 && (
                    <span className="pill badge-danger" style={{ fontSize: 11 }}>
                      {sub.urgentTasks} urgent
                    </span>
                  )}
                </div>

                <div style={{ marginBottom: 8 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, marginBottom: 4 }}>
                    <span className="muted">Tasks Completed</span>
                    <strong>{sub.completedTasks} / {sub.totalTasks} ({sub.completionRate}%)</strong>
                  </div>
                  <div
                    className="progress"
                    role="progressbar"
                    aria-valuenow={sub.completionRate}
                    aria-valuemin={0}
                    aria-valuemax={100}
                    style={{ height: 6 }}
                  >
                    <div
                      className="progress-fill"
                      style={{
                        width: `${sub.completionRate}%`,
                        background: sub.completionRate >= 80 ? "#10b981" : "var(--accent)",
                      }}
                    />
                  </div>
                </div>

                <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, marginTop: 12 }}>
                  <span className="muted">Pending: {sub.pendingTasks}</span>
                  <button
                    type="button"
                    className="link-btn"
                    onClick={() => setFilter("today")}
                    style={{ fontSize: 12, cursor: "pointer", background: "none", border: "none", color: "var(--accent)" }}
                  >
                    View tasks →
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      ) : (
        /* View 2: Revision Tasks List */
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          {currentFilteredTasks.length === 0 ? (
            <div className="card" style={{ padding: "36px 20px", textAlign: "center" }}>
              <div style={{ fontSize: 36, marginBottom: 10 }}>
                {filter === "overdue" ? "🎉" : filter === "completed" ? "📝" : "✨"}
              </div>
              <h4 style={{ margin: "0 0 6px" }}>
                {filter === "overdue"
                  ? "No Overdue Revision Tasks!"
                  : filter === "completed"
                  ? "No Completed Tasks Yet"
                  : filter === "upcoming"
                  ? "No Upcoming Tasks Scheduled"
                  : "All Caught Up for Today!"}
              </h4>
              <p className="muted" style={{ maxWidth: 460, margin: "0 auto 16px", fontSize: 14 }}>
                {filter === "overdue"
                  ? "Great job staying on top of your personalized study plan."
                  : filter === "today"
                  ? "You have completed all scheduled revision tasks for today. Upload a past paper or take a quiz to generate fresh targeted recommendations."
                  : "Revision recommendations will appear here as you log papers and upcoming exams."}
              </p>
              <div style={{ display: "flex", gap: 10, justifyContent: "center", flexWrap: "wrap" }}>
                <Link to="/papers/new" className="btn small" style={{ textDecoration: "none" }}>
                  Analyze New Paper
                </Link>
                <Link to="/study" className="btn small secondary" style={{ textDecoration: "none" }}>
                  Study Flashcards
                </Link>
                <Link to="/exams" className="btn small secondary" style={{ textDecoration: "none" }}>
                  View Exams
                </Link>
              </div>
            </div>
          ) : (
            currentFilteredTasks.map((task) => {
              const isSaving = savingTaskId === task.id;
              const isUrgent = task.priority === "urgent";
              const isCompleted = task.status === "completed";
              const isInProgress = task.status === "in_progress";

              return (
                <div
                  key={task.id}
                  className="card"
                  style={{
                    padding: 16,
                    borderLeft: `4px solid ${
                      isCompleted
                        ? "#10b981"
                        : isUrgent
                        ? "#ef4444"
                        : task.priority === "high"
                        ? "#f59e0b"
                        : "var(--accent)"
                    }`,
                    opacity: isCompleted ? 0.75 : 1,
                    transition: "all 0.2s ease",
                  }}
                >
                  {/* Task Header: Title, Subject, Priority Badge */}
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 12, flexWrap: "wrap", marginBottom: 8 }}>
                    <div style={{ flex: 1, minWidth: 240 }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 4 }}>
                        <span>{task.subjectEmoji}</span>
                        <span style={{ fontSize: 12, fontWeight: 600, color: "var(--accent)" }}>
                          {task.subjectName}
                        </span>
                        <span className="muted">·</span>
                        <span style={{ fontSize: 12, fontWeight: 500 }} className="muted">
                          {task.topic}
                        </span>
                        <span className="muted">·</span>
                        <span style={{ fontSize: 12 }} className="muted">
                          ⏱️ ~{task.suggestedDurationMinutes}m
                        </span>
                      </div>
                      <h4
                        style={{
                          margin: "0 0 6px",
                          fontSize: 16,
                          textDecoration: isCompleted ? "line-through" : "none",
                        }}
                      >
                        {task.title}
                      </h4>
                    </div>

                    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      {/* Priority Tag */}
                      <span
                        className={`pill ${
                          isUrgent
                            ? "badge-danger"
                            : task.priority === "high"
                            ? "badge-warn"
                            : "secondary"
                        }`}
                        style={{ fontSize: 11 }}
                      >
                        {isUrgent ? "🔴 Urgent" : task.priority === "high" ? "🟠 High" : "🟡 Medium"}
                      </span>

                      {/* Due Date Indicator */}
                      <span
                        style={{
                          fontSize: 12,
                          color: task.dueDate < todayDate && !isCompleted ? "#ef4444" : "var(--text)",
                          fontWeight: 500,
                        }}
                      >
                        📅 {task.dueDate === todayDate ? "Today" : task.dueDate}
                      </span>
                    </div>
                  </div>

                  {/* Evidence & Rationale Grounding */}
                  <div
                    style={{
                      background: "rgba(0, 0, 0, 0.03)",
                      padding: "8px 12px",
                      borderRadius: 8,
                      fontSize: 13,
                      marginBottom: 10,
                      border: "1px dashed var(--border)",
                    }}
                  >
                    <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 2 }}>
                      <span style={{ fontSize: 14 }}>
                        {task.evidenceType === "academic_mistake"
                          ? "📄"
                          : task.evidenceType === "weak_topic"
                          ? "🎯"
                          : task.evidenceType === "upcoming_exam"
                          ? "🎓"
                          : "💡"}
                      </span>
                      <strong style={{ fontSize: 12, color: "var(--text-h)" }}>
                        Why this was recommended:
                      </strong>
                    </div>
                    <p style={{ margin: 0, color: "var(--text)" }}>{task.rationale}</p>
                    {task.sourcePaperTitle && task.sourceId && (
                      <div style={{ marginTop: 4 }}>
                        <Link
                          to={`/papers/${task.sourceId}`}
                          style={{ fontSize: 12, color: "var(--accent)", textDecoration: "underline" }}
                        >
                          View source paper: {task.sourcePaperTitle} →
                        </Link>
                      </div>
                    )}
                  </div>

                  {/* Concrete Steps & Measurable Goal */}
                  <div style={{ marginBottom: 12 }}>
                    <strong style={{ fontSize: 12, color: "var(--text-h)", display: "block", marginBottom: 4 }}>
                      Steps to complete:
                    </strong>
                    <ol style={{ margin: "0 0 8px 18px", padding: 0, fontSize: 13, color: "var(--text)" }}>
                      {task.concreteSteps.map((step, idx) => (
                        <li key={idx} style={{ marginBottom: 2 }}>
                          {step}
                        </li>
                      ))}
                    </ol>

                    <div style={{ fontSize: 12, color: "var(--accent)", display: "flex", alignItems: "center", gap: 6 }}>
                      <span>🎯 <strong>Criterion:</strong></span>
                      <span>{task.measurableGoal}</span>
                    </div>
                  </div>

                  {/* Action Bar */}
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 8, paddingTop: 8, borderTop: "1px solid var(--border)" }}>
                    <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
                      {/* Status Buttons */}
                      <button
                        type="button"
                        className={`btn small ${isCompleted ? "" : "secondary"}`}
                        onClick={() => updateStatus(task.id, isCompleted ? "pending" : "completed")}
                        disabled={isSaving}
                      >
                        {isCompleted ? "↩ Reopen" : "✓ Mark Done"}
                      </button>

                      {!isCompleted && (
                        <button
                          type="button"
                          className={`btn small secondary ${isInProgress ? "selected" : ""}`}
                          onClick={() => updateStatus(task.id, isInProgress ? "pending" : "in_progress")}
                          disabled={isSaving}
                        >
                          {isInProgress ? "⏳ In Progress" : "▶ Start"}
                        </button>
                      )}

                      <button
                        type="button"
                        className="btn small secondary"
                        onClick={() => openReschedule(task)}
                        disabled={isSaving}
                        title="Change date or add notes"
                      >
                        📅 Reschedule
                      </button>

                      <button
                        type="button"
                        className="btn small"
                        style={{
                          background: "rgba(170, 59, 255, 0.12)",
                          color: "#9333ea",
                          border: "1px solid rgba(170, 59, 255, 0.3)",
                        }}
                        onClick={() =>
                          setQuizModal({
                            isOpen: true,
                            topic: task.topic,
                            subjectId: task.subjectId,
                            subjectName: task.subjectName,
                            subjectEmoji: task.subjectEmoji,
                            linkedRevisionTaskId: task.id,
                            mistakeTag: task.mistakeTag,
                          })
                        }
                        disabled={isSaving}
                        title="Take a practice quiz to verify topic mastery"
                      >
                        🎯 Practice Quiz
                      </button>
                    </div>

                    <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
                      {/* Schedule into Study Calendar (plans) */}
                      <button
                        type="button"
                        className="btn small secondary"
                        onClick={() => scheduleToStudyCalendar(task)}
                        disabled={isSaving}
                        title="Add to daily study calendar"
                      >
                        + Add to Plan
                      </button>

                      {/* Export to Tasks */}
                      <button
                        type="button"
                        className="btn small secondary"
                        onClick={() => exportToMainTasks(task)}
                        disabled={isSaving}
                        title="Add to main task list"
                      >
                        + Main Task
                      </button>

                      {/* Start Focus Session */}
                      <button
                        type="button"
                        className="btn small"
                        onClick={() => handleStartFocus(task)}
                        title="Launch Pomodoro/Timer for this task"
                      >
                        ⏱️ Focus Now
                      </button>
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>
      )}

      {/* Reschedule Dialog Modal */}
      {reschedulingTask && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="reschedule-modal-title"
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0,0,0,0.45)",
            backdropFilter: "blur(4px)",
            display: "grid",
            placeItems: "center",
            zIndex: 100,
            padding: 16,
          }}
        >
          <div
            className="card"
            style={{
              width: "100%",
              maxWidth: 420,
              padding: 24,
              boxShadow: "0 20px 40px rgba(0,0,0,0.2)",
            }}
          >
            <h3 id="reschedule-modal-title" style={{ margin: "0 0 12px" }}>
              📅 Reschedule Task
            </h3>
            <p style={{ margin: "0 0 16px", fontSize: 14 }}>
              <strong>{reschedulingTask.title}</strong>
            </p>

            <label style={{ display: "block", fontSize: 13, marginBottom: 4, fontWeight: 500 }}>
              New Target Date:
            </label>
            <input
              type="date"
              value={newDueDate}
              min={todayDate}
              onChange={(e) => setNewDueDate(e.target.value)}
              style={{
                width: "100%",
                padding: "8px 12px",
                marginBottom: 14,
                borderRadius: 8,
                border: "1px solid var(--border)",
              }}
            />

            <label style={{ display: "block", fontSize: 13, marginBottom: 4, fontWeight: 500 }}>
              Study Notes or Strategy (optional):
            </label>
            <textarea
              rows={3}
              value={rescheduleNotes}
              onChange={(e) => setRescheduleNotes(e.target.value)}
              placeholder="e.g. Will review textbook chapter 4 first before attempting this"
              style={{
                width: "100%",
                padding: "8px 12px",
                marginBottom: 20,
                borderRadius: 8,
                border: "1px solid var(--border)",
                resize: "vertical",
              }}
            />

            <div style={{ display: "flex", justifyContent: "flex-end", gap: 10 }}>
              <button
                type="button"
                className="btn secondary"
                onClick={() => setReschedulingTask(null)}
              >
                Cancel
              </button>
              <button
                type="button"
                className="btn"
                onClick={handleConfirmReschedule}
                disabled={!newDueDate}
              >
                Save Schedule
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Targeted Assessment Quiz Modal */}
      {quizModal.isOpen && (
        <TargetedAssessmentModal
          isOpen={quizModal.isOpen}
          onClose={() => setQuizModal({ isOpen: false })}
          initialTopic={quizModal.topic}
          initialSubjectId={quizModal.subjectId}
          initialSubjectName={quizModal.subjectName}
          initialSubjectEmoji={quizModal.subjectEmoji}
          initialMistakeTag={quizModal.mistakeTag}
          linkedRevisionTaskId={quizModal.linkedRevisionTaskId}
        />
      )}
    </div>
  );
}
