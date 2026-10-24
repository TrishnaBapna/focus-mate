import { useState, type FormEvent } from "react";
import { Link } from "react-router-dom";
import SubjectGoalCard from "../components/SubjectGoalCard";
import SubjectGoalModal from "../components/SubjectGoalModal";
import { useAchievements } from "../hooks/useAchievements";
import { useAuth } from "../hooks/useAuth";
import { useSubjectGoals } from "../hooks/useSubjectGoals";
import { useSubjects } from "../hooks/useSubjects";
import { addOrUpdateSubjectGoal, deleteSubjectGoal } from "../services/goals";
import { addSubject, deleteSubject } from "../services/subjects";
import type { Subject, SubjectGoal } from "../types";
import {
  computeSubjectGoals,
  formatStudyTime,
  formatTargetHours,
} from "../utils/goals";

const COLORS = ["#ffd6c2", "#ffe9a8", "#d4f1d9", "#d9ccff", "#cfe8ff", "#ffd1e1"];

export default function Subjects() {
  const { user } = useAuth();
  const { subjects, loading: subjectsLoading } = useSubjects();
  const { goals, loading: goalsLoading, error: goalsError } = useSubjectGoals();
  const { sessions, ready: sessionsReady } = useAchievements();

  // Tab: "goals" (Study Goals) | "subjects" (Manage Subjects)
  const [activeTab, setActiveTab] = useState<"goals" | "subjects">("goals");

  // New subject state
  const [name, setName] = useState("");
  const [emoji, setEmoji] = useState("📚");
  const [color, setColor] = useState(COLORS[0]);
  const [subjectSubmitting, setSubjectSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");

  // Goal modal state
  const [goalModalOpen, setGoalModalOpen] = useState(false);
  const [editingGoal, setEditingGoal] = useState<SubjectGoal | null>(null);
  const [targetSubjectId, setTargetSubjectId] = useState<string | undefined>(undefined);

  // Compute live weekly progress
  const { progressList, summary, unconfiguredSubjects } = computeSubjectGoals(
    subjects,
    goals,
    sessions
  );

  const loading = subjectsLoading || goalsLoading || !sessionsReady;

  async function handleAddSubject(e: FormEvent) {
    e.preventDefault();
    if (!user || !name.trim()) return;
    setSubjectSubmitting(true);
    setErrorMessage("");
    try {
      await addSubject(user.uid, { name: name.trim(), emoji, color });
      setName("");
    } catch (err) {
      console.error(err);
      setErrorMessage("Failed to add subject. Please try again.");
    } finally {
      setSubjectSubmitting(false);
    }
  }

  async function handleDeleteSubject(subject: Subject) {
    if (!user) return;
    const hasGoal = goals.some((g) => g.subjectId === subject.id);
    const confirmMsg = hasGoal
      ? `Delete "${subject.name}"? Its weekly study goal will also be removed. (Your completed study sessions will stay in your history).`
      : `Delete "${subject.name}"?`;

    if (!window.confirm(confirmMsg)) return;

    try {
      await deleteSubject(user.uid, subject.id);
    } catch (err) {
      console.error(err);
      setErrorMessage("Failed to delete subject.");
    }
  }

  function handleOpenCreateGoal(prefillSubjectId?: string) {
    setEditingGoal(null);
    setTargetSubjectId(prefillSubjectId);
    setGoalModalOpen(true);
  }

  function handleOpenEditGoal(goal: SubjectGoal) {
    setEditingGoal(goal);
    setTargetSubjectId(goal.subjectId);
    setGoalModalOpen(true);
  }

  async function handleSaveGoal(subjectId: string, hours: number) {
    if (!user) return;
    await addOrUpdateSubjectGoal(user.uid, subjectId, hours);
  }

  async function handleRemoveGoal(subjectId: string, subjectName: string) {
    if (!user) return;
    if (!window.confirm(`Remove weekly study target for ${subjectName}?`)) return;
    try {
      await deleteSubjectGoal(user.uid, subjectId);
    } catch (err) {
      console.error(err);
      setErrorMessage("Failed to remove study goal.");
    }
  }

  return (
    <>
      <div className="subjects-page-header">
        <div>
          <h1 className="page-title">Subjects & Goals 🎯</h1>
          <p className="page-subtitle">
            Configure subjects and track weekly study hours against your targets.
          </p>
        </div>

        <div className="header-actions" style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
          <Link
            to="/analytics"
            className="btn secondary"
            style={{ textDecoration: "none", display: "inline-flex", alignItems: "center", gap: 6 }}
          >
            📊 Analytics
          </Link>
          <button
            type="button"
            className="btn"
            onClick={() => handleOpenCreateGoal()}
            disabled={subjects.length === 0}
            title={subjects.length === 0 ? "Add a subject first" : "Set new study goal"}
          >
            + Set Study Goal
          </button>
        </div>
      </div>

      {/* Tab Switcher */}
      <div className="mode-tabs subjects-tabs">
        <button
          type="button"
          className={`chip ${activeTab === "goals" ? "selected" : ""}`}
          onClick={() => setActiveTab("goals")}
        >
          🎯 Weekly Goals ({progressList.length})
        </button>
        <button
          type="button"
          className={`chip ${activeTab === "subjects" ? "selected" : ""}`}
          onClick={() => setActiveTab("subjects")}
        >
          📚 All Subjects ({subjects.length})
        </button>
      </div>

      {errorMessage && (
        <div className="card alert-card error">
          <span>{errorMessage}</span>
          <button type="button" className="close-btn" onClick={() => setErrorMessage("")}>
            ✕
          </button>
        </div>
      )}

      {goalsError && (
        <div className="card alert-card error">
          <span>{goalsError}</span>
        </div>
      )}

      {/* ========================================================
          TAB 1: WEEKLY STUDY GOALS
          ======================================================== */}
      {activeTab === "goals" && (
        <div className="goals-tab-content">
          {/* Overall Weekly Progress Banner */}
          {progressList.length > 0 && (
            <section className="card weekly-summary-banner">
              <div className="banner-top">
                <div className="banner-title-group">
                  <span className="banner-badge">📅 Week of {summary.weekRange.label}</span>
                  <h2>Weekly Study Target Progress</h2>
                  <span className="banner-reset-note">
                    ⏱️ {summary.weekRange.daysRemaining} {summary.weekRange.daysRemaining === 1 ? "day" : "days"} remaining · Resets Monday 00:00
                  </span>
                </div>

                <div className="banner-stats-pill">
                  <div className="pill-item">
                    <span className="pill-val">
                      {formatStudyTime(summary.totalActualSeconds)}
                    </span>
                    <span className="pill-lbl">Focused</span>
                  </div>
                  <span className="pill-div">/</span>
                  <div className="pill-item">
                    <span className="pill-val">
                      {formatTargetHours(summary.totalTargetHours)}
                    </span>
                    <span className="pill-lbl">Goal</span>
                  </div>
                </div>
              </div>

              {/* Progress bar */}
              <div className="banner-progress-wrap">
                <div
                  className="banner-progress-track"
                  role="progressbar"
                  aria-valuenow={Math.min(100, Math.max(0, Math.round(summary.totalProgressPercent)))}
                  aria-valuemin={0}
                  aria-valuemax={100}
                  aria-label={`Overall weekly study target progress: ${summary.totalProgressPercent}%`}
                >
                  <div
                    className={`banner-progress-fill ${summary.allAchieved ? "fill-success" : ""}`}
                    style={{ width: `${Math.min(100, summary.totalProgressPercent)}%` }}
                  />
                </div>
                <div className="banner-progress-footer">
                  <span className="progress-pct-bold">
                    {summary.totalProgressPercent}% of total weekly target achieved
                  </span>
                  <span className="progress-remaining-text">
                    {summary.totalRemainingSeconds > 0
                      ? `${formatStudyTime(summary.totalRemainingSeconds)} remaining this week`
                      : "🎉 All targets achieved!"}
                  </span>
                </div>
              </div>
            </section>
          )}

          {/* Goal Cards Grid */}
          {loading ? (
            <p>Loading your study goals…</p>
          ) : progressList.length === 0 ? (
            <div className="card empty-goals-card">
              <div className="empty-goals-icon">🎯</div>
              <h3>No Study Goals Configured Yet</h3>
              <p>
                Set weekly hour targets for your subjects to build consistent study habits, avoid
                last-minute cramming, and track revision ahead of exams.
              </p>
              {subjects.length > 0 ? (
                <button
                  type="button"
                  className="btn"
                  onClick={() => handleOpenCreateGoal()}
                >
                  + Set Your First Study Goal
                </button>
              ) : (
                <button
                  type="button"
                  className="btn"
                  onClick={() => setActiveTab("subjects")}
                >
                  Create A Subject First
                </button>
              )}
            </div>
          ) : (
            <>
              <div className="goals-grid">
                {progressList.map((item) => (
                  <SubjectGoalCard
                    key={item.subject.id}
                    item={item}
                    onEdit={handleOpenEditGoal}
                    onRemove={handleRemoveGoal}
                  />
                ))}
              </div>

              {/* Unconfigured subjects reminder */}
              {unconfiguredSubjects.length > 0 && (
                <div className="card unconfigured-banner">
                  <div className="unconfigured-text">
                    <strong>More subjects without a target:</strong>
                    <div className="unconfigured-chips">
                      {unconfiguredSubjects.map((s) => (
                        <button
                          key={s.id}
                          type="button"
                          className="chip small"
                          onClick={() => handleOpenCreateGoal(s.id)}
                          title={`Set weekly target for ${s.name}`}
                        >
                          {s.emoji} {s.name} <span className="plus-sym">+</span>
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      )}

      {/* ========================================================
          TAB 2: ALL SUBJECTS & MANAGEMENT
          ======================================================== */}
      {activeTab === "subjects" && (
        <div className="subjects-tab-content">
          <form className="card subject-form" onSubmit={handleAddSubject}>
            <h3>Add New Subject</h3>
            <div className="subject-form-row">
              <input
                className="emoji-input"
                value={emoji}
                onChange={(e) => setEmoji(e.target.value)}
                maxLength={2}
                aria-label="Emoji"
              />
              <input
                className="name-input"
                placeholder="Subject name (e.g. Mathematics)"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
              />
            </div>
            <div className="swatches">
              {COLORS.map((c) => (
                <button
                  key={c}
                  type="button"
                  className={`swatch ${c === color ? "selected" : ""}`}
                  style={{ background: c }}
                  onClick={() => setColor(c)}
                  aria-label={`Colour ${c}`}
                />
              ))}
            </div>
            <button className="btn" type="submit" disabled={subjectSubmitting}>
              {subjectSubmitting ? "Adding…" : "Add Subject"}
            </button>
          </form>

          {loading ? (
            <p>Loading subjects…</p>
          ) : subjects.length === 0 ? (
            <p className="empty-note">No subjects yet. Add your first one above ✨</p>
          ) : (
            <div className="subject-grid">
              {subjects.map((s) => {
                const existingGoal = goals.find((g) => g.subjectId === s.id);
                return (
                  <div key={s.id} className="card subject-card" style={{ background: s.color }}>
                    <div className="subject-card-top">
                      <span className="subject-emoji">{s.emoji}</span>
                      <span className="subject-name">{s.name}</span>
                      <button
                        className="delete-btn"
                        title="Delete subject"
                        onClick={() => handleDeleteSubject(s)}
                      >
                        ✕
                      </button>
                    </div>

                    <div className="subject-card-bottom" style={{ display: "flex", flexWrap: "wrap", gap: 6, alignItems: "center" }}>
                      {existingGoal ? (
                        <button
                          type="button"
                          className="subject-goal-chip active"
                          onClick={() => handleOpenEditGoal(existingGoal)}
                          title="Edit weekly goal"
                        >
                          🎯 {formatTargetHours(existingGoal.targetHours)} / wk
                        </button>
                      ) : (
                        <button
                          type="button"
                          className="subject-goal-chip"
                          onClick={() => handleOpenCreateGoal(s.id)}
                          title="Set weekly goal"
                        >
                          + Set target
                        </button>
                      )}
                      <Link
                        to={`/focus?subject=${s.id}`}
                        className="subject-goal-chip"
                        style={{ textDecoration: "none" }}
                        title={`Focus on ${s.name}`}
                      >
                        ⏱️ Focus
                      </Link>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Goal Modal */}
      {goalModalOpen && (
        <SubjectGoalModal
          subjects={subjects}
          initialGoal={editingGoal}
          initialSubjectId={targetSubjectId}
          onClose={() => {
            setGoalModalOpen(false);
            setEditingGoal(null);
            setTargetSubjectId(undefined);
          }}
          onSave={handleSaveGoal}
        />
      )}
    </>
  );
}
