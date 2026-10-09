import { useState } from "react";
import type { QuizQuestion } from "../types/ai";

export default function AiQuiz({ questions }: { questions: QuizQuestion[] }) {
  const [answers, setAnswers] = useState<(number | null)[]>(() => questions.map(() => null));

  const answered = answers.filter((a) => a !== null).length;
  const score = answers.filter((a, i) => a === questions[i].answerIndex).length;

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
        <p className="quiz-score">
          Score: {score} / {questions.length} {score === questions.length ? "🎉" : ""}
        </p>
      )}
    </div>
  );
}
