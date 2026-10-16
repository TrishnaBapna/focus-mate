import { useEffect, useRef, useState } from "react";
import { useAuth } from "../hooks/useAuth";
import { addAssessment } from "../services/assessments";
import type { QuizQuestion } from "../types/ai";

export default function AiQuiz({
  questions,
  subjectId,
  subjectName,
  topic,
}: {
  questions: QuizQuestion[];
  subjectId?: string;
  subjectName?: string;
  topic?: string;
}) {
  const { user } = useAuth();
  const [answers, setAnswers] = useState<(number | null)[]>(() => questions.map(() => null));
  const [recorded, setRecorded] = useState(false);
  const recordedRef = useRef(false);

  const answered = answers.filter((a) => a !== null).length;
  const score = answers.filter((a, i) => a === questions[i].answerIndex).length;

  useEffect(() => {
    if (answered === questions.length && user && !recordedRef.current && questions.length > 0) {
      recordedRef.current = true;
      const targetTopic = (topic || subjectName || "General Quiz").trim();
      addAssessment(user.uid, {
        subjectId: subjectId || "",
        subjectName: subjectName || "General",
        topic: targetTopic,
        score,
        totalQuestions: questions.length,
        source: "quiz",
      })
        .then(() => setRecorded(true))
        .catch((err) => console.warn("Could not record quiz assessment:", err));
    }
  }, [answered, questions.length, user, topic, subjectId, subjectName, score]);

  return (
    <div className="ai-quiz">
      {questions.map((q, qi) => {
        const chosen = answers[qi];
        const revealed = chosen !== null;
        return (
          <div key={qi} className="quiz-q">
            <p>
              <strong>{qi + 1}.</strong> {q.question}
            </p>
            <div className="quiz-options">
              {q.options.map((option, oi) => {
                const state = !revealed
                  ? ""
                  : oi === q.answerIndex
                    ? "correct"
                    : oi === chosen
                      ? "wrong"
                      : "";
                return (
                  <button
                    key={oi}
                    className={`quiz-option ${state}`}
                    disabled={revealed}
                    onClick={() =>
                      setAnswers((prev) => prev.map((v, i) => (i === qi ? oi : v)))
                    }
                  >
                    {String.fromCharCode(65 + oi)}. {option}
                  </button>
                );
              })}
            </div>
            {revealed && (
              <p className="muted quiz-explain">
                {chosen === q.answerIndex ? "✅ Correct. " : "❌ Not quite. "}
                {q.explanation}
              </p>
            )}
          </div>
        );
      })}

      {answered === questions.length && (
        <div className="quiz-score-wrap">
          <p className="quiz-score">
            Score: {score} / {questions.length} ({Math.round((score / questions.length) * 100)}%){" "}
            {score === questions.length ? "🎉" : ""}
          </p>
          {recorded && (
            <span className="quiz-recorded-badge">
              ⚡ Recorded to Topic Analysis
            </span>
          )}
        </div>
      )}
    </div>
  );
}
