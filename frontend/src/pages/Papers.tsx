import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../hooks/useAuth";
import { usePapers } from "../hooks/usePapers";
import { deletePaper } from "../services/papers";
import type { Paper, PaperType } from "../types/paper";

export default function Papers() {
  const { user } = useAuth();
  const { papers, loading } = usePapers();
  const navigate = useNavigate();

  const [filterType, setFilterType] = useState<"all" | PaperType>("all");

  const filtered = papers.filter((p) => {
    if (filterType === "all") return true;
    return p.paperType === filterType;
  });

  const totalPapers = papers.length;
  const practiceCount = papers.filter((p) => p.paperType === "practice").length;
  const examCount = papers.filter((p) => p.paperType === "exam").length;

  const papersWithScores = papers.filter(
    (p) => typeof p.summary.percentage === "number" && p.summary.percentage !== null
  );
  const avgPercentage =
    papersWithScores.length > 0
      ? Math.round(
          papersWithScores.reduce((acc, curr) => acc + (curr.summary.percentage ?? 0), 0) /
            papersWithScores.length
        )
      : null;

  async function handleDelete(paper: Paper) {
    if (!user) return;
    if (window.confirm(`Are you sure you want to delete "${paper.title}"?`)) {
      await deletePaper(user.uid, paper.id);
    }
  }

  return (
    <div style={{ maxWidth: 900, margin: "0 auto", paddingBottom: 40 }}>
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          flexWrap: "wrap",
          gap: 12,
          marginBottom: 16,
        }}
      >
        <div>
          <h1 className="page-title" style={{ margin: 0, textAlign: "left" }}>
            Papers 📄
          </h1>
          <p style={{ color: "var(--muted, #888)", fontSize: 14, marginTop: 4 }}>
            Extract questions, record teacher & practice marks, and get targeted AI feedback.
          </p>
        </div>
        <div style={{ display: "flex", gap: 10 }}>
          <Link to="/exams" className="btn secondary" style={{ textDecoration: "none" }}>
            Exams 🎓
          </Link>
          <button className="btn" onClick={() => navigate("/papers/new")}>
            + Analyze Paper
          </button>
        </div>
      </div>

      <div className="stat-grid" style={{ marginBottom: 20 }}>
        <div className="card stat-card">
          <span className="stat-label">Total Papers</span>
          <span className="stat-big">{totalPapers}</span>
        </div>
        <div className="card stat-card">
          <span className="stat-label">Practice Papers</span>
          <span className="stat-big">{practiceCount}</span>
        </div>
        <div className="card stat-card">
          <span className="stat-label">Real Exams</span>
          <span className="stat-big">{examCount}</span>
        </div>
        <div className="card stat-card">
          <span className="stat-label">Average Score</span>
          <span className="stat-big">
            {avgPercentage !== null ? `${avgPercentage}%` : "—"}
          </span>
        </div>
      </div>

      <div style={{ display: "flex", gap: 8, marginBottom: 20 }}>
        <button
          className={`chip ${filterType === "all" ? "selected" : ""}`}
          onClick={() => setFilterType("all")}
        >
          All Papers ({totalPapers})
        </button>
        <button
          className={`chip ${filterType === "practice" ? "selected" : ""}`}
          onClick={() => setFilterType("practice")}
        >
          Practice ({practiceCount})
        </button>
        <button
          className={`chip ${filterType === "exam" ? "selected" : ""}`}
          onClick={() => setFilterType("exam")}
        >
          Real Exams ({examCount})
        </button>
      </div>

      {loading ? (
        <p>Loading papers…</p>
      ) : filtered.length === 0 ? (
        <div className="card" style={{ padding: "36px 20px", textAlign: "center" }}>
          <p className="empty-note" style={{ fontSize: 16, marginBottom: 14 }}>
            {filterType === "all"
              ? "No papers analyzed yet. Upload a past exam paper or practice set to get started! ✨"
              : `No ${filterType === "exam" ? "exam" : "practice"} papers found.`}
          </p>
          <button className="btn" onClick={() => navigate("/papers/new")}>
            Upload or Paste Your First Paper
          </button>
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          {filtered.map((paper) => {
            const hasTeacherMarks =
              typeof paper.summary.totalTeacherMarks === "number" &&
              paper.summary.totalTeacherMarks !== null;
            const hasStudentMarks =
              typeof paper.summary.totalStudentMarks === "number" &&
              paper.summary.totalStudentMarks !== null;
            const hasAiMarks =
              typeof paper.summary.totalAiEstimatedMarks === "number" &&
              paper.summary.totalAiEstimatedMarks !== null;

            return (
              <div
                key={paper.id}
                className="card"
                style={{
                  display: "flex",
                  flexDirection: "column",
                  gap: 12,
                  padding: 18,
                  position: "relative",
                }}
              >
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "flex-start",
                    flexWrap: "wrap",
                    gap: 10,
                  }}
                >
                  <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                      <span
                        style={{
                          fontSize: 11,
                          fontWeight: 700,
                          padding: "3px 8px",
                          borderRadius: 6,
                          background:
                            paper.paperType === "exam"
                              ? "rgba(170, 59, 255, 0.15)"
                              : "rgba(255, 138, 76, 0.18)",
                          color:
                            paper.paperType === "exam"
                              ? "var(--accent-purple, #9333ea)"
                              : "var(--accent, #ff7a30)",
                        }}
                      >
                        {paper.paperType === "exam" ? "Real Exam Paper" : "Practice Paper"}
                      </span>
                      {paper.subjectName && (
                        <span style={{ fontSize: 13, color: "var(--muted, #666)" }}>
                          {paper.subjectEmoji} {paper.subjectName}
                        </span>
                      )}
                      <span style={{ fontSize: 12, color: "var(--muted, #888)" }}>
                        {paper.date}
                      </span>
                    </div>
                    <h3 style={{ margin: "4px 0 0", fontSize: 18 }}>{paper.title}</h3>
                  </div>

                  <div style={{ textAlign: "right" }}>
                    {typeof paper.summary.percentage === "number" ? (
                      <div style={{ fontSize: 22, fontWeight: 800 }}>
                        {paper.summary.percentage}%
                      </div>
                    ) : (
                      <div style={{ fontSize: 13, color: "var(--muted, #888)" }}>
                        Score pending
                      </div>
                    )}
                    <div style={{ fontSize: 11, color: "var(--muted, #888)" }}>
                      {hasTeacherMarks
                        ? `Teacher: ${paper.summary.totalTeacherMarks}/${paper.summary.maxMarks}`
                        : hasStudentMarks
                        ? `Self-marked: ${paper.summary.totalStudentMarks}/${paper.summary.maxMarks}`
                        : hasAiMarks
                        ? `AI Est: ${paper.summary.totalAiEstimatedMarks}/${paper.summary.maxMarks}`
                        : `${paper.summary.totalQuestions} questions`}
                    </div>
                  </div>
                </div>

                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    flexWrap: "wrap",
                    gap: 10,
                    borderTop: "1px solid rgba(255, 138, 76, 0.12)",
                    paddingTop: 10,
                  }}
                >
                  <div style={{ display: "flex", gap: 12, fontSize: 13, color: "var(--muted, #666)" }}>
                    <span>{paper.questions?.length ?? 0} questions</span>
                    {paper.actionPlan && paper.actionPlan.length > 0 && (
                      <span style={{ color: "var(--accent, #ff7a30)", fontWeight: 600 }}>
                        🎯 {paper.actionPlan.length} action items
                      </span>
                    )}
                    <span
                      style={{
                        textTransform: "capitalize",
                        color: paper.status === "analyzed" ? "#16a34a" : "#ca8a04",
                        fontWeight: 600,
                      }}
                    >
                      ● {paper.status.replace(/_/g, " ")}
                    </span>
                  </div>

                  <div style={{ display: "flex", gap: 8 }}>
                    <button
                      className="btn secondary small"
                      onClick={() => navigate(`/papers/${paper.id}`)}
                    >
                      {paper.status === "analyzed" ? "View Analysis" : "Continue"}
                    </button>
                    <button
                      className="btn danger small"
                      onClick={() => handleDelete(paper)}
                      title="Delete paper"
                    >
                      Delete
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
