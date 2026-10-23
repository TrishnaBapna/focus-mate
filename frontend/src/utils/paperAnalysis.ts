import { askAi, extractJson } from "../services/ai";
import { getApiKeyFor, getModelFor, getProvider } from "./aiSettings";
import type {
  PaperActionItem,
  PaperMistakeTag,
  PaperType,
  QuestionAnalysis,
} from "../types/paper";

interface AiExtractionResponse {
  questions?: Array<{
    questionNumber?: string;
    questionText?: string;
    studentAnswerText?: string;
    maxMarks?: number;
    topic?: string;
    uncertainMatch?: boolean;
  }>;
}

interface AiEvaluationResponse {
  evaluations?: Array<{
    questionNumber?: string;
    estimatedMarks?: number;
    strengthPoints?: string[];
    mistakePoints?: string[];
    mistakeTag?: PaperMistakeTag;
    feedback?: string;
  }>;
}

interface AiActionPlanResponse {
  actionPlan?: Array<{
    priority?: "high" | "medium" | "low";
    topic?: string;
    recommendation?: string;
    actionType?: "flashcards" | "revision" | "practice_quiz" | "read_notes";
  }>;
}

function getAiOptions(uid?: string, maxTokens = 2500) {
  const provider = getProvider(uid ?? null);
  const apiKey = getApiKeyFor(provider, uid ?? null);
  const model = getModelFor(provider, uid ?? null);
  return { provider, apiKey, model, maxTokens };
}

/**
 * Heuristic fallback parser when AI is unavailable or text is plain.
 * Identifies question patterns like "Q1.", "Question 1:", "1.", "1)"
 */
export function parseQuestionsFallback(rawText: string): QuestionAnalysis[] {
  const lines = rawText.split(/\r?\n/);
  const results: QuestionAnalysis[] = [];

  const qRegex = /^\s*(?:question\s*(\d+[a-z]?)|q(?:uestion)?\.?\s*(\d+[a-z]?)|(\d+[a-z]?)\s*[.)]|\((\d+[a-z]?)\))\s*(.*)$/i;

  let currentNumber = "";
  let currentText = "";

  for (const line of lines) {
    const match = line.match(qRegex);
    if (match) {
      if (currentNumber && currentText.trim()) {
        results.push({
          id: `q_${Date.now()}_${results.length + 1}`,
          questionNumber: currentNumber,
          questionText: currentText.trim(),
          maxMarks: 5,
          uncertainMatch: false,
          needsManualReview: false,
        });
      }
      currentNumber = match[1] || match[2] || match[3] || match[4] || `${results.length + 1}`;
      currentText = match[5] || "";
    } else {
      if (currentNumber) {
        currentText += "\n" + line;
      }
    }
  }

  if (currentNumber && currentText.trim()) {
    results.push({
      id: `q_${Date.now()}_${results.length + 1}`,
      questionNumber: currentNumber,
      questionText: currentText.trim(),
      maxMarks: 5,
      uncertainMatch: false,
      needsManualReview: false,
    });
  }

  // If no questions detected at all, treat whole text as Question 1
  if (results.length === 0 && rawText.trim()) {
    results.push({
      id: `q_${Date.now()}_1`,
      questionNumber: "1",
      questionText: rawText.trim(),
      maxMarks: 10,
      uncertainMatch: true,
      needsManualReview: true,
    });
  }

  return results;
}

/**
 * Extracts structured questions, student answers, and marks from raw paper text via AI.
 */
export async function extractQuestionsFromText(
  rawText: string,
  subjectName?: string,
  syllabusTopics?: string[],
  uid?: string
): Promise<QuestionAnalysis[]> {
  const trimmed = rawText.trim();
  if (!trimmed) return [];

  const syllabusPrompt =
    syllabusTopics && syllabusTopics.length > 0
      ? `Available subject syllabus topics for matching: ${JSON.stringify(syllabusTopics)}`
      : "";

  const system =
    "You are an expert academic paper analyzer. Your job is to extract individual exam/practice questions and the student's handwritten or typed answers from the provided document text. " +
    "Be strict, precise, and never fabricate questions or answers that are not supported by the document. " +
    "If the student's answer or question boundary is ambiguous or has low OCR clarity, mark uncertainMatch: true.";

  const prompt = `Inspect the following document text${
    subjectName ? ` from the subject "${subjectName}"` : ""
  }.
${syllabusPrompt}

Extract all questions into JSON format. For each question provide:
- questionNumber: e.g. "1", "1a", "2", "3b"
- questionText: complete text of the question
- studentAnswerText: the student's answer if present in the text, or empty string "" if this is a blank question paper
- maxMarks: maximum marks allocated (default to 5 if not explicitly specified)
- topic: specific syllabus topic or subtopic
- uncertainMatch: boolean (true if question/answer split was ambiguous or text was partially degraded)

Reply ONLY with valid JSON in this shape:
{
  "questions": [
    {
      "questionNumber": "1",
      "questionText": "...",
      "studentAnswerText": "...",
      "maxMarks": 5,
      "topic": "...",
      "uncertainMatch": false
    }
  ]
}

DOCUMENT TEXT:
"""
${trimmed.slice(0, 18000)}
"""`;

  try {
    const aiOpts = getAiOptions(uid, 3000);
    const responseText = await askAi({
      ...aiOpts,
      system,
      prompt,
      json: true,
    });

    const parsed = extractJson(responseText) as AiExtractionResponse;
    const list = Array.isArray(parsed?.questions) ? parsed.questions : [];

    if (list.length === 0) {
      return parseQuestionsFallback(trimmed);
    }

    return list.map((item, idx) => ({
      id: `q_${Date.now()}_${idx + 1}`,
      questionNumber: item.questionNumber || `${idx + 1}`,
      questionText: item.questionText || `Question ${idx + 1}`,
      studentAnswerText: item.studentAnswerText || "",
      maxMarks: typeof item.maxMarks === "number" && item.maxMarks > 0 ? item.maxMarks : 5,
      topic: item.topic || "",
      uncertainMatch: Boolean(item.uncertainMatch),
      needsManualReview: Boolean(item.uncertainMatch),
    }));
  } catch (err) {
    console.warn("AI question extraction error, falling back to heuristic parser:", err);
    return parseQuestionsFallback(trimmed);
  }
}

/**
 * Generates formative feedback and AI marks estimates for each question.
 * Note: Never modifies teacherAwardedMarks.
 */
export async function evaluateQuestionsWithAi(
  questions: QuestionAnalysis[],
  paperType: PaperType,
  subjectName?: string,
  uid?: string
): Promise<QuestionAnalysis[]> {
  if (questions.length === 0) return [];

  const questionsPayload = questions.map((q) => ({
    questionNumber: q.questionNumber,
    questionText: q.questionText,
    studentAnswerText: q.studentAnswerText ?? "",
    maxMarks: q.maxMarks,
    topic: q.topic ?? "",
  }));

  const system =
    "You are a rigorous, encouraging academic examiner. Evaluate the student's answer to each question against academic standards. " +
    "Provide constructive feedback, key strengths, specific mistakes made, and categorize the mistake type (conceptual, calculation, misread_question, incomplete, time_pressure, other). " +
    "Provide a realistic estimated score out of maxMarks based on rubric criteria. Never invent facts or inflate marks.";

  const prompt = `Evaluate the student's answers for ${paperType === "exam" ? "official exam paper" : "practice paper"} in ${
    subjectName ?? "the subject"
  }.

Questions & Student Answers:
${JSON.stringify(questionsPayload, null, 2)}

Reply ONLY with valid JSON in this shape:
{
  "evaluations": [
    {
      "questionNumber": "1",
      "estimatedMarks": 4,
      "strengthPoints": ["Clear explanation of first principle", "Correct formula stated"],
      "mistakePoints": ["Arithmetic error in final simplification step"],
      "mistakeTag": "calculation",
      "feedback": "Strong conceptual understanding shown. Watch out for arithmetic sign errors in step 3."
    }
  ]
}`;

  try {
    const aiOpts = getAiOptions(uid, 3500);
    const responseText = await askAi({
      ...aiOpts,
      system,
      prompt,
      json: true,
    });

    const parsed = extractJson(responseText) as AiEvaluationResponse;
    const evals = Array.isArray(parsed?.evaluations) ? parsed.evaluations : [];
    const evalMap = new Map(evals.map((e) => [String(e.questionNumber), e]));

    return questions.map((q) => {
      const evaluation = evalMap.get(String(q.questionNumber));
      if (!evaluation) return q;

      const estimated =
        typeof evaluation.estimatedMarks === "number"
          ? Math.max(0, Math.min(q.maxMarks, evaluation.estimatedMarks))
          : undefined;

      const allowedTags: PaperMistakeTag[] = [
        "conceptual",
        "calculation",
        "misread_question",
        "incomplete",
        "time_pressure",
        "other",
      ];
      const tag: PaperMistakeTag | undefined =
        evaluation.mistakeTag && allowedTags.includes(evaluation.mistakeTag)
          ? evaluation.mistakeTag
          : undefined;

      return {
        ...q,
        aiEstimatedMarks: estimated ?? q.aiEstimatedMarks,
        strengthPoints: evaluation.strengthPoints ?? [],
        mistakePoints: evaluation.mistakePoints ?? [],
        mistakeTag: tag,
        aiFeedback: evaluation.feedback ?? "",
      };
    });
  } catch (err) {
    console.warn("AI evaluation failed:", err);
    return questions;
  }
}

/**
 * Generates an evidence-based, prioritized action plan from question analysis.
 */
export async function generateActionPlanFromMistakes(
  questions: QuestionAnalysis[],
  paperTitle: string,
  subjectName?: string,
  uid?: string
): Promise<PaperActionItem[]> {
  const weakQuestions = questions.filter((q) => {
    const marksObtained =
      q.teacherAwardedMarks ?? q.studentEnteredMarks ?? q.aiEstimatedMarks ?? q.maxMarks;
    return marksObtained < q.maxMarks;
  });

  if (weakQuestions.length === 0) {
    return [
      {
        id: `plan_${Date.now()}_1`,
        priority: "low",
        topic: subjectName ?? "General",
        recommendation: "Excellent performance across all questions. Consolidate your knowledge with spaced repetition flashcards.",
        actionType: "flashcards",
        completed: false,
      },
    ];
  }

  const payload = weakQuestions.map((q) => ({
    questionNumber: q.questionNumber,
    topic: q.topic || "General",
    maxMarks: q.maxMarks,
    marksScored: q.teacherAwardedMarks ?? q.studentEnteredMarks ?? q.aiEstimatedMarks ?? 0,
    mistakes: q.mistakePoints,
    tag: q.mistakeTag,
  }));

  const system =
    "You are an academic learning strategist. Formulate a targeted, prioritized study revision plan based only on the specific mistakes made by the student.";

  const prompt = `Based on the following mistakes and mark losses in "${paperTitle}" (${subjectName ?? "Subject"}), generate 3 to 5 actionable study items.

Mistake Summary:
${JSON.stringify(payload, null, 2)}

Reply ONLY with valid JSON in this shape:
{
  "actionPlan": [
    {
      "priority": "high",
      "topic": "Electromagnetism",
      "recommendation": "Review Faraday's law sign conventions and solve 3 practice numericals.",
      "actionType": "revision"
    }
  ]
}
allowed actionTypes: "flashcards", "revision", "practice_quiz", "read_notes"
allowed priorities: "high", "medium", "low"`;

  try {
    const aiOpts = getAiOptions(uid, 2000);
    const responseText = await askAi({
      ...aiOpts,
      system,
      prompt,
      json: true,
    });

    const parsed = extractJson(responseText) as AiActionPlanResponse;
    const items = Array.isArray(parsed?.actionPlan) ? parsed.actionPlan : [];

    if (items.length === 0) throw new Error("Empty action plan");

    return items.map((item, idx) => ({
      id: `plan_${Date.now()}_${idx + 1}`,
      priority: item.priority ?? "medium",
      topic: item.topic ?? (subjectName || "Review"),
      recommendation: item.recommendation ?? "Review missed concepts.",
      actionType: item.actionType ?? "revision",
      completed: false,
    }));
  } catch (err) {
    console.warn("Failed to generate AI action plan, using heuristic items:", err);
    return weakQuestions.slice(0, 4).map((q, idx) => ({
      id: `plan_${Date.now()}_${idx + 1}`,
      priority: idx === 0 ? "high" : "medium",
      topic: q.topic || subjectName || `Question ${q.questionNumber}`,
      recommendation: `Review errors on Question ${q.questionNumber}: ${
        q.mistakePoints?.[0] || "check conceptual foundation and practice similar problems."
      }`,
      actionType: "flashcards",
      completed: false,
    }));
  }
}
