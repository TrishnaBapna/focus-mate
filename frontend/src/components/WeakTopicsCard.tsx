import { useState } from "react";
import { Link } from "react-router-dom";
import LogAssessmentModal from "./LogAssessmentModal";
import TargetedAssessmentModal from "./TargetedAssessmentModal";
import { useTopicPerformance } from "../hooks/useTopicPerformance";
import { getStatusBadgeClass, getStatusLabel } from "../utils/topicPerformance";
import type { TopicPerformance } from "../types/assessment";

type FilterTab = "all" | "needs_revision" | "improving" | "on_track" | "not_enough_data";

export default function WeakTopicsCard() {
  const {
    topics,
    weakTopics,
    improvingTopics,
    onTrackTopics,
    needsDataTopics,
    recommendations,
    loading,
    toggleReviewed,
    recordNewAssessment,
  } = useTopicPerformance();

  const [filter, setFilter] = useState<FilterTab>("needs_revision");
  const [showLogModal, setShowLogModal] = useState(false);
  const [modalDefaultTopic, setModalDefaultTopic] = useState("");
  const [modalDefaultSubjectId, setModalDefaultSubjectId] = useState("");
  const [togglingTopicKey, setTogglingTopicKey] = useState<string | null>(null);

  const [targetedQuizModal, setTargetedQuizModal] = useState<{
    isOpen: boolean;
    topic?: string;
    subjectId?: string;
    subjectName?: string;
    subjectEmoji?: string;
  }>({ isOpen: false });

  // Filter topics based on active tab
  const filteredTopics = topics.filter((t) => {
    if (filter === "all") return true;
    return t.status === filter;
  });

  // Recommendations expand/collapse state (top 4 by default)
  const [isRecsExpanded, setIsRecsExpanded] = useState(false);
  const displayedRecommendations = isRecsExpanded ? recommendations : recommendations.slice(0, 4);

  async function handleToggleReviewed(
    topicKey: string,
    topic: string,
    subjectId: string,
    currentStatus: boolean
  ) {
    setTogglingTopicKey(topicKey);
    try {
      await toggleReviewed(topicKey, topic, subjectId, !currentStatus);
    } finally {
      setTogglingTopicKey(null);
    }
  }

  function openLogModalForTopic(topic: string, subjectId: string) {
    setModalDefaultTopic(topic);
    setModalDefaultSubjectId(subjectId);
    setShowLogModal(true);
  }

  return (
    <section className="card weak-topics-card" aria-labelledby="weak-topics-heading">
      <div className="card-header-row">
        <div className="card-title-group">
          <h3 id="weak-topics-heading">⚡ Weak Topics & Revision</h3>
          {weakTopics.length > 0 && (
            <span className="pill badge-danger" title={`${weakTopics.length} topics need revision`}>
              {weakTopics.length} need attention
            </span>
          )}
        </div>
        <button
          type="button"
          className="btn small secondary"
          onClick={() => {
            setModalDefaultTopic("");
            setModalDefaultSubjectId("");
            setShowLogModal(true);
          }}
          title="Log a quiz or test score manually"
        >
          ➕ Log Score
        </button>
      </div>

      {loading ? (
        <div className="topic-card-loading">
          <p className="muted">Analyzing topic performance…</p>
        </div>
      ) : topics.length === 0 && recommendations.length === 0 ? (
        <div className="topic-empty-state">
          <div className="empty-icon">🎯</div>
          <h4>No assessment data yet</h4>
          <p className="muted">
            FocusMate analyzes your real quiz scores and flashcard reviews to detect weak spots and guide your revision before exams.
          </p>
          <div className="empty-actions">
            <Link to="/study" className="btn small">
              🃏 Practice Flashcards
            </Link>
            <button
              type="button"
              className="btn small secondary"
              onClick={() => setShowLogModal(true)}
            >
              📊 Log a Quiz Score
            </button>
          </div>
        </div>
      ) : (
        <>
          {/* 1. Smart Revision Recommendations */}
          {displayedRecommendations.length > 0 && (
            <div className="recs-section">
              <div className="section-subtitle">
                <span>🎯 Priority Recommendations</span>
                {recommendations.length > 4 && (
                  <span className="muted small" style={{ marginLeft: "auto" }}>
                    Showing {displayedRecommendations.length} of {recommendations.length}
                  </span>
                )}
              </div>
              <ul className="recs-list" id="recommendations-list">
                {displayedRecommendations.map((rec) => {
                  const isBusy = togglingTopicKey === rec.topicKey;
                  return (
                    <li
                      key={rec.id}
                      className={`rec-item ${rec.isReviewed ? "reviewed" : ""} ${rec.urgency}`}
                    >
                      <div className="rec-main">
                        <div className="rec-headline">
                          <span className="rec-emoji">{rec.subjectEmoji}</span>
                          <strong className="rec-topic">{rec.topic}</strong>
                          <span className="rec-subject muted">· {rec.subjectName}</span>
                          <span className={`pill small ${getUrgencyBadgeClass(rec.urgency)}`}>
                            {rec.urgency.toUpperCase()}
                          </span>
                          {rec.accuracyPercent !== null && (
                            <span className="rec-accuracy-pill">
                              {rec.accuracyPercent}% accuracy
                            </span>
                          )}
                        </div>

                        <p className="rec-reason">{rec.reason}</p>

                        <div className="rec-actions-row">
                          <button
                            type="button"
                            className={`chip small review-toggle-btn ${rec.isReviewed ? "selected" : ""}`}
                            disabled={isBusy}
                            onClick={() =>
                              void handleToggleReviewed(
                                rec.topicKey,
                                rec.topic,
                                rec.subjectId,
                                rec.isReviewed
                              )
                            }
                            title="Mark this topic as reviewed without changing historical scores"
                          >
                            {rec.isReviewed ? "✓ Reviewed" : "Mark as reviewed"}
                          </button>

                          <Link
                            to={`/notes?topic=${encodeURIComponent(rec.topic)}`}
                            className="link-action"
                            title="Find notes matching this topic"
                          >
                            📝 Notes
                          </Link>

                          <Link
                            to="/study"
                            className="link-action"
                            title="Practice flashcard decks"
                          >
                            🃏 Flashcards
                          </Link>

                          <button
                            type="button"
                            className="link-action"
                            style={{ color: "#9333ea", fontWeight: 700 }}
                            onClick={() =>
                              setTargetedQuizModal({
                                isOpen: true,
                                topic: rec.topic,
                                subjectId: rec.subjectId,
                                subjectName: rec.subjectName,
                                subjectEmoji: rec.subjectEmoji,
                              })
                            }
                            title="Take an academic practice quiz on this weak topic"
                          >
                            🎯 Practice Quiz
                          </button>

                          <button
                            type="button"
                            className="link-action log-link"
                            onClick={() => openLogModalForTopic(rec.topic, rec.subjectId)}
                            title="Log new quiz score for this topic"
                          >
                            ➕ Log score
                          </button>
                        </div>
                      </div>
                    </li>
                  );
                })}
              </ul>

              {recommendations.length > 4 && (
                <div style={{ textAlign: "center", marginTop: "10px" }}>
                  <button
                    type="button"
                    className="btn small secondary expand-recs-btn"
                    onClick={() => setIsRecsExpanded((prev) => !prev)}
                    aria-expanded={isRecsExpanded}
                    aria-controls="recommendations-list"
                  >
                    {isRecsExpanded
                      ? "▲ Show top 4 recommendations"
                      : `▼ Show all recommendations (${recommendations.length})`}
                  </button>
                </div>
              )}
            </div>
          )}

          {/* 2. Topic Performance Tracker */}
          <div className="topics-tracker-section">
            <div className="section-subtitle-row">
              <span className="section-subtitle">📊 Topic Accuracy Tracker</span>
            </div>

            <div className="mode-tabs topic-filter-tabs">
              <button
                type="button"
                className={`chip ${filter === "needs_revision" ? "selected" : ""}`}
                onClick={() => setFilter("needs_revision")}
              >
                ⚠️ Needs Revision ({weakTopics.length})
              </button>
              <button
                type="button"
                className={`chip ${filter === "improving" ? "selected" : ""}`}
                onClick={() => setFilter("improving")}
              >
                📈 Improving ({improvingTopics.length})
              </button>
              <button
                type="button"
                className={`chip ${filter === "on_track" ? "selected" : ""}`}
                onClick={() => setFilter("on_track")}
              >
                ✅ On Track ({onTrackTopics.length})
              </button>
              {needsDataTopics.length > 0 && (
                <button
                  type="button"
                  className={`chip ${filter === "not_enough_data" ? "selected" : ""}`}
                  onClick={() => setFilter("not_enough_data")}
                >
                  ℹ️ Needs Data ({needsDataTopics.length})
                </button>
              )}
              <button
                type="button"
                className={`chip ${filter === "all" ? "selected" : ""}`}
                onClick={() => setFilter("all")}
              >
                All ({topics.length})
              </button>
            </div>

            {filteredTopics.length === 0 ? (
              <p className="empty-note topic-tab-empty">
                {filter === "needs_revision"
                  ? "🎉 Great work! No topics currently flagged as weak."
                  : filter === "improving"
                    ? "No improving topics right now. Retake a quiz to see your progress!"
                    : "No topics match this category."}
              </p>
            ) : (
              <ul className="topic-perf-list">
                {filteredTopics.map((item) => (
                  <TopicRow
                    key={item.topicKey}
                    item={item}
                    onLogScore={() => openLogModalForTopic(item.topic, item.subjectId)}
                    onPracticeQuiz={() =>
                      setTargetedQuizModal({
                        isOpen: true,
                        topic: item.topic,
                        subjectId: item.subjectId,
                        subjectName: item.subjectName,
                        subjectEmoji: item.subjectEmoji,
                      })
                    }
                  />
                ))}
              </ul>
            )}
          </div>
        </>
      )}

      {showLogModal && (
        <LogAssessmentModal
          defaultTopic={modalDefaultTopic}
          defaultSubjectId={modalDefaultSubjectId}
          onClose={() => setShowLogModal(false)}
          onSave={recordNewAssessment}
        />
      )}

      {targetedQuizModal.isOpen && (
        <TargetedAssessmentModal
          isOpen={targetedQuizModal.isOpen}
          onClose={() => setTargetedQuizModal({ isOpen: false })}
          initialTopic={targetedQuizModal.topic}
          initialSubjectId={targetedQuizModal.subjectId}
          initialSubjectName={targetedQuizModal.subjectName}
          initialSubjectEmoji={targetedQuizModal.subjectEmoji}
        />
      )}
    </section>
  );
}

function TopicRow({
  item,
  onLogScore,
  onPracticeQuiz,
}: {
  item: TopicPerformance;
  onLogScore: () => void;
  onPracticeQuiz: () => void;
}) {
  const percent = Math.min(100, Math.max(0, Math.round(item.overallAccuracy * 100)));
  const recentPercent = Math.min(100, Math.max(0, Math.round(item.recentAccuracy * 100)));

  // Fill color based on status
  let barClass = "bar-accent";
  if (item.status === "on_track") barClass = "bar-success";
  else if (item.status === "needs_revision") barClass = "bar-danger";
  else if (item.status === "improving") barClass = "bar-warning";

  return (
    <li className="topic-perf-item">
      <div className="topic-perf-header">
        <div className="topic-name-wrap">
          <span className="topic-emoji">{item.subjectEmoji}</span>
          <strong className="topic-name">{item.topic}</strong>
          <span className="topic-subject muted">({item.subjectName})</span>
        </div>
        <div className="topic-badge-wrap">
          <span className={`pill small ${getStatusBadgeClass(item.status)}`}>
            {getStatusLabel(item.status)}
          </span>
          {item.trend === "improving" && (
            <span className="trend-badge" title="Performance is rising">
              📈 Up
            </span>
          )}
          {item.trend === "declining" && (
            <span className="trend-badge" title="Performance dropped on last attempt">
              📉 Down
            </span>
          )}
        </div>
      </div>

      <div className="topic-metrics-row">
        <div className="topic-progress-wrap">
          <div
            className="topic-progress-track"
            role="progressbar"
            aria-valuenow={item.status === "not_enough_data" ? 0 : percent}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-label={`${item.topic} accuracy: ${item.status === "not_enough_data" ? "not enough data" : `${percent}%`}`}
          >
            <div
              className={`topic-progress-fill ${barClass}`}
              style={{ width: `${item.status === "not_enough_data" ? 0 : percent}%` }}
            />
          </div>
          <span className="topic-pct-label">
            {item.status === "not_enough_data" ? "–" : `${percent}%`}
          </span>
        </div>

        <div className="topic-substats">
          <span>
            {item.totalCorrect}/{item.totalQuestions} correct · {item.totalAttempts} attempt
            {item.totalAttempts === 1 ? "" : "s"}
          </span>
          {item.totalAttempts >= 2 && (
            <span className="recent-badge">Last attempt: {recentPercent}%</span>
          )}
        </div>
      </div>

      <p className="topic-reason muted">{item.statusReason}</p>

      <div className="topic-item-foot">
        <Link
          to={`/notes?topic=${encodeURIComponent(item.topic)}`}
          className="link-action small"
        >
          Review Notes
        </Link>
        <button
          type="button"
          className="link-btn small"
          style={{ color: "#9333ea", fontWeight: 700 }}
          onClick={onPracticeQuiz}
          title="Take a practice quiz on this topic"
        >
          🎯 Practice Quiz
        </button>
        <button
          type="button"
          className="link-btn small"
          onClick={onLogScore}
          title="Add another quiz score for this topic"
        >
          + Add Attempt
        </button>
      </div>
    </li>
  );
}

function getUrgencyBadgeClass(urgency: string): string {
  switch (urgency) {
    case "urgent":
      return "badge-danger";
    case "high":
      return "badge-warning";
    case "medium":
      return "badge-lavender";
    default:
      return "badge-neutral";
  }
}
