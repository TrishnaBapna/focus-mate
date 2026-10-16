import { formatStudyTime, formatTargetHours, type SubjectGoalProgress } from "../utils/goals";
import type { SubjectGoal } from "../types";

interface Props {
  item: SubjectGoalProgress;
  onEdit: (goal: SubjectGoal) => void;
  onRemove: (subjectId: string, subjectName: string) => void;
}

export default function SubjectGoalCard({ item, onEdit, onRemove }: Props) {
  const { subject, goal, targetHours, actualSeconds, remainingSeconds, progressPercent, isAchieved } = item;

  const actualTimeText = formatStudyTime(actualSeconds);
  const targetText = formatTargetHours(targetHours);
  const remainingTimeText = formatStudyTime(remainingSeconds);

  return (
    <div
      className={`card subject-goal-card ${isAchieved ? "goal-achieved" : ""}`}
      style={{ borderLeftColor: subject.color }}
    >
      <div className="goal-card-header">
        <div className="goal-subject-info">
          <span className="goal-subject-emoji">{subject.emoji}</span>
          <div className="goal-subject-text">
            <h3 className="goal-subject-name">{subject.name}</h3>
            <span className="goal-target-subtext">Weekly target: {targetText}</span>
          </div>
        </div>

        <div className="goal-badge-wrap">
          {isAchieved ? (
            <span className="goal-status-badge achieved">🎉 Goal Achieved!</span>
          ) : (
            <span className="goal-status-badge in-progress">{remainingTimeText} left</span>
          )}
        </div>
      </div>

      <div className="goal-card-body">
        <div className="goal-progress-stats">
          <div className="goal-stat-left">
            <span className="goal-actual-time">{actualTimeText}</span>
            <span className="goal-stat-divider">/</span>
            <span className="goal-target-time">{targetText}</span>
          </div>
          <span className={`goal-stat-percent ${isAchieved ? "text-success" : ""}`}>
            {progressPercent}%
          </span>
        </div>

        {/* Visual Progress Bar */}
        <div className="goal-progress-track">
          <div
            className={`goal-progress-fill ${isAchieved ? "fill-success" : ""}`}
            style={{
              width: `${Math.min(100, Math.max(actualSeconds > 0 ? 3 : 0, progressPercent))}%`,
              backgroundColor: isAchieved ? "#2f9e57" : subject.color || "var(--accent)",
            }}
          />
        </div>

        {isAchieved && actualSeconds > item.targetSeconds && (
          <p className="goal-extra-note">
            🌟 +{formatStudyTime(actualSeconds - item.targetSeconds)} beyond your weekly target!
          </p>
        )}
      </div>

      <div className="goal-card-footer">
        <button
          type="button"
          className="link-btn small"
          onClick={() => onEdit(goal)}
          title={`Edit target for ${subject.name}`}
        >
          ✏️ Edit target
        </button>
        <button
          type="button"
          className="link-btn small danger"
          onClick={() => onRemove(subject.id, subject.name)}
          title={`Remove target for ${subject.name}`}
        >
          🗑️ Remove
        </button>
      </div>
    </div>
  );
}
