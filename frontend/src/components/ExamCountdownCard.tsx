import { Link } from "react-router-dom";
import { useExams } from "../hooks/useExams";
import { countdownText, daysUntil, syllabusProgress, urgency } from "../utils/exams";

export default function ExamCountdownCard() {
  const { exams } = useExams();
  const upcoming = exams.filter((e) => daysUntil(e.date) >= 0).slice(0, 2);
  const alert = upcoming.some((e) => daysUntil(e.date) <= 3);

  return (
    <section className={`card ${alert ? "exam-alert" : ""}`}>
      <h3>Exam countdown</h3>
      {upcoming.length === 0 ? (
        <p className="empty-note">No upcoming exams.</p>
      ) : (
        upcoming.map((e) => {
          const days = daysUntil(e.date);
          const progress = syllabusProgress(e);
          return (
            <div key={e.id} className="exam-mini">
              <div className="exam-mini-head">
                <strong>
                  {e.subjectEmoji} {e.name}
                </strong>
                <span className={`countdown-badge small cd-${urgency(days)}`}>
                  {countdownText(days)}
                </span>
              </div>
              {progress.total > 0 && (
                <>
                  <div className="progress">
                    <div className="progress-fill" style={{ width: `${progress.percent}%` }} />
                  </div>
                  <span className="muted">
                    {progress.done} of {progress.total} topics ready
                  </span>
                </>
              )}
            </div>
          );
        })
      )}
      <Link to="/exams" className="link-btn view-all">
        All exams →
      </Link>
    </section>
  );
}
