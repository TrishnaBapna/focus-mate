import { useEffect, useState, type ChangeEvent, type FormEvent } from "react";
import { useNavigate, useParams, Link } from "react-router-dom";
import { useAuth } from "../hooks/useAuth";
import { useSubjects } from "../hooks/useSubjects";
import { useExams } from "../hooks/useExams";
import { addPaper, getPaper, updatePaper } from "../services/papers";
import { addDeck, addCards } from "../services/study";
import TargetedAssessmentModal from "../components/TargetedAssessmentModal";
import { recognizeText } from "../utils/ocr";
import { importPdf } from "../utils/pdf";
import {
  extractQuestionsFromText,
  evaluateQuestionsWithAi,
  generateActionPlanFromMistakes,
  parseQuestionsFallback,
} from "../utils/paperAnalysis";
import { getProvider, PROVIDER_LABELS } from "../utils/aiSettings";
import {
  computePaperSummary,
  validateAllPaperMarks,
  validateQuestionMarks,
} from "../utils/paperScores";
import type {
  PaperActionItem,
  PaperSourceType,
  PaperType,
  QuestionAnalysis,
} from "../types/paper";

type WorkflowStep = "setup" | "matching" | "analysis" | "action_plan";

export default function PaperWorkflow() {
  const { id } = useParams<{ id?: string }>();
  const { user } = useAuth();
  const { subjects } = useSubjects();
  const { exams } = useExams();
  const navigate = useNavigate();

  // Workflow state
  const [step, setStep] = useState<WorkflowStep>("setup");
  const [loading, setLoading] = useState(Boolean(id));
  const [statusMessage, setStatusMessage] = useState("");
  const [paperId, setPaperId] = useState<string | null>(id ?? null);

  // Form setup state
  const [title, setTitle] = useState("");
  const [paperType, setPaperType] = useState<PaperType>("practice");
  const [subjectId, setSubjectId] = useState("");
  const [examId, setExamId] = useState("");
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [sourceType, setSourceType] = useState<PaperSourceType>("text");
  const [rawText, setRawText] = useState("");
  const [consentGiven, setConsentGiven] = useState(false);
  const [evalConsentGiven, setEvalConsentGiven] = useState(false);
  const [saveStatus, setSaveStatus] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const [saveError, setSaveError] = useState("");

  const activeProvider = getProvider(user?.uid ?? null);
  const activeProviderLabel = PROVIDER_LABELS[activeProvider] || "Configured AI Provider";

  // Extracted and evaluated questions
  const [questions, setQuestions] = useState<QuestionAnalysis[]>([]);
  const [actionPlan, setActionPlan] = useState<PaperActionItem[]>([]);
  const [deckCreated, setDeckCreated] = useState(false);
  const [quizModal, setQuizModal] = useState<{
    isOpen: boolean;
    topic?: string;
    mistakeTag?: string;
  }>({ isOpen: false });

  // Load existing paper if editing
  useEffect(() => {
    if (!id || !user) return;
    let active = true;
    void getPaper(user.uid, id)
      .then((p) => {
        if (!p) {
          navigate("/papers");
          return;
        }
        setTitle(p.title);
        setPaperType(p.paperType);
        setSubjectId(p.subjectId ?? "");
        setExamId(p.examId ?? "");
        setDate(p.date);
        setSourceType(p.sourceType);
        setRawText(p.rawExtractedText ?? "");
        setConsentGiven(p.aiProcessingConsentGiven);
        setQuestions(p.questions ?? []);
        setActionPlan(p.actionPlan ?? []);
        setPaperId(p.id);

        if (p.status === "analyzed") {
          setStep("action_plan");
        } else if (p.status === "ready_for_review") {
          setStep("matching");
        }
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, [id, user, navigate]);

  const selectedSubject = subjects.find((s) => s.id === subjectId);
  const selectedExam = exams.find((e) => e.id === examId);
  const syllabusTopics = selectedExam?.syllabus.map((s) => s.title) ?? [];

  // File processing (PDF / Image)
  async function handleFileUpload(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    setLoading(true);
    try {
      if (file.type === "application/pdf") {
        setSourceType("pdf");
        setStatusMessage("Reading PDF pages…");
        const { pages } = await importPdf(file, false, 15, (curr, total) => {
          setStatusMessage(`Extracting PDF page ${curr} of ${total}…`);
        });

        // Combine text from pages
        let combined = pages.map((p) => p.text).filter(Boolean).join("\n\n");
        // If native PDF text is nearly empty, run OCR on the rendered canvases
        if (combined.trim().length < 50 && pages.length > 0) {
          setStatusMessage("Scanned PDF detected. Running OCR on pages…");
          const ocrParts: string[] = [];
          for (let i = 0; i < pages.length; i++) {
            setStatusMessage(`Running OCR on page ${i + 1} of ${pages.length}…`);
            const blob = pages[i].blob;
            if (blob) {
              const text = await recognizeText(blob, "eng", (f) => {
                setStatusMessage(`Running OCR on page ${i + 1} (${Math.round(f * 100)}%)…`);
              });
              ocrParts.push(text);
            }
          }
          combined = ocrParts.join("\n\n");
        }

        setRawText(combined);
        if (!title.trim()) {
          setTitle(file.name.replace(/\.[^/.]+$/, ""));
        }
      } else if (file.type.startsWith("image/")) {
        setSourceType("image");
        setStatusMessage("Scanning image with OCR…");
        const text = await recognizeText(file, "eng", (f) => {
          setStatusMessage(`OCR scanning in progress (${Math.round(f * 100)}%)…`);
        });
        setRawText(text);
        if (!title.trim()) {
          setTitle(file.name.replace(/\.[^/.]+$/, ""));
        }
      }
    } catch (err) {
      console.error("File processing error:", err);
      alert("Failed to read file. Please ensure it is a valid PDF or image, or paste text directly.");
    } finally {
      setLoading(false);
      setStatusMessage("");
    }
  }

  // Step 1: Run Extraction
  async function handleStartExtraction(e: FormEvent) {
    e.preventDefault();
    if (!user) return;
    if (!title.trim()) {
      alert("Please enter a paper title.");
      return;
    }
    if (!rawText.trim()) {
      alert("Please provide the paper text via file upload or pasting.");
      return;
    }
    if (!consentGiven) {
      alert("Please confirm the AI processing consent before continuing.");
      return;
    }

    setLoading(true);
    setStatusMessage("Extracting and matching questions…");

    try {
      const extracted = await extractQuestionsFromText(
        rawText,
        selectedSubject?.name,
        syllabusTopics,
        user.uid
      );

      const qs = extracted.length > 0 ? extracted : parseQuestionsFallback(rawText);
      setQuestions(qs);

      // Save initial draft / ready_for_review paper to Firestore
      const initialSummary = computePaperSummary(qs, paperType);

      if (paperId) {
        await updatePaper(user.uid, paperId, {
          title: title.trim(),
          paperType,
          subjectId: subjectId || undefined,
          subjectName: selectedSubject?.name,
          subjectEmoji: selectedSubject?.emoji,
          examId: examId || undefined,
          date,
          status: "ready_for_review",
          sourceType,
          aiProcessingConsentGiven: consentGiven,
          rawExtractedText: rawText,
          summary: initialSummary,
          questions: qs,
        });
      } else {
        const newId = await addPaper(user.uid, {
          title: title.trim(),
          paperType,
          subjectId: subjectId || undefined,
          subjectName: selectedSubject?.name,
          subjectEmoji: selectedSubject?.emoji,
          examId: examId || undefined,
          date,
          status: "ready_for_review",
          sourceType,
          aiProcessingConsentGiven: consentGiven,
          rawExtractedText: rawText,
          summary: initialSummary,
          questions: qs,
          actionPlan: [],
        });
        setPaperId(newId);
      }

      setStep("matching");
    } catch (err) {
      console.error("Extraction error:", err);
      alert("Extraction encountered an error. Proceeding with text fallback.");
      setQuestions(parseQuestionsFallback(rawText));
      setStep("matching");
    } finally {
      setLoading(false);
      setStatusMessage("");
    }
  }

  // Question editing helpers
  function updateQuestion(index: number, patch: Partial<QuestionAnalysis>) {
    setQuestions((prev) => {
      const copy = [...prev];
      copy[index] = { ...copy[index], ...patch };
      return copy;
    });
  }

  function addEmptyQuestion() {
    const nextNum = `${questions.length + 1}`;
    setQuestions((prev) => [
      ...prev,
      {
        id: `q_${Date.now()}_${nextNum}`,
        questionNumber: nextNum,
        questionText: "",
        maxMarks: 5,
        uncertainMatch: false,
      },
    ]);
  }

  function removeQuestion(index: number) {
    setQuestions((prev) => prev.filter((_, i) => i !== index));
  }

  // Step 2: Save Progress without running AI evaluation
  async function handleSaveProgress() {
    if (!user || !paperId) return;

    const validationErrors = validateAllPaperMarks(questions, paperType);
    if (validationErrors.length > 0) {
      setSaveError(validationErrors.map((e) => e.error).filter(Boolean).join(" "));
      setSaveStatus("error");
      return;
    }

    setSaveStatus("saving");
    setSaveError("");

    try {
      const summary = computePaperSummary(questions, paperType);
      await updatePaper(user.uid, paperId, {
        title: title.trim(),
        questions,
        summary,
        status: "ready_for_review",
      });
      setSaveStatus("saved");
      setTimeout(() => setSaveStatus("idle"), 3000);
    } catch (err: unknown) {
      console.error("Save progress error:", err);
      const msg = err instanceof Error ? err.message : "Failed to save progress. Please try again.";
      setSaveError(msg);
      setSaveStatus("error");
    }
  }

  // Step 2 -> Step 3: Run AI Evaluation
  async function handleRunEvaluation() {
    if (!user || !paperId) return;

    const validationErrors = validateAllPaperMarks(questions, paperType);
    if (validationErrors.length > 0) {
      alert(
        "Please resolve mark validation errors before running evaluation:\n" +
          validationErrors.map((e) => e.error).filter(Boolean).join("\n")
      );
      return;
    }

    if (!evalConsentGiven) {
      alert(`Please confirm AI processing consent for ${activeProviderLabel} before continuing.`);
      return;
    }

    setLoading(true);
    setStatusMessage("Running AI analysis & formative assessment…");

    try {
      const evaluated = await evaluateQuestionsWithAi(
        questions,
        paperType,
        selectedSubject?.name,
        user.uid
      );
      setQuestions(evaluated);

      const summary = computePaperSummary(evaluated, paperType);

      await updatePaper(user.uid, paperId, {
        questions: evaluated,
        summary,
        status: "ready_for_review",
      });

      setStep("analysis");
    } catch (err) {
      console.error("Evaluation error:", err);
      alert("AI analysis could not complete. You can still save and enter your marks manually.");
      setStep("analysis");
    } finally {
      setLoading(false);
      setStatusMessage("");
    }
  }

  // Step 3 -> Step 4: Generate Action Plan
  async function handleGeneratePlan() {
    if (!user || !paperId) return;

    setLoading(true);
    setStatusMessage("Formulating targeted action plan from mistake patterns…");

    try {
      const plan = await generateActionPlanFromMistakes(
        questions,
        title,
        selectedSubject?.name,
        user.uid
      );
      setActionPlan(plan);

      await updatePaper(user.uid, paperId, {
        actionPlan: plan,
        status: "analyzed",
      });

      setStep("action_plan");
    } catch (err) {
      console.error("Plan generation error:", err);
      alert("Could not generate action plan automatically.");
      setStep("action_plan");
    } finally {
      setLoading(false);
      setStatusMessage("");
    }
  }

  // Study Deck creation directly from action items
  async function handleCreateStudyDeck() {
    if (!user || deckCreated || loading) return;
    setLoading(true);
    try {
      const deckName = `${title} - Revision Deck`;
      const deckRef = await addDeck(user.uid, {
        name: deckName,
        subjectId: subjectId || "",
        subjectName: selectedSubject?.name || "General",
        subjectEmoji: selectedSubject?.emoji || "📝",
      });

      // Formulate cards from questions with mistakes or action items
      const today = new Date().toISOString().slice(0, 10);
      const newCards = questions
        .filter((q) => (q.mistakePoints && q.mistakePoints.length > 0) || (q.aiEstimatedMarks ?? 0) < q.maxMarks)
        .map((q) => ({
          front: `[${q.topic || selectedSubject?.name || "Topic"}] Q: ${q.questionText.slice(0, 150)}`,
          back: `Key Takeaway: ${q.mistakePoints?.join("; ") || q.aiFeedback || "Review topic concepts."}`,
        }));

      if (newCards.length === 0) {
        newCards.push({
          front: `Key concepts for ${title}`,
          back: "Review fundamental formulas and definitions.",
        });
      }

      await addCards(user.uid, deckRef.id, newCards, today);
      setDeckCreated(true);
    } catch (err) {
      console.error("Error creating study deck:", err);
      alert("Failed to create study deck.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div style={{ maxWidth: 900, margin: "0 auto", paddingBottom: 60 }}>
      {/* Workflow Navigation / Breadcrumbs */}
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          marginBottom: 20,
          flexWrap: "wrap",
          gap: 10,
        }}
      >
        <Link to="/papers" className="btn secondary small" style={{ textDecoration: "none" }}>
          ← Back to Papers
        </Link>
        <div style={{ display: "flex", gap: 6, fontSize: 13, fontWeight: 700 }}>
          <span style={{ color: step === "setup" ? "var(--accent)" : "var(--muted)" }}>
            1. Setup & Upload
          </span>
          <span>→</span>
          <span style={{ color: step === "matching" ? "var(--accent)" : "var(--muted)" }}>
            2. Match & Marks
          </span>
          <span>→</span>
          <span style={{ color: step === "analysis" ? "var(--accent)" : "var(--muted)" }}>
            3. AI Feedback
          </span>
          <span>→</span>
          <span style={{ color: step === "action_plan" ? "var(--accent)" : "var(--muted)" }}>
            4. Action Plan
          </span>
        </div>
      </div>

      {loading && (
        <div
          className="card"
          style={{
            padding: 16,
            marginBottom: 20,
            background: "rgba(255, 138, 76, 0.1)",
            border: "1px solid var(--accent)",
            textAlign: "center",
          }}
        >
          <p style={{ margin: 0, fontWeight: 700 }}>⏳ {statusMessage || "Processing…"}</p>
        </div>
      )}

      {/* STEP 1: SETUP & INPUT */}
      {step === "setup" && (
        <form className="card" onSubmit={handleStartExtraction} style={{ padding: 24 }}>
          <h2 style={{ marginTop: 0 }}>Step 1: Paper Details & Document Input</h2>
          <p style={{ color: "var(--muted)", fontSize: 14 }}>
            Upload a past exam paper, handwritten answer scan, or paste question text.
          </p>

          <div style={{ display: "flex", flexDirection: "column", gap: 16, marginTop: 16 }}>
            <div>
              <label style={{ display: "block", fontWeight: 700, fontSize: 13, marginBottom: 4 }}>
                Paper Title *
              </label>
              <input
                style={{ width: "100%", padding: "10px 12px", borderRadius: 8 }}
                placeholder="e.g. 2025 Midterm Exam or Mechanics Practice Set 1"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                required
              />
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
              <div>
                <label style={{ display: "block", fontWeight: 700, fontSize: 13, marginBottom: 4 }}>
                  Paper Type *
                </label>
                <select
                  style={{ width: "100%", padding: "10px 12px", borderRadius: 8 }}
                  value={paperType}
                  onChange={(e) => setPaperType(e.target.value as PaperType)}
                >
                  <option value="practice">Practice Paper (Self-marking / AI review)</option>
                  <option value="exam">Real Exam Paper (Store Teacher Marks)</option>
                </select>
              </div>

              <div>
                <label style={{ display: "block", fontWeight: 700, fontSize: 13, marginBottom: 4 }}>
                  Date of Paper *
                </label>
                <input
                  type="date"
                  style={{ width: "100%", padding: "10px 12px", borderRadius: 8 }}
                  value={date}
                  onChange={(e) => setDate(e.target.value)}
                  required
                />
              </div>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
              <div>
                <label style={{ display: "block", fontWeight: 700, fontSize: 13, marginBottom: 4 }}>
                  Subject (optional)
                </label>
                <select
                  style={{ width: "100%", padding: "10px 12px", borderRadius: 8 }}
                  value={subjectId}
                  onChange={(e) => {
                    setSubjectId(e.target.value);
                    setExamId("");
                  }}
                >
                  <option value="">No specific subject</option>
                  {subjects.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.emoji} {s.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label style={{ display: "block", fontWeight: 700, fontSize: 13, marginBottom: 4 }}>
                  Linked Exam (optional)
                </label>
                <select
                  style={{ width: "100%", padding: "10px 12px", borderRadius: 8 }}
                  value={examId}
                  onChange={(e) => setExamId(e.target.value)}
                >
                  <option value="">No linked exam</option>
                  {exams
                    .filter((e) => !subjectId || e.subjectId === subjectId)
                    .map((e) => (
                      <option key={e.id} value={e.id}>
                        {e.name} ({e.date})
                      </option>
                    ))}
                </select>
              </div>
            </div>

            {/* Document Input */}
            <div style={{ borderTop: "1px solid rgba(255, 138, 76, 0.15)", paddingTop: 16 }}>
              <label style={{ display: "block", fontWeight: 700, fontSize: 14, marginBottom: 8 }}>
                Document Input (PDF, Image Scan, or Text Paste)
              </label>

              <div style={{ display: "flex", gap: 12, alignItems: "center", marginBottom: 12, flexWrap: "wrap" }}>
                <label
                  className="btn secondary small"
                  style={{ cursor: "pointer", display: "inline-flex", alignItems: "center" }}
                >
                  📂 Upload PDF or Image
                  <input
                    type="file"
                    accept=".pdf,image/*"
                    style={{ display: "none" }}
                    onChange={handleFileUpload}
                  />
                </label>
                <span style={{ fontSize: 13, color: "var(--muted)" }}>
                  Supports searchable and scanned PDFs, PNG, JPG
                </span>
              </div>

              <textarea
                style={{
                  width: "100%",
                  minHeight: 180,
                  padding: 12,
                  borderRadius: 8,
                  fontSize: 13,
                  fontFamily: "monospace",
                }}
                placeholder="Or paste question & answer text directly here…"
                value={rawText}
                onChange={(e) => {
                  setRawText(e.target.value);
                  setSourceType("text");
                }}
              />
            </div>

            {/* Privacy & Accuracy Consent */}
            <div
              style={{
                background: "rgba(255, 138, 76, 0.08)",
                border: "1px solid rgba(255, 138, 76, 0.3)",
                borderRadius: 10,
                padding: 14,
                display: "flex",
                gap: 12,
                alignItems: "flex-start",
              }}
            >
              <input
                type="checkbox"
                id="aiConsent"
                checked={consentGiven}
                onChange={(e) => setConsentGiven(e.target.checked)}
                style={{ marginTop: 3, cursor: "pointer" }}
              />
              <label htmlFor="aiConsent" style={{ fontSize: 13, lineHeight: 1.4, cursor: "pointer" }}>
                <strong>Academic Accuracy & Privacy Confirmation:</strong> I understand that document
                content and extracted answers will be sent to the configured AI provider (
                {activeProviderLabel}) for extraction, rubric evaluation, and mistake categorization.
                AI-generated estimates are for formative guidance only and will never overwrite
                official teacher-awarded marks.
              </label>
            </div>

            <div style={{ display: "flex", justifyContent: "flex-end", gap: 10 }}>
              <button className="btn" type="submit" disabled={loading || !consentGiven}>
                Extract & Match Questions →
              </button>
            </div>
          </div>
        </form>
      )}

      {/* STEP 2: MATCHING & MARKS ENTRY */}
      {step === "matching" && (
        <div className="card" style={{ padding: 24 }}>
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              flexWrap: "wrap",
              gap: 10,
              marginBottom: 16,
            }}
          >
            <div>
              <h2 style={{ margin: 0 }}>Step 2: Review Questions & Enter Marks</h2>
              <p style={{ color: "var(--muted)", fontSize: 14, margin: "4px 0 0" }}>
                Verify question text, match answers, and record marks.
                {paperType === "exam"
                  ? " Enter official Teacher Awarded Marks for each question."
                  : " Enter your self-awarded practice marks (optional)."}
              </p>
            </div>
            <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
              <button
                type="button"
                className="btn secondary small"
                onClick={handleSaveProgress}
                disabled={loading || saveStatus === "saving"}
              >
                {saveStatus === "saving"
                  ? "Saving…"
                  : saveStatus === "saved"
                  ? "✓ Saved!"
                  : "💾 Save Progress"}
              </button>
              <button className="btn secondary small" onClick={addEmptyQuestion}>
                + Add Question
              </button>
            </div>
          </div>

          {questions.some((q) => q.uncertainMatch) && (
            <div
              style={{
                background: "rgba(234, 179, 8, 0.15)",
                border: "1px solid #eab308",
                borderRadius: 8,
                padding: "10px 14px",
                marginBottom: 16,
                fontSize: 13,
              }}
            >
              ⚠️ <strong>Uncertain OCR / Question matches detected.</strong> Some questions below are
              flagged for manual review because the text boundary or handwriting was ambiguous. Please
              verify the question and answer text before proceeding.
            </div>
          )}

          <div style={{ display: "flex", flexDirection: "column", gap: 18, marginBottom: 24 }}>
            {questions.map((q, idx) => (
              <div
                key={q.id || idx}
                style={{
                  border: q.uncertainMatch
                    ? "2px solid #eab308"
                    : "1px solid rgba(255, 138, 76, 0.2)",
                  borderRadius: 12,
                  padding: 16,
                  background: "var(--card)",
                }}
              >
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    marginBottom: 10,
                    gap: 8,
                  }}
                >
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <span style={{ fontWeight: 800, fontSize: 15 }}>Q{idx + 1}</span>
                    <input
                      style={{ width: 60, padding: "4px 8px", fontSize: 13, borderRadius: 6 }}
                      value={q.questionNumber}
                      placeholder="No."
                      onChange={(e) => updateQuestion(idx, { questionNumber: e.target.value })}
                    />
                    {q.uncertainMatch && (
                      <span
                        style={{
                          fontSize: 11,
                          fontWeight: 700,
                          padding: "2px 6px",
                          borderRadius: 4,
                          background: "#fef08a",
                          color: "#854d0e",
                        }}
                      >
                        Needs Review
                      </span>
                    )}
                  </div>
                  <button
                    className="btn danger small"
                    onClick={() => removeQuestion(idx)}
                    title="Remove question"
                  >
                    ✕
                  </button>
                </div>

                <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                  <div>
                    <label style={{ fontSize: 12, fontWeight: 700, color: "var(--muted)" }}>
                      Question Text
                    </label>
                    <textarea
                      style={{ width: "100%", minHeight: 60, padding: 8, borderRadius: 6, fontSize: 13 }}
                      value={q.questionText}
                      onChange={(e) => updateQuestion(idx, { questionText: e.target.value })}
                    />
                  </div>

                  <div>
                    <label style={{ fontSize: 12, fontWeight: 700, color: "var(--muted)" }}>
                      Student Answer Text
                    </label>
                    <textarea
                      style={{ width: "100%", minHeight: 60, padding: 8, borderRadius: 6, fontSize: 13 }}
                      value={q.studentAnswerText ?? ""}
                      placeholder="Student answer extracted from script, or leave blank to evaluate model answer"
                      onChange={(e) => updateQuestion(idx, { studentAnswerText: e.target.value })}
                    />
                  </div>

                  <div
                    style={{
                      display: "grid",
                      gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))",
                      gap: 12,
                      marginTop: 4,
                    }}
                  >
                    <div>
                      <label style={{ fontSize: 12, fontWeight: 700, color: "var(--muted)" }}>
                        Max Marks *
                      </label>
                      <input
                        type="number"
                        min={1}
                        style={{ width: "100%", padding: "6px 8px", borderRadius: 6 }}
                        value={q.maxMarks}
                        onChange={(e) =>
                          updateQuestion(idx, { maxMarks: Math.max(1, Number(e.target.value)) })
                        }
                      />
                    </div>

                    {paperType === "exam" ? (
                      <div>
                        <label style={{ fontSize: 12, fontWeight: 700, color: "var(--accent)" }}>
                          Teacher Marks 🎓
                        </label>
                        <input
                          type="number"
                          min={0}
                          max={q.maxMarks}
                          step={0.5}
                          style={{
                            width: "100%",
                            padding: "6px 8px",
                            borderRadius: 6,
                            borderColor:
                              typeof q.teacherAwardedMarks === "number" &&
                              (q.teacherAwardedMarks < 0 || q.teacherAwardedMarks > q.maxMarks)
                                ? "#dc2626"
                                : undefined,
                          }}
                          placeholder="Teacher marks"
                          value={q.teacherAwardedMarks ?? ""}
                          onChange={(e) =>
                            updateQuestion(idx, {
                              teacherAwardedMarks:
                                e.target.value === "" ? null : Number(e.target.value),
                            })
                          }
                        />
                      </div>
                    ) : (
                      <div>
                        <label style={{ fontSize: 12, fontWeight: 700, color: "var(--accent)" }}>
                          Self-entered Marks
                        </label>
                        <input
                          type="number"
                          min={0}
                          max={q.maxMarks}
                          step={0.5}
                          style={{
                            width: "100%",
                            padding: "6px 8px",
                            borderRadius: 6,
                            borderColor:
                              typeof q.studentEnteredMarks === "number" &&
                              (q.studentEnteredMarks < 0 || q.studentEnteredMarks > q.maxMarks)
                                ? "#dc2626"
                                : undefined,
                          }}
                          placeholder="Self marks"
                          value={q.studentEnteredMarks ?? ""}
                          onChange={(e) =>
                            updateQuestion(idx, {
                              studentEnteredMarks:
                                e.target.value === "" ? null : Number(e.target.value),
                            })
                          }
                        />
                      </div>
                    )}

                    <div>
                      <label style={{ fontSize: 12, fontWeight: 700, color: "var(--muted)" }}>
                        Topic / Syllabus Match
                      </label>
                      <input
                        style={{ width: "100%", padding: "6px 8px", borderRadius: 6 }}
                        placeholder="e.g. Thermodynamics"
                        value={q.topic ?? ""}
                        list="syllabusSuggestions"
                        onChange={(e) => updateQuestion(idx, { topic: e.target.value })}
                      />
                      <datalist id="syllabusSuggestions">
                        {syllabusTopics.map((topic, i) => (
                          <option key={i} value={topic} />
                        ))}
                      </datalist>
                    </div>
                  </div>

                  {(() => {
                    const validation = validateQuestionMarks(q, paperType);
                    if (!validation.isValid) {
                      return (
                        <div
                          style={{
                            color: "#dc2626",
                            fontSize: 12,
                            marginTop: 6,
                            fontWeight: 600,
                          }}
                        >
                          ⚠️ {validation.error}
                        </div>
                      );
                    }
                    return null;
                  })()}
                </div>
              </div>
            ))}
          </div>

          {saveError && (
            <div
              style={{
                color: "#dc2626",
                background: "rgba(220, 38, 38, 0.1)",
                border: "1px solid rgba(220, 38, 38, 0.25)",
                padding: "8px 12px",
                borderRadius: 8,
                fontSize: 13,
                marginBottom: 16,
              }}
            >
              ⚠️ {saveError}
            </div>
          )}

          {/* AI Evaluation Consent Disclosure */}
          <div
            style={{
              background: "rgba(255, 138, 76, 0.08)",
              border: "1px solid rgba(255, 138, 76, 0.3)",
              borderRadius: 8,
              padding: 12,
              marginBottom: 16,
              display: "flex",
              gap: 10,
              alignItems: "flex-start",
            }}
          >
            <input
              type="checkbox"
              id="evalConsent"
              checked={evalConsentGiven}
              onChange={(e) => setEvalConsentGiven(e.target.checked)}
              style={{ marginTop: 2, cursor: "pointer" }}
            />
            <label htmlFor="evalConsent" style={{ fontSize: 13, lineHeight: 1.4, cursor: "pointer" }}>
              <strong>AI Evaluation Confirmation:</strong> Send question text and student answers to{" "}
              <strong>{activeProviderLabel}</strong> for formative rubric feedback and mistake analysis.
              Teacher marks remain separate and protected.
            </label>
          </div>

          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              flexWrap: "wrap",
              gap: 10,
            }}
          >
            <button className="btn secondary" onClick={() => setStep("setup")}>
              ← Back to Setup
            </button>
            <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
              <button
                type="button"
                className="btn secondary"
                onClick={handleSaveProgress}
                disabled={loading || saveStatus === "saving"}
              >
                {saveStatus === "saving"
                  ? "Saving Progress…"
                  : saveStatus === "saved"
                  ? "✓ Progress Saved!"
                  : "💾 Save Progress"}
              </button>
              <button
                className="btn"
                onClick={handleRunEvaluation}
                disabled={loading || questions.length === 0 || !evalConsentGiven}
              >
                Run AI Evaluation & Feedback →
              </button>
            </div>
          </div>
        </div>
      )}

      {/* STEP 3: AI ANALYSIS & QUESTION FEEDBACK */}
      {step === "analysis" && (
        <div className="card" style={{ padding: 24 }}>
          <h2 style={{ marginTop: 0 }}>Step 3: Question-Level AI Feedback & Diagnostics</h2>
          <p style={{ color: "var(--muted)", fontSize: 14 }}>
            Detailed strengths, specific mistakes made, and formative guidance for every question.
          </p>

          <div style={{ display: "flex", flexDirection: "column", gap: 16, marginBottom: 24 }}>
            {questions.map((q, idx) => (
              <div
                key={q.id || idx}
                style={{
                  border: "1px solid rgba(255, 138, 76, 0.2)",
                  borderRadius: 12,
                  padding: 16,
                  background: "var(--card)",
                }}
              >
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "flex-start",
                    flexWrap: "wrap",
                    gap: 8,
                    marginBottom: 10,
                  }}
                >
                  <div>
                    <span style={{ fontWeight: 800, fontSize: 16 }}>
                      Question {q.questionNumber}
                    </span>
                    {q.topic && (
                      <span
                        style={{
                          marginLeft: 10,
                          fontSize: 12,
                          background: "rgba(255, 138, 76, 0.15)",
                          padding: "2px 8px",
                          borderRadius: 6,
                        }}
                      >
                        {q.topic}
                      </span>
                    )}
                  </div>

                  <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
                    {typeof q.teacherAwardedMarks === "number" && (
                      <span
                        style={{
                          fontSize: 12,
                          fontWeight: 700,
                          padding: "3px 8px",
                          borderRadius: 6,
                          background: "rgba(170, 59, 255, 0.15)",
                          color: "var(--accent-purple, #9333ea)",
                        }}
                      >
                        Teacher: {q.teacherAwardedMarks}/{q.maxMarks}
                      </span>
                    )}

                    {typeof q.studentEnteredMarks === "number" && (
                      <span
                        style={{
                          fontSize: 12,
                          fontWeight: 700,
                          padding: "3px 8px",
                          borderRadius: 6,
                          background: "rgba(255, 138, 76, 0.18)",
                        }}
                      >
                        Self: {q.studentEnteredMarks}/{q.maxMarks}
                      </span>
                    )}

                    {typeof q.aiEstimatedMarks === "number" && (
                      <span
                        style={{
                          fontSize: 12,
                          fontWeight: 700,
                          padding: "3px 8px",
                          borderRadius: 6,
                          background: "rgba(34, 197, 94, 0.15)",
                          color: "#16a34a",
                        }}
                      >
                        AI Est: {q.aiEstimatedMarks}/{q.maxMarks}
                      </span>
                    )}

                    {q.mistakeTag && (
                      <span
                        style={{
                          fontSize: 11,
                          fontWeight: 700,
                          padding: "3px 8px",
                          borderRadius: 6,
                          background: "rgba(239, 68, 68, 0.12)",
                          color: "#dc2626",
                          textTransform: "capitalize",
                        }}
                      >
                        {q.mistakeTag.replace(/_/g, " ")}
                      </span>
                    )}
                  </div>
                </div>

                <p style={{ fontSize: 13, color: "var(--muted)", margin: "4px 0 8px" }}>
                  <strong>Q:</strong> {q.questionText}
                </p>

                {q.studentAnswerText && (
                  <p
                    style={{
                      fontSize: 13,
                      background: "rgba(0,0,0,0.03)",
                      padding: 10,
                      borderRadius: 8,
                      margin: "6px 0 10px",
                    }}
                  >
                    <strong>Your Answer:</strong> {q.studentAnswerText}
                  </p>
                )}

                {q.aiFeedback && (
                  <div style={{ marginTop: 8, fontSize: 13 }}>
                    <p style={{ margin: "4px 0", color: "#1e293b", fontWeight: 600 }}>
                      💡 {q.aiFeedback}
                    </p>
                  </div>
                )}

                {q.strengthPoints && q.strengthPoints.length > 0 && (
                  <div style={{ marginTop: 6, fontSize: 12, color: "#16a34a" }}>
                    <strong>Strengths:</strong>
                    <ul style={{ margin: "2px 0 0 18px", padding: 0 }}>
                      {q.strengthPoints.map((s, i) => (
                        <li key={i}>{s}</li>
                      ))}
                    </ul>
                  </div>
                )}

                {q.mistakePoints && q.mistakePoints.length > 0 && (
                  <div style={{ marginTop: 6, fontSize: 12, color: "#dc2626" }}>
                    <strong>Areas to improve:</strong>
                    <ul style={{ margin: "2px 0 0 18px", padding: 0 }}>
                      {q.mistakePoints.map((m, i) => (
                        <li key={i}>{m}</li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            ))}
          </div>

          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <button className="btn secondary" onClick={() => setStep("matching")}>
              ← Edit Questions / Marks
            </button>
            <button className="btn" onClick={handleGeneratePlan} disabled={loading}>
              Generate Action Plan →
            </button>
          </div>
        </div>
      )}

      {/* STEP 4: ACTION PLAN & STUDY DECKS */}
      {step === "action_plan" && (
        <div className="card" style={{ padding: 24 }}>
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
              <h2 style={{ margin: 0 }}>Step 4: Prioritized Action Plan 🎯</h2>
              <p style={{ color: "var(--muted)", fontSize: 14, margin: "4px 0 0" }}>
                Targeted revision tasks based on areas where marks were lost.
              </p>
            </div>

            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              <Link
                to="/planner"
                className="btn secondary"
                style={{ textDecoration: "none", display: "inline-flex", alignItems: "center", gap: 6 }}
              >
                ⚡ Revision Planner
              </Link>
              <button
                className="btn secondary"
                onClick={handleCreateStudyDeck}
                disabled={loading || deckCreated}
              >
                {deckCreated ? "✓ Flashcards Created in Study!" : "🃏 Create Study Deck"}
              </button>
            </div>
          </div>

          {actionPlan.length === 0 ? (
            <p className="empty-note">No action items needed! Great performance on this paper.</p>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 12, marginBottom: 24 }}>
              {actionPlan.map((item, idx) => (
                <div
                  key={item.id || idx}
                  style={{
                    display: "flex",
                    alignItems: "flex-start",
                    gap: 12,
                    padding: 14,
                    borderRadius: 10,
                    background: "var(--card)",
                    borderLeft: `4px solid ${
                      item.priority === "high"
                        ? "#dc2626"
                        : item.priority === "medium"
                        ? "#eab308"
                        : "#16a34a"
                    }`,
                    border: "1px solid rgba(255, 138, 76, 0.15)",
                  }}
                >
                  <input
                    type="checkbox"
                    checked={item.completed}
                    onChange={() => {
                      const updated = [...actionPlan];
                      updated[idx].completed = !updated[idx].completed;
                      setActionPlan(updated);
                      if (user && paperId) {
                        void updatePaper(user.uid, paperId, { actionPlan: updated });
                      }
                    }}
                    style={{ marginTop: 3, cursor: "pointer" }}
                  />
                  <div style={{ flex: 1 }}>
                    <div style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 2 }}>
                      <span
                        style={{
                          fontSize: 11,
                          fontWeight: 700,
                          textTransform: "uppercase",
                          color:
                            item.priority === "high"
                              ? "#dc2626"
                              : item.priority === "medium"
                              ? "#ca8a04"
                              : "#16a34a",
                        }}
                      >
                        {item.priority} priority
                      </span>
                      <span style={{ fontSize: 12, fontWeight: 700, color: "var(--muted)" }}>
                        • {item.topic}
                      </span>
                      <span
                        style={{
                          fontSize: 11,
                          padding: "2px 6px",
                          borderRadius: 4,
                          background: "rgba(255, 138, 76, 0.15)",
                          color: "var(--accent)",
                        }}
                      >
                        {item.actionType.replace(/_/g, " ")}
                      </span>
                    </div>
                    <p
                      style={{
                        margin: 0,
                        fontSize: 14,
                        textDecoration: item.completed ? "line-through" : "none",
                        color: item.completed ? "var(--muted)" : "inherit",
                      }}
                    >
                      {item.recommendation}
                    </p>
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
                        🎯 Practice Quiz
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}

          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              borderTop: "1px solid rgba(255, 138, 76, 0.12)",
              paddingTop: 16,
            }}
          >
            <button className="btn secondary" onClick={() => setStep("analysis")}>
              ← Back to Feedback
            </button>
            <button className="btn" onClick={() => navigate("/papers")}>
              Done & View Papers List ✓
            </button>
          </div>
        </div>
      )}

      {quizModal.isOpen && (
        <TargetedAssessmentModal
          isOpen={quizModal.isOpen}
          onClose={() => setQuizModal({ isOpen: false })}
          initialTopic={quizModal.topic}
          initialSubjectId={subjectId}
          initialSubjectName={selectedSubject?.name}
          initialMistakeTag={quizModal.mistakeTag}
        />
      )}
    </div>
  );
}
