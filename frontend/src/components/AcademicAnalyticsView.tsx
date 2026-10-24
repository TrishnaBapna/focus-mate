import { useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../hooks/useAuth";
import { usePapers } from "../hooks/usePapers";
import { useSubjects } from "../hooks/useSubjects";
import { togglePaperActionItem } from "../services/papers.ts";
import TargetedAssessmentModal from "./TargetedAssessmentModal";
import {
  computeAcademicKpis,
  computeMistakeDistribution,
  computePaperScoreTimeline,
  computeSubjectAcademicBreakdown,
  computeTopicMasteryFromPapers,
} from "../utils/academicAnalytics.ts";

export default function AcademicAnalyticsView() {
  const { user } = useAuth();
  const { papers, loading: papersLoading } = usePapers();
  const { subjects, loading: subjectsLoading } = useSubjects();
  const navigate = useNavigate();

  const [togglingActionId, setTogglingActionId] = useState<string | null>(null);
  const [quizModal, setQuizModal] = useState<{
    isOpen: boolean;
    topic?: string;
    subjectId?: string;
    subjectName?: string;
    mistakeTag?: string;
  }>({ isOpen: false });

  const kpis = useMemo(() => computeAcademicKpis(papers), [papers]);
  const mistakes = useMemo(() => computeMistakeDistribution(papers), [papers]);
  const timeline = useMemo(() => computePaperScoreTimeline(papers), [papers]);
  const subjectStats = useMemo(
    () => computeSubjectAcademicBreakdown(papers, subjects),
    [papers, subjects]
  );
  const weakTopics = useMemo(() => {
    return computeTopicMasteryFromPapers(papers).filter((t) => t.needsAttention);
  }, [papers]);

  // Collect all action items across analyzed papers
  const allActionItems = useMemo(() => {
    const list: Array<{
      paperId: string;
      paperTitle: string;
      actionId: string;
      priority: "high" | "medium" | "low";
      topic: string;
      recommendation: string;
      actionType: "flashcards" | "revision" | "practice_quiz" | "read_notes";
      completed: boolean;
    }> = [];

    for (const p of papers) {
      if (Array.isArray(p.actionPlan)) {
        for (const a of p.actionPlan) {
          list.push({
            paperId: p.id,
            paperTitle: p.title,
            actionId: a.id,
            priority: a.priority,
            topic: a.topic,
            recommendation: a.recommendation,
            actionType: a.actionType,
            completed: a.completed,
          });
        }
      }
    }

    // Sort: uncompleted first, then by high priority
    const priorityWeight = { high: 3, medium: 2, low: 1 };
    return list.sort((a, b) => {
      if (a.completed !== b.completed) return a.completed ? 1 : -1;
      return (priorityWeight[b.priority] || 0) - (priorityWeight[a.priority] || 0);
    });
  }, [papers]);

  async function handleToggleAction(paperId: string, actionId: string, currentStatus: boolean) {
    if (!user) return;
    setTogglingActionId(actionId);
    try {
      await togglePaperActionItem(user.uid, paperId, actionId, !currentStatus);
    } catch (err) {
      console.error("Failed to toggle action item:", err);
    } finally {
      setTogglingActionId(null);
    }
  }

  const loading = papersLoading || subjectsLoading;

  if (loading) {
    return <p className="muted" style={{ padding: 20 }}>Loading academic analytics…</p>;
  }

  if (papers.length === 0) {
    return (
      <div className="card" style={{ padding: "40px 24px", textAlign: "center", margin: "20px 0" }}>
        <div style={{ fontSize: 44, marginBottom: 12 }}>📄🎓</div>
        <h3 style={{ margin: "0 0 8px" }}>No Academic Papers Analyzed Yet</h3>
        <p className="muted" style={{ maxWidth: 520, margin: "0 auto 20px", fontSize: 14 }}>
          Upload your past exam papers, question papers, or practice answers to generate evidence-based
          academic analytics, mistake distributions, and targeted revision plans.
        </p>
        <div style={{ display: "flex", gap: 12, justifyContent: "center", flexWrap: "wrap" }}>
          <button className="btn" onClick={() => navigate("/papers/new")}>
            + Analyze Your First Paper
          </button>
          <Link to="/exams" className="btn secondary" style={{ textDecoration: "none" }}>
            View Exams 🎓
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 24, marginTop: 12 }}>
      {/* 1. Academic KPI Grid */}
      <div className="stat-grid">
        <div className="card stat-card">
          <span className="stat-label">🎓 Exam Avg (Official)</span>
          <span className="stat-big">
            {kpis.examAverage !== null ? `${kpis.examAverage}%` : "—"}
          </span>
          <span className="muted change">
            {kpis.gradedExamsCount > 0
              ? `${kpis.gradedExamsCount} teacher-graded exams`
              : "No graded exams yet"}
          </span>
        </div>

        <div className="card stat-card">
          <span className="stat-label">📝 Practice Avg</span>
          <span className="stat-big">
            {kpis.practiceAverage !== null ? `${kpis.practiceAverage}%` : "—"}
          </span>
          <span className="muted change">
            {kpis.scoredPracticeCount > 0
              ? `${kpis.scoredPracticeCount} scored practice sets`
              : "No scored practice yet"}
          </span>
        </div>

        <div className="card stat-card">
          <span className="stat-label">📄 Papers Analyzed</span>
          <span className="stat-big">{kpis.totalPapers}</span>
          <span className="muted change">
            {kpis.totalQuestionsAnalyzed} questions evaluated
          </span>
        </div>

        <div className="card stat-card">
          <span className="stat-label">🎯 Action Items Completed</span>
          <span className="stat-big">{kpis.actionCompletionRate}%</span>
          <span className="muted change">
            {kpis.completedActionItems} of {kpis.totalActionItems} tasks completed
          </span>
        </div>
      </div>

      {/* 2. Mistake Pattern Analysis Card */}
      <section className="card" style={{ padding: 22 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: 10, marginBottom: 12 }}>
          <div>
            <h3 style={{ margin: 0, fontSize: 18 }}>⚠️ Mistake Pattern Distribution</h3>
            <p className="muted" style={{ margin: "4px 0 0", fontSize: 13 }}>
              Diagnosed from evaluated paper questions. Answers why marks were lost across subjects.
            </p>
          </div>
          <Link to="/papers" className="btn secondary small" style={{ textDecoration: "none" }}>
            View All Papers
          </Link>
        </div>

        {mistakes.length === 0 ? (
          <p className="muted" style={{ fontSize: 14, margin: "14px 0 0" }}>
            No mistake tags recorded yet. Run AI or self-evaluation on papers to populate diagnostic mistake insights.
          </p>
        ) : (
          <div>
            {/* Visual stacked bar */}
            <div
              style={{
                display: "flex",
                height: 18,
                borderRadius: 9,
                overflow: "hidden",
                margin: "14px 0 16px",
                background: "rgba(0,0,0,0.06)",
              }}
              title="Mistake distribution"
            >
              {mistakes.map((m) => (
                <div
                  key={m.tag}
                  style={{
                    width: `${m.percentage}%`,
                    background: m.color,
                    minWidth: m.percentage > 0 ? 6 : 0,
                  }}
                  title={`${m.label}: ${m.percentage}% (${m.count})`}
                />
              ))}
            </div>

            {/* Mistake Category Rows */}
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: 12 }}>
              {mistakes.map((m) => (
                <div
                  key={m.tag}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 12,
                    padding: "10px 14px",
                    borderRadius: 12,
                    background: "rgba(255, 138, 76, 0.06)",
                    border: "1px solid rgba(255, 138, 76, 0.15)",
                  }}
                >
                  <span
                    style={{
                      width: 14,
                      height: 14,
                      borderRadius: "50%",
                      background: m.color,
                      flexShrink: 0,
                    }}
                  />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                      <strong style={{ fontSize: 14 }}>{m.label}</strong>
                      <span style={{ fontSize: 13, fontWeight: 700, color: m.color }}>
                        {m.count} ({m.percentage}%)
                      </span>
                    </div>
                    <div style={{ fontSize: 11, color: "var(--muted, #666)", marginTop: 2 }}>
                      {m.description}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </section>

      {/* 3. Paper Score Evolution Timeline */}
      <section className="card" style={{ padding: 22 }}>
        <h3 style={{ margin: "0 0 6px", fontSize: 18 }}>📈 Paper Score Trajectory</h3>
        <p className="muted" style={{ margin: "0 0 16px", fontSize: 13 }}>
          Performance over time across real exam scripts and practice sets.
        </p>

        {timeline.length === 0 ? (
          <p className="muted" style={{ fontSize: 14 }}>No graded papers available for timeline yet.</p>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {timeline.map((point) => (
              <div
                key={point.id}
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  padding: "10px 14px",
                  borderRadius: 10,
                  background: point.isOfficial ? "rgba(170, 59, 255, 0.06)" : "rgba(255, 138, 76, 0.06)",
                  border: `1px solid ${point.isOfficial ? "rgba(170, 59, 255, 0.2)" : "rgba(255, 138, 76, 0.2)"}`,
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <span style={{ fontSize: 12, color: "var(--muted)", fontWeight: 600 }}>
                    {point.date}
                  </span>
                  <span
                    style={{
                      fontSize: 11,
                      fontWeight: 700,
                      padding: "2px 6px",
                      borderRadius: 4,
                      background: point.isOfficial ? "rgba(170, 59, 255, 0.15)" : "rgba(255, 138, 76, 0.15)",
                      color: point.isOfficial ? "#9333ea" : "#ff7a30",
                    }}
                  >
                    {point.isOfficial ? "Real Exam" : "Practice"}
                  </span>
                  <strong style={{ fontSize: 14 }}>{point.title}</strong>
                </div>

                <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                  <span style={{ fontSize: 16, fontWeight: 800 }}>
                    {point.percentage !== null ? `${point.percentage}%` : "Pending"}
                  </span>
                  <button
                    className="btn secondary small"
                    onClick={() => navigate(`/papers/${point.id}`)}
                  >
                    View
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* 4. Subject Academic Breakdown Matrix */}
      <section className="card" style={{ padding: 22 }}>
        <h3 style={{ margin: "0 0 6px", fontSize: 18 }}>📚 Subject Academic Breakdown</h3>
        <p className="muted" style={{ margin: "0 0 16px", fontSize: 13 }}>
          Exam and practice performance grouped by subject with top diagnosed mistake types.
        </p>

        {subjectStats.length === 0 ? (
          <p className="muted" style={{ fontSize: 14 }}>No subject-specific papers found.</p>
        ) : (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))", gap: 14 }}>
            {subjectStats.map((s) => (
              <div
                key={s.subjectId}
                style={{
                  border: "1px solid rgba(255, 138, 76, 0.2)",
                  borderRadius: 14,
                  padding: 16,
                  background: "var(--card)",
                  display: "flex",
                  flexDirection: "column",
                  gap: 8,
                }}
              >
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <span style={{ fontSize: 16, fontWeight: 700 }}>
                    {s.emoji} {s.name}
                  </span>
                  <span style={{ fontSize: 12, color: "var(--muted)" }}>
                    {s.totalPapers} {s.totalPapers === 1 ? "paper" : "papers"}
                  </span>
                </div>

                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginTop: 4 }}>
                  <div style={{ background: "rgba(170, 59, 255, 0.08)", padding: "8px 10px", borderRadius: 8 }}>
                    <div style={{ fontSize: 11, color: "#9333ea", fontWeight: 700 }}>Exam Avg</div>
                    <div style={{ fontSize: 16, fontWeight: 800, marginTop: 2 }}>
                      {s.examAverage !== null ? `${s.examAverage}%` : "—"}
                    </div>
                  </div>
                  <div style={{ background: "rgba(255, 138, 76, 0.08)", padding: "8px 10px", borderRadius: 8 }}>
                    <div style={{ fontSize: 11, color: "#ea580c", fontWeight: 700 }}>Practice Avg</div>
                    <div style={{ fontSize: 16, fontWeight: 800, marginTop: 2 }}>
                      {s.practiceAverage !== null ? `${s.practiceAverage}%` : "—"}
                    </div>
                  </div>
                </div>

                {s.topMistakeLabel && (
                  <div style={{ fontSize: 12, color: "#dc2626", marginTop: 4, fontWeight: 600 }}>
                    ⚠️ Most common slip: {s.topMistakeLabel}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </section>

      {/* 5. Diagnostic Hotspots & Weak Topics */}
      {weakTopics.length > 0 && (
        <section className="card" style={{ padding: 22 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
            <h3 style={{ margin: 0, fontSize: 18 }}>⚡ Topics Needing Revision (&lt; 65% Accuracy)</h3>
            <span className="pill badge-danger">{weakTopics.length} detected</span>
          </div>
          <p className="muted" style={{ margin: "0 0 14px", fontSize: 13 }}>
            Topics where marks were consistently lost on paper questions. Prioritize these in your study sessions.
          </p>

          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", gap: 12 }}>
            {weakTopics.map((t) => (
              <div
                key={t.topic}
                style={{
                  border: "1px solid rgba(239, 68, 68, 0.25)",
                  background: "rgba(239, 68, 68, 0.04)",
                  borderRadius: 12,
                  padding: 14,
                }}
              >
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <strong style={{ fontSize: 14 }}>{t.topic}</strong>
                  <span style={{ fontSize: 13, fontWeight: 800, color: "#dc2626" }}>
                    {t.accuracy}%
                  </span>
                </div>
                {t.subjectName && (
                  <div style={{ fontSize: 12, color: "var(--muted)", marginTop: 2 }}>
                    {t.subjectName}
                  </div>
                )}
                {t.topMistakeTag && (
                  <div style={{ fontSize: 11, color: "#b91c1c", marginTop: 6, fontWeight: 600 }}>
                    Frequent mistake: {t.topMistakeTag.replace(/_/g, " ")}
                  </div>
                )}
                <div style={{ marginTop: 10, display: "flex", justifyContent: "flex-end" }}>
                  <button
                    type="button"
                    className="btn small"
                    style={{ fontSize: 11, padding: "4px 8px" }}
                    onClick={() =>
                      setQuizModal({
                        isOpen: true,
                        topic: t.topic,
                        subjectName: t.subjectName,
                        mistakeTag: t.topMistakeTag ?? undefined,
                      })
                    }
                  >
                    🎯 Practice Quiz
                  </button>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* 6. Action Plan Tracker Across Papers */}
      {allActionItems.length > 0 && (
        <section className="card" style={{ padding: 22 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12, flexWrap: "wrap", gap: 8 }}>
            <div>
              <h3 style={{ margin: 0, fontSize: 18 }}>🎯 Targeted Action Plan Tracker</h3>
              <p className="muted" style={{ margin: "4px 0 0", fontSize: 13 }}>
                Grounded action recommendations generated from all your papers. Check items off as you revise.
              </p>
            </div>
            <span style={{ fontSize: 12, color: "var(--muted)" }}>
              {kpis.completedActionItems} / {kpis.totalActionItems} completed
            </span>
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {allActionItems.map((item) => (
              <div
                key={`${item.paperId}_${item.actionId}`}
                style={{
                  display: "flex",
                  alignItems: "flex-start",
                  gap: 12,
                  padding: "12px 14px",
                  borderRadius: 10,
                  background: item.completed ? "rgba(0,0,0,0.02)" : "rgba(255, 138, 76, 0.05)",
                  border: "1px solid rgba(255, 138, 76, 0.15)",
                  opacity: item.completed ? 0.65 : 1,
                }}
              >
                <input
                  type="checkbox"
                  checked={item.completed}
                  disabled={togglingActionId === item.actionId}
                  onChange={() => handleToggleAction(item.paperId, item.actionId, item.completed)}
                  style={{ marginTop: 3, cursor: "pointer" }}
                />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap", marginBottom: 4 }}>
                    <span
                      style={{
                        fontSize: 10,
                        fontWeight: 800,
                        padding: "2px 6px",
                        borderRadius: 4,
                        textTransform: "uppercase",
                        background:
                          item.priority === "high"
                            ? "#fecaca"
                            : item.priority === "medium"
                            ? "#fed7aa"
                            : "#e2e8f0",
                        color:
                          item.priority === "high"
                            ? "#991b1b"
                            : item.priority === "medium"
                            ? "#9a3412"
                            : "#334155",
                      }}
                    >
                      {item.priority}
                    </span>
                    <span
                      style={{
                        fontSize: 11,
                        background: "rgba(255, 138, 76, 0.15)",
                        padding: "2px 8px",
                        borderRadius: 6,
                        fontWeight: 600,
                      }}
                    >
                      {item.topic}
                    </span>
                    <span style={{ fontSize: 12, color: "var(--muted)" }}>
                      from {item.paperTitle}
                    </span>
                  </div>
                  <div
                    style={{
                      fontSize: 13,
                      lineHeight: 1.4,
                      textDecoration: item.completed ? "line-through" : "none",
                    }}
                  >
                    {item.recommendation}
                  </div>
                  <div style={{ marginTop: 8, display: "flex", justifyContent: "flex-end" }}>
                    <button
                      type="button"
                      className="btn small secondary"
                      style={{ fontSize: 11, padding: "3px 8px" }}
                      onClick={() =>
                        setQuizModal({
                          isOpen: true,
                          topic: item.topic,
                        })
                      }
                    >
                      🎯 Test Topic
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Targeted Assessment Quiz Modal */}
      {quizModal.isOpen && (
        <TargetedAssessmentModal
          isOpen={quizModal.isOpen}
          onClose={() => setQuizModal({ isOpen: false })}
          initialTopic={quizModal.topic}
          initialSubjectId={quizModal.subjectId}
          initialSubjectName={quizModal.subjectName}
          initialMistakeTag={quizModal.mistakeTag}
        />
      )}
    </div>
  );
}
