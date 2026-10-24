import { useState, useEffect } from "react";
import { useAuth } from "../hooks/useAuth";
import { useSubjects } from "../hooks/useSubjects";
import { useAiSettings } from "../hooks/useAiSettings";
import { askAi } from "../services/ai";
import { addAssessment, listenToAssessments } from "../services/assessments";
import { addDeck, addCards } from "../services/study";
import { todayKey } from "../utils/study";
import { setRevisionTaskStatus } from "../services/revisionPlanner";
import {
  evaluateTargetedAssessment,
  compareAssessmentAttempts,
  getFallbackTargetedQuestions,
  buildTargetedQuizPrompt,
  parseTargetedQuizResponse,
} from "../utils/targetedAssessment";
import type {
  TargetedQuestion,
  StudentAnswer,
  QuestionGradingResult,
  RetestComparison,
  AssessmentResult,
} from "../types/assessment";
import type { PaperMistakeTag } from "../types/paper";

interface TargetedAssessmentModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialTopic?: string;
  initialSubjectId?: string;
  initialSubjectName?: string;
  initialSubjectEmoji?: string;
  initialMistakeTag?: PaperMistakeTag | string;
  linkedRevisionTaskId?: string;
  onAssessmentCompleted?: (result: { score: number; accuracy: number }) => void;
}

type ModalStep =
  | "setup"
  | "generating"
  | "answering"
  | "confirm_submit"
  | "evaluating"
  | "results";

export default function TargetedAssessmentModal({
  isOpen,
  onClose,
  initialTopic = "",
  initialSubjectId = "",
  initialSubjectName = "",
  initialSubjectEmoji = "",
  initialMistakeTag,
  linkedRevisionTaskId,
  onAssessmentCompleted,
}: TargetedAssessmentModalProps) {
  const { user } = useAuth();
  const { subjects } = useSubjects();
  const { provider, apiKey, model } = useAiSettings();

  // Assessment Config State
  const [topic, setTopic] = useState(initialTopic);
  const [subjectId, setSubjectId] = useState(initialSubjectId);
  const [questionCount, setQuestionCount] = useState<number>(3);
  const [difficulty, setDifficulty] = useState<"foundational" | "standard" | "challenge">("standard");
  const [mistakeTag, setMistakeTag] = useState<string>(initialMistakeTag || "");

  // Assessment Runtime State
  const [step, setStep] = useState<ModalStep>("setup");
  const [questions, setQuestions] = useState<TargetedQuestion[]>([]);
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [answers, setAnswers] = useState<Record<string, StudentAnswer>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [usedFallbackNotice, setUsedFallbackNotice] = useState(false);

  // Results State
  const [gradingResults, setGradingResults] = useState<QuestionGradingResult[]>([]);
  const [totalEarned, setTotalEarned] = useState(0);
  const [totalMax, setTotalMax] = useState(0);
  const [accuracy, setAccuracy] = useState(0);
  const [retestComparison, setRetestComparison] = useState<RetestComparison | null>(null);
  const [pastAttempts, setPastAttempts] = useState<AssessmentResult[]>([]);

  // Follow-up Actions State
  const [deckCreated, setDeckCreated] = useState(false);
  const [deckCreating, setDeckCreating] = useState(false);
  const [taskMarkedDone, setTaskMarkedDone] = useState(false);

  // Load past assessments for real-time comparison
  useEffect(() => {
    if (!user || !isOpen) return;
    const unsub = listenToAssessments(user.uid, (list) => {
      setPastAttempts(list);
    });
    return () => unsub();
  }, [user, isOpen]);

  if (!isOpen) return null;

  const currentSubject =
    subjects.find((s) => s.id === subjectId) || {
      id: subjectId,
      name: initialSubjectName || "General",
      emoji: initialSubjectEmoji || "📚",
    };

  // -------------------------------------------------------------
  // Step 1: Generate Questions
  // -------------------------------------------------------------
  async function handleStartAssessment() {
    if (!topic.trim()) {
      setErrorMessage("Please enter a topic to test.");
      return;
    }

    setErrorMessage("");
    setStep("generating");

    const subjectName = currentSubject.name || "General";

    // Attempt AI Generation if API key or platform proxy available
    let generated: TargetedQuestion[];
    let fallbackUsed = false;

    try {
      const prompt = buildTargetedQuizPrompt(
        topic.trim(),
        subjectName,
        questionCount,
        difficulty,
        mistakeTag || undefined
      );

      const responseText = await askAi({
        provider,
        apiKey,
        model,
        system: "You are an expert academic tutor and exam designer. Generate rigorous, clear practice questions formatted as JSON.",
        prompt,
        maxTokens: 1200,
        json: true,
      });

      generated = parseTargetedQuizResponse(responseText);
    } catch {
      // Graceful fallback to curriculum bank
      generated = getFallbackTargetedQuestions(
        topic.trim(),
        subjectName,
        mistakeTag || undefined,
        questionCount
      );
      fallbackUsed = true;
    }

    if (!generated || generated.length === 0) {
      generated = getFallbackTargetedQuestions(
        topic.trim(),
        subjectName,
        mistakeTag || undefined,
        questionCount
      );
      fallbackUsed = true;
    }

    setQuestions(generated);
    setUsedFallbackNotice(fallbackUsed);
    setCurrentQuestionIndex(0);
    setAnswers({});
    setStep("answering");
  }

  // -------------------------------------------------------------
  // Step 2: Answering Handlers
  // -------------------------------------------------------------
  const currentQ = questions[currentQuestionIndex];

  function handleAnswerMcq(index: number) {
    if (!currentQ) return;
    setAnswers((prev) => ({
      ...prev,
      [currentQ.id]: {
        ...prev[currentQ.id],
        selectedOptionIndex: index,
      },
    }));
  }

  function handleAnswerNumerical(val: number | undefined) {
    if (!currentQ) return;
    setAnswers((prev) => ({
      ...prev,
      [currentQ.id]: {
        ...prev[currentQ.id],
        numericValue: val,
      },
    }));
  }

  function handleAnswerShort(text: string) {
    if (!currentQ) return;
    setAnswers((prev) => ({
      ...prev,
      [currentQ.id]: {
        ...prev[currentQ.id],
        textAnswer: text,
      },
    }));
  }

  function handleToggleFlag() {
    if (!currentQ) return;
    setAnswers((prev) => ({
      ...prev,
      [currentQ.id]: {
        ...prev[currentQ.id],
        isFlagged: !prev[currentQ.id]?.isFlagged,
      },
    }));
  }

  const answeredCount = questions.filter((q) => {
    const ans = answers[q.id];
    if (!ans) return false;
    if (q.type === "mcq") return typeof ans.selectedOptionIndex === "number";
    if (q.type === "numerical") return typeof ans.numericValue === "number" && !isNaN(ans.numericValue);
    return typeof ans.textAnswer === "string" && ans.textAnswer.trim().length > 0;
  }).length;

  // -------------------------------------------------------------
  // Step 3: Submission & Evaluation
  // -------------------------------------------------------------
  async function handleSubmitAssessment() {
    if (isSubmitting) return;
    setIsSubmitting(true);
    setStep("evaluating");

    try {
      const evaluation = evaluateTargetedAssessment(questions, answers);
      setGradingResults(evaluation.results);
      setTotalEarned(evaluation.totalEarned);
      setTotalMax(evaluation.totalMax);
      setAccuracy(evaluation.accuracy);

      // Compare against past attempts
      const comparison = compareAssessmentAttempts(
        evaluation.accuracy,
        pastAttempts,
        topic.trim()
      );
      setRetestComparison(comparison);

      // Save immutable record to /users/{uid}/assessments
      if (user) {
        await addAssessment(user.uid, {
          subjectId: subjectId || "",
          subjectName: currentSubject.name,
          subjectEmoji: currentSubject.emoji,
          topic: topic.trim(),
          score: evaluation.totalEarned,
          totalQuestions: evaluation.totalMax,
          source: "quiz",
          incorrectAnswers: evaluation.incorrectSummaries,
        });
      }

      onAssessmentCompleted?.({
        score: evaluation.totalEarned,
        accuracy: evaluation.accuracy,
      });

      setStep("results");
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : "Error evaluating assessment.");
      setStep("answering");
    } finally {
      setIsSubmitting(false);
    }
  }

  // -------------------------------------------------------------
  // Step 4: Follow-up Actions (Flashcards, Task Completion, Retest)
  // -------------------------------------------------------------
  async function handleCreateFlashcards() {
    if (!user || deckCreating || deckCreated) return;
    setDeckCreating(true);

    try {
      // Find questions answered incorrectly or partially
      const missed = questions.filter((q) => {
        const res = gradingResults.find((r) => r.questionId === q.id);
        return !res || !res.isCorrect;
      });

      const cardsToCreate = (missed.length > 0 ? missed : questions).map((q) => {
        const res = gradingResults.find((r) => r.questionId === q.id);
        return {
          front: `${q.prompt}${q.options ? `\n\nOptions:\n${q.options.map((o, i) => `${String.fromCharCode(65 + i)}. ${o}`).join("\n")}` : ""}`,
          back: `Answer: ${res?.correctAnswerDisplay || "See notes"}\n\nExplanation: ${q.explanation}`,
        };
      });

      const deckName = `${currentSubject.name}: ${topic.trim()} (Practice)`;
      const deckRef = await addDeck(user.uid, {
        name: deckName,
        subjectId: subjectId || "",
        subjectName: currentSubject.name,
        subjectEmoji: currentSubject.emoji,
      });

      await addCards(user.uid, deckRef.id, cardsToCreate, todayKey());
      setDeckCreated(true);
    } catch (err) {
      console.error("Error creating flashcards:", err);
    } finally {
      setDeckCreating(false);
    }
  }

  async function handleCompleteLinkedTask() {
    if (!user || !linkedRevisionTaskId || taskMarkedDone) return;
    try {
      await setRevisionTaskStatus(user.uid, linkedRevisionTaskId, "completed");
      setTaskMarkedDone(true);
    } catch (err) {
      console.error("Error marking linked task done:", err);
    }
  }

  function handleRetestAgain() {
    setStep("setup");
    setQuestions([]);
    setAnswers({});
    setGradingResults([]);
    setDeckCreated(false);
    setTaskMarkedDone(false);
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      style={{
        position: "fixed",
        inset: 0,
        backgroundColor: "rgba(0, 0, 0, 0.65)",
        backdropFilter: "blur(4px)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        zIndex: 1000,
        padding: 16,
      }}
    >
      <div
        className="card"
        style={{
          width: "100%",
          maxWidth: 680,
          maxHeight: "90vh",
          display: "flex",
          flexDirection: "column",
          borderRadius: 16,
          boxShadow: "0 20px 40px rgba(0,0,0,0.3)",
          overflow: "hidden",
          padding: 0,
          background: "var(--card)",
        }}
      >
        {/* Modal Header */}
        <div
          style={{
            padding: "16px 20px",
            borderBottom: "1px solid var(--border)",
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <span style={{ fontSize: 22 }}>🎯</span>
            <div>
              <h3 style={{ margin: 0, fontSize: 18 }}>Targeted Practice Assessment</h3>
              <span className="muted" style={{ fontSize: 12 }}>
                {topic ? `${currentSubject.emoji} ${currentSubject.name} · ${topic}` : "Custom Diagnostic Quiz"}
              </span>
            </div>
          </div>
          <button
            type="button"
            className="btn small secondary"
            onClick={onClose}
            aria-label="Close modal"
            style={{ borderRadius: "50%", width: 32, height: 32, padding: 0 }}
          >
            ✕
          </button>
        </div>

        {/* Modal Body */}
        <div style={{ padding: 20, overflowY: "auto", flex: 1 }}>
          {errorMessage && (
            <div
              style={{
                background: "rgba(239, 68, 68, 0.1)",
                color: "#dc2626",
                padding: "10px 14px",
                borderRadius: 8,
                marginBottom: 16,
                fontSize: 13,
              }}
            >
              ⚠️ {errorMessage}
            </div>
          )}

          {/* ========================================================= */}
          {/* STEP 1: SETUP */}
          {/* ========================================================= */}
          {step === "setup" && (
            <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
              <div>
                <label style={{ display: "block", fontSize: 13, fontWeight: 600, marginBottom: 6 }}>
                  Topic to Practice
                </label>
                <input
                  type="text"
                  value={topic}
                  onChange={(e) => setTopic(e.target.value)}
                  placeholder="e.g. Doppler Effect, Integration by Parts, Stoichiometry"
                  style={{ width: "100%", padding: "10px 12px", borderRadius: 8, border: "1px solid var(--border)" }}
                />
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                <div>
                  <label style={{ display: "block", fontSize: 13, fontWeight: 600, marginBottom: 6 }}>
                    Subject
                  </label>
                  <select
                    value={subjectId}
                    onChange={(e) => setSubjectId(e.target.value)}
                    style={{ width: "100%", padding: "10px 12px", borderRadius: 8, border: "1px solid var(--border)" }}
                  >
                    <option value="">General / Unassigned</option>
                    {subjects.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.emoji} {s.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label style={{ display: "block", fontSize: 13, fontWeight: 600, marginBottom: 6 }}>
                    Targeted Mistake Focus
                  </label>
                  <select
                    value={mistakeTag}
                    onChange={(e) => setMistakeTag(e.target.value)}
                    style={{ width: "100%", padding: "10px 12px", borderRadius: 8, border: "1px solid var(--border)" }}
                  >
                    <option value="">All question types (Comprehensive)</option>
                    <option value="conceptual">Conceptual Understanding</option>
                    <option value="calculation">Calculation & Arithmetic</option>
                    <option value="misread_question">Question Constraints & Reading</option>
                    <option value="incomplete_step">Step-by-step Working</option>
                  </select>
                </div>
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                <div>
                  <label style={{ display: "block", fontSize: 13, fontWeight: 600, marginBottom: 6 }}>
                    Question Count
                  </label>
                  <div style={{ display: "flex", gap: 8 }}>
                    {[3, 4, 5].map((cnt) => (
                      <button
                        key={cnt}
                        type="button"
                        className={`chip ${questionCount === cnt ? "selected" : ""}`}
                        style={{ flex: 1, textAlign: "center" }}
                        onClick={() => setQuestionCount(cnt)}
                      >
                        {cnt} Questions
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <label style={{ display: "block", fontSize: 13, fontWeight: 600, marginBottom: 6 }}>
                    Difficulty Level
                  </label>
                  <div style={{ display: "flex", gap: 8 }}>
                    {(["foundational", "standard", "challenge"] as const).map((lvl) => (
                      <button
                        key={lvl}
                        type="button"
                        className={`chip ${difficulty === lvl ? "selected" : ""}`}
                        style={{ flex: 1, textAlign: "center", textTransform: "capitalize" }}
                        onClick={() => setDifficulty(lvl)}
                      >
                        {lvl}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              {/* Status and Mode Notice */}
              <div
                style={{
                  background: apiKey ? "rgba(16, 185, 129, 0.08)" : "rgba(255, 138, 76, 0.08)",
                  border: `1px solid ${apiKey ? "rgba(16, 185, 129, 0.25)" : "rgba(255, 138, 76, 0.25)"}`,
                  borderRadius: 10,
                  padding: "12px 14px",
                  fontSize: 12,
                  display: "flex",
                  alignItems: "center",
                  gap: 8,
                }}
              >
                <span>{apiKey ? "🤖" : "📚"}</span>
                <div>
                  <strong>{apiKey ? `AI Generator Ready (${provider})` : "Curated Curriculum Mode"}</strong>
                  <p style={{ margin: "2px 0 0", color: "var(--muted)" }}>
                    {apiKey
                      ? "Custom questions will be generated targeting your selected topic and mistake pattern."
                      : "Questions will be provided from the verified curriculum question bank. Add an AI API key anytime in Settings for unlimited dynamic variants."}
                  </p>
                </div>
              </div>

              {/* Integrity Reminder */}
              <p className="muted" style={{ fontSize: 12, margin: "4px 0 0" }}>
                🔒 <strong>Academic Score Isolation:</strong> Practice quiz marks update your topic mastery analytics but are strictly kept separate from your official teacher exam scores.
              </p>
            </div>
          )}

          {/* ========================================================= */}
          {/* STEP 2: GENERATING SPINNER */}
          {/* ========================================================= */}
          {step === "generating" && (
            <div style={{ textAlign: "center", padding: "40px 20px" }}>
              <div style={{ fontSize: 36, marginBottom: 12 }}>⚡</div>
              <h4 style={{ margin: "0 0 6px" }}>Preparing Assessment…</h4>
              <p className="muted" style={{ fontSize: 14 }}>
                Crafting {questionCount} targeted questions for &quot;{topic}&quot;.
              </p>
            </div>
          )}

          {/* ========================================================= */}
          {/* STEP 3: ANSWERING QUESTIONS */}
          {/* ========================================================= */}
          {step === "answering" && currentQ && (
            <div>
              {usedFallbackNotice && (
                <div
                  style={{
                    background: "rgba(255, 138, 76, 0.1)",
                    color: "#ea580c",
                    padding: "6px 10px",
                    borderRadius: 6,
                    fontSize: 11,
                    marginBottom: 12,
                    display: "inline-block",
                  }}
                >
                  ℹ️ Curated curriculum bank questions loaded
                </div>
              )}

              {/* Question Navigation Bar */}
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  marginBottom: 16,
                  paddingBottom: 10,
                  borderBottom: "1px solid var(--border)",
                }}
              >
                <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
                  {questions.map((q, idx) => {
                    const ans = answers[q.id];
                    const isAnswered =
                      ans &&
                      ((q.type === "mcq" && typeof ans.selectedOptionIndex === "number") ||
                        (q.type === "numerical" && typeof ans.numericValue === "number" && !isNaN(ans.numericValue)) ||
                        (q.type === "short_answer" && typeof ans.textAnswer === "string" && ans.textAnswer.trim().length > 0));
                    const isFlagged = ans?.isFlagged;
                    const isCurrent = idx === currentQuestionIndex;

                    return (
                      <button
                        key={q.id}
                        type="button"
                        onClick={() => setCurrentQuestionIndex(idx)}
                        style={{
                          width: 28,
                          height: 28,
                          borderRadius: "50%",
                          border: isCurrent ? "2px solid var(--accent)" : "1px solid var(--border)",
                          background: isFlagged
                            ? "#fef08a"
                            : isAnswered
                            ? "rgba(16, 185, 129, 0.2)"
                            : "var(--card)",
                          color: isFlagged ? "#854d0e" : isAnswered ? "#065f46" : "var(--text)",
                          fontWeight: 700,
                          fontSize: 12,
                          cursor: "pointer",
                        }}
                        title={`Question ${idx + 1}${isFlagged ? " (Flagged)" : ""}${isAnswered ? " (Answered)" : ""}`}
                      >
                        {idx + 1}
                      </button>
                    );
                  })}
                </div>

                <button
                  type="button"
                  className="chip small"
                  onClick={handleToggleFlag}
                  style={{
                    background: answers[currentQ.id]?.isFlagged ? "#fef08a" : "transparent",
                    color: answers[currentQ.id]?.isFlagged ? "#854d0e" : "var(--muted)",
                  }}
                >
                  {answers[currentQ.id]?.isFlagged ? "🚩 Flagged for review" : "⚐ Flag question"}
                </button>
              </div>

              {/* Question Header */}
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
                <span
                  style={{
                    fontSize: 11,
                    fontWeight: 700,
                    textTransform: "uppercase",
                    padding: "2px 8px",
                    borderRadius: 4,
                    background:
                      currentQ.type === "mcq"
                        ? "rgba(59, 130, 246, 0.1)"
                        : currentQ.type === "numerical"
                        ? "rgba(245, 158, 11, 0.1)"
                        : "rgba(168, 85, 247, 0.1)",
                    color:
                      currentQ.type === "mcq"
                        ? "#2563eb"
                        : currentQ.type === "numerical"
                        ? "#d97706"
                        : "#9333ea",
                  }}
                >
                  {currentQ.type === "mcq"
                    ? "Multiple Choice"
                    : currentQ.type === "numerical"
                    ? "Numerical Problem"
                    : "Conceptual Short Answer"}
                </span>
                <span className="muted" style={{ fontSize: 12 }}>
                  Question {currentQuestionIndex + 1} of {questions.length}
                </span>
              </div>

              {/* Prompt */}
              <h4 style={{ fontSize: 16, lineHeight: 1.5, margin: "0 0 16px" }}>
                {currentQ.prompt}
              </h4>

              {/* Dynamic Answer Inputs */}
              {currentQ.type === "mcq" && currentQ.options && (
                <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                  {currentQ.options.map((opt, oIdx) => {
                    const isSelected = answers[currentQ.id]?.selectedOptionIndex === oIdx;
                    return (
                      <div
                        key={oIdx}
                        onClick={() => handleAnswerMcq(oIdx)}
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: 12,
                          padding: "12px 14px",
                          borderRadius: 10,
                          border: isSelected ? "2px solid var(--accent)" : "1px solid var(--border)",
                          background: isSelected ? "rgba(255, 138, 76, 0.08)" : "var(--card)",
                          cursor: "pointer",
                          transition: "all 0.15s ease",
                        }}
                      >
                        <span
                          style={{
                            width: 24,
                            height: 24,
                            borderRadius: "50%",
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            background: isSelected ? "var(--accent)" : "rgba(0,0,0,0.06)",
                            color: isSelected ? "#fff" : "var(--text)",
                            fontWeight: 700,
                            fontSize: 12,
                          }}
                        >
                          {String.fromCharCode(65 + oIdx)}
                        </span>
                        <span style={{ fontSize: 14 }}>{opt}</span>
                      </div>
                    );
                  })}
                </div>
              )}

              {currentQ.type === "numerical" && (
                <div>
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <input
                      type="number"
                      step="any"
                      placeholder="Enter numerical value"
                      value={answers[currentQ.id]?.numericValue ?? ""}
                      onChange={(e) =>
                        handleAnswerNumerical(
                          e.target.value === "" ? undefined : parseFloat(e.target.value)
                        )
                      }
                      style={{
                        flex: 1,
                        padding: "10px 12px",
                        fontSize: 16,
                        borderRadius: 8,
                        border: "1px solid var(--border)",
                      }}
                    />
                    {currentQ.expectedUnit && (
                      <span
                        style={{
                          padding: "10px 14px",
                          background: "rgba(0,0,0,0.04)",
                          borderRadius: 8,
                          fontWeight: 600,
                        }}
                      >
                        {currentQ.expectedUnit}
                      </span>
                    )}
                  </div>
                  <p className="muted" style={{ fontSize: 12, marginTop: 6 }}>
                    Tolerance accepted: ±{currentQ.tolerancePercent ?? 5}%. Enter decimals or negative numbers if applicable.
                  </p>
                </div>
              )}

              {currentQ.type === "short_answer" && (
                <div>
                  <textarea
                    rows={4}
                    placeholder="Type your explanation or definition..."
                    value={answers[currentQ.id]?.textAnswer ?? ""}
                    onChange={(e) => handleAnswerShort(e.target.value)}
                    style={{
                      width: "100%",
                      padding: "10px 12px",
                      fontSize: 14,
                      borderRadius: 8,
                      border: "1px solid var(--border)",
                    }}
                  />
                  <p className="muted" style={{ fontSize: 12, marginTop: 4 }}>
                    Evaluated using key rubric criteria. Focus on core definitions and governing principles.
                  </p>
                </div>
              )}
            </div>
          )}

          {/* ========================================================= */}
          {/* STEP 4: CONFIRM SUBMIT */}
          {/* ========================================================= */}
          {step === "confirm_submit" && (
            <div style={{ padding: "10px 0" }}>
              <h4 style={{ margin: "0 0 10px", fontSize: 18 }}>Ready to Submit Your Assessment?</h4>
              <p className="muted" style={{ fontSize: 14, marginBottom: 16 }}>
                Once submitted, your answers will be deterministically graded and saved to your revision analytics.
              </p>

              <div
                style={{
                  background: answeredCount === questions.length ? "rgba(16, 185, 129, 0.08)" : "rgba(245, 158, 11, 0.08)",
                  border: `1px solid ${answeredCount === questions.length ? "rgba(16, 185, 129, 0.25)" : "rgba(245, 158, 11, 0.25)"}`,
                  borderRadius: 10,
                  padding: 14,
                  marginBottom: 16,
                }}
              >
                <div style={{ fontSize: 15, fontWeight: 700, marginBottom: 4 }}>
                  {answeredCount === questions.length
                    ? "✓ All Questions Answered!"
                    : `⚠️ ${questions.length - answeredCount} Question(s) Unanswered`}
                </div>
                <div style={{ fontSize: 13, color: "var(--text)" }}>
                  {answeredCount} of {questions.length} questions completed.
                </div>
              </div>

              {/* Question list checklist */}
              <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                {questions.map((q, idx) => {
                  const ans = answers[q.id];
                  const hasAns =
                    ans &&
                    ((q.type === "mcq" && typeof ans.selectedOptionIndex === "number") ||
                      (q.type === "numerical" && typeof ans.numericValue === "number" && !isNaN(ans.numericValue)) ||
                      (q.type === "short_answer" && typeof ans.textAnswer === "string" && ans.textAnswer.trim().length > 0));

                  return (
                    <div
                      key={q.id}
                      onClick={() => {
                        setCurrentQuestionIndex(idx);
                        setStep("answering");
                      }}
                      style={{
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "space-between",
                        padding: "8px 12px",
                        borderRadius: 8,
                        background: "rgba(0,0,0,0.02)",
                        cursor: "pointer",
                      }}
                    >
                      <span style={{ fontSize: 13 }}>
                        <strong>Q{idx + 1}:</strong> {q.prompt.slice(0, 50)}…
                      </span>
                      <span style={{ fontSize: 12, color: hasAns ? "#10b981" : "#f59e0b", fontWeight: 600 }}>
                        {hasAns ? "Answered" : "Unanswered"} {ans?.isFlagged ? "🚩" : ""}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* ========================================================= */}
          {/* STEP 5: EVALUATING */}
          {/* ========================================================= */}
          {step === "evaluating" && (
            <div style={{ textAlign: "center", padding: "40px 20px" }}>
              <div style={{ fontSize: 36, marginBottom: 12 }}>⏳</div>
              <h4 style={{ margin: "0 0 6px" }}>Evaluating Your Answers…</h4>
              <p className="muted" style={{ fontSize: 14 }}>
                Running deterministic scoring and generating detailed feedback.
              </p>
            </div>
          )}

          {/* ========================================================= */}
          {/* STEP 6: RESULTS & EXPLANATIONS */}
          {/* ========================================================= */}
          {step === "results" && (
            <div>
              {/* Score Banner */}
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  padding: 16,
                  borderRadius: 12,
                  background: accuracy >= 0.7 ? "rgba(16, 185, 129, 0.1)" : "rgba(239, 68, 68, 0.1)",
                  border: `1px solid ${accuracy >= 0.7 ? "rgba(16, 185, 129, 0.3)" : "rgba(239, 68, 68, 0.3)"}`,
                  marginBottom: 16,
                }}
              >
                <div>
                  <div style={{ fontSize: 12, fontWeight: 700, color: accuracy >= 0.7 ? "#059669" : "#dc2626", textTransform: "uppercase" }}>
                    {accuracy >= 0.7 ? "🎉 Topic Mastery Demonstrated" : "⚠️ Needs Additional Practice"}
                  </div>
                  <h3 style={{ margin: "4px 0 0", fontSize: 24, fontWeight: 800 }}>
                    {totalEarned} / {totalMax} ({Math.round(accuracy * 100)}%)
                  </h3>
                </div>

                {retestComparison && (
                  <div style={{ textAlign: "right" }}>
                    {retestComparison.hasPrevious ? (
                      <div>
                        <span
                          className={`pill ${retestComparison.isImproved ? "badge-success" : "badge-danger"}`}
                          style={{ fontSize: 12, fontWeight: 700 }}
                        >
                          {retestComparison.deltaPercent !== null && retestComparison.deltaPercent >= 0 ? `+${retestComparison.deltaPercent}%` : `${retestComparison.deltaPercent}%`} vs Last Retest
                        </span>
                        <div style={{ fontSize: 11, color: "var(--muted)", marginTop: 4 }}>
                          Prior score: {retestComparison.previousAccuracy !== null ? `${Math.round(retestComparison.previousAccuracy * 100)}%` : "—"}
                        </div>
                      </div>
                    ) : (
                      <span className="pill" style={{ fontSize: 11 }}>
                        Baseline Attempt Recorded
                      </span>
                    )}
                  </div>
                )}
              </div>

              {/* Comparative Insight & Academic Integrity Disclaimer */}
              {retestComparison && (
                <div
                  style={{
                    background: "rgba(0,0,0,0.03)",
                    borderRadius: 10,
                    padding: "12px 14px",
                    marginBottom: 16,
                  }}
                >
                  <p style={{ margin: "0 0 6px", fontSize: 13, fontWeight: 600 }}>
                    💡 {retestComparison.insight}
                  </p>
                  <p style={{ margin: 0, fontSize: 11, color: "var(--muted)", lineHeight: 1.4 }}>
                    {retestComparison.disclaimer}
                  </p>
                </div>
              )}

              {/* Linked Revision Task Follow-up */}
              {linkedRevisionTaskId && (
                <div
                  style={{
                    background: "rgba(170, 59, 255, 0.08)",
                    border: "1px solid rgba(170, 59, 255, 0.25)",
                    borderRadius: 10,
                    padding: "10px 14px",
                    marginBottom: 16,
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    flexWrap: "wrap",
                    gap: 8,
                  }}
                >
                  <div>
                    <strong style={{ fontSize: 13, color: "#9333ea" }}>Linked Revision Task</strong>
                    <div style={{ fontSize: 12, color: "var(--text)" }}>
                      {accuracy >= 0.7
                        ? "Score meets completion threshold (≥ 70%). Mark this revision task complete?"
                        : "Revision task remains active for continued review."}
                    </div>
                  </div>
                  {accuracy >= 0.7 && (
                    <button
                      type="button"
                      className="btn small"
                      disabled={taskMarkedDone}
                      onClick={handleCompleteLinkedTask}
                    >
                      {taskMarkedDone ? "✓ Task Completed!" : "Mark Task Done"}
                    </button>
                  )}
                </div>
              )}

              {/* Detailed Question Review List */}
              <h4 style={{ margin: "0 0 10px", fontSize: 15 }}>Question-by-Question Breakdown</h4>
              <div style={{ display: "flex", flexDirection: "column", gap: 12, marginBottom: 16 }}>
                {questions.map((q, idx) => {
                  const res = gradingResults.find((r) => r.questionId === q.id);
                  const isCorrect = res?.isCorrect ?? false;

                  return (
                    <div
                      key={q.id}
                      style={{
                        padding: 14,
                        borderRadius: 10,
                        border: `1px solid ${isCorrect ? "rgba(16, 185, 129, 0.3)" : "rgba(239, 68, 68, 0.3)"}`,
                        background: isCorrect ? "rgba(16, 185, 129, 0.03)" : "rgba(239, 68, 68, 0.03)",
                      }}
                    >
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 6 }}>
                        <strong style={{ fontSize: 13 }}>
                          Q{idx + 1}. {q.prompt}
                        </strong>
                        <span
                          style={{
                            fontSize: 11,
                            fontWeight: 700,
                            padding: "2px 6px",
                            borderRadius: 4,
                            background: isCorrect ? "#d1fae5" : "#fee2e2",
                            color: isCorrect ? "#065f46" : "#991b1b",
                          }}
                        >
                          {res ? `${res.earnedMarks} / ${res.maxMarks} pts` : "—"}
                        </span>
                      </div>

                      <div style={{ fontSize: 12, margin: "4px 0" }}>
                        <span className="muted">Your Answer: </span>
                        <strong>{res?.studentAnswerDisplay || "Unanswered"}</strong>
                      </div>

                      {!isCorrect && (
                        <div style={{ fontSize: 12, margin: "4px 0", color: "#065f46" }}>
                          <span>Correct / Model: </span>
                          <strong>{res?.correctAnswerDisplay}</strong>
                        </div>
                      )}

                      <div
                        style={{
                          marginTop: 8,
                          paddingTop: 8,
                          borderTop: "1px dashed var(--border)",
                          fontSize: 12,
                          color: "var(--muted)",
                        }}
                      >
                        <strong>Explanation: </strong>
                        {res?.feedback}
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Action Buttons: Flashcards, Retest, Close */}
              <div
                style={{
                  display: "flex",
                  gap: 10,
                  flexWrap: "wrap",
                  justifyContent: "space-between",
                  paddingTop: 12,
                  borderTop: "1px solid var(--border)",
                }}
              >
                <div style={{ display: "flex", gap: 8 }}>
                  <button
                    type="button"
                    className="btn small secondary"
                    onClick={handleCreateFlashcards}
                    disabled={deckCreating || deckCreated}
                  >
                    {deckCreated ? "✓ Flashcard Deck Added" : deckCreating ? "Creating Deck…" : "🃏 Save Missed to Flashcards"}
                  </button>

                  <button
                    type="button"
                    className="btn small secondary"
                    onClick={handleRetestAgain}
                  >
                    ⚡ Retest With Fresh Questions
                  </button>
                </div>

                <button type="button" className="btn small" onClick={onClose}>
                  Done & Close
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Modal Footer Controls (for answering steps) */}
        {step === "setup" && (
          <div
            style={{
              padding: "12px 20px",
              borderTop: "1px solid var(--border)",
              display: "flex",
              justifyContent: "flex-end",
              gap: 10,
            }}
          >
            <button type="button" className="btn secondary" onClick={onClose}>
              Cancel
            </button>
            <button type="button" className="btn" onClick={handleStartAssessment}>
              Start Assessment →
            </button>
          </div>
        )}

        {step === "answering" && (
          <div
            style={{
              padding: "12px 20px",
              borderTop: "1px solid var(--border)",
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
            }}
          >
            <button
              type="button"
              className="btn small secondary"
              disabled={currentQuestionIndex === 0}
              onClick={() => setCurrentQuestionIndex((prev) => Math.max(0, prev - 1))}
            >
              ← Previous
            </button>

            <span className="muted" style={{ fontSize: 13 }}>
              {answeredCount} of {questions.length} answered
            </span>

            {currentQuestionIndex < questions.length - 1 ? (
              <button
                type="button"
                className="btn small"
                onClick={() => setCurrentQuestionIndex((prev) => Math.min(questions.length - 1, prev + 1))}
              >
                Next →
              </button>
            ) : (
              <button
                type="button"
                className="btn small"
                onClick={() => setStep("confirm_submit")}
              >
                Review & Submit →
              </button>
            )}
          </div>
        )}

        {step === "confirm_submit" && (
          <div
            style={{
              padding: "12px 20px",
              borderTop: "1px solid var(--border)",
              display: "flex",
              justifyContent: "space-between",
              gap: 10,
            }}
          >
            <button
              type="button"
              className="btn secondary"
              onClick={() => setStep("answering")}
            >
              ← Back to Questions
            </button>
            <button
              type="button"
              className="btn"
              disabled={isSubmitting}
              onClick={handleSubmitAssessment}
            >
              {isSubmitting ? "Grading…" : "Confirm & Submit Assessment"}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
