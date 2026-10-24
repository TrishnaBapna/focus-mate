import type { Timestamp } from "firebase/firestore";

export type PaperType = "practice" | "exam";

export type PaperStatus = "draft" | "extracting" | "ready_for_review" | "analyzed";

export type PaperSourceType = "pdf" | "image" | "text";

export type PaperMistakeTag =
  | "conceptual"
  | "calculation"
  | "misread_question"
  | "incomplete"
  | "time_pressure"
  | "other";

export interface QuestionAnalysis {
  id: string;
  questionNumber: string;
  questionText: string;
  studentAnswerText?: string;
  modelAnswerText?: string;
  maxMarks: number;
  /**
   * Teacher-awarded marks (stored for official exam papers or graded scripts).
   * Kept strictly separate from student self-marks and AI estimates.
   */
  teacherAwardedMarks?: number | null;
  /**
   * Marks entered by the student during self-assessment (for practice papers).
   */
  studentEnteredMarks?: number | null;
  /**
   * AI-estimated marks based on rubric / model answer comparison.
   * Kept strictly separate from official teacher-awarded marks.
   */
  aiEstimatedMarks?: number | null;
  topic?: string;
  syllabusItemId?: string;
  aiFeedback?: string;
  strengthPoints?: string[];
  mistakePoints?: string[];
  mistakeTag?: PaperMistakeTag;
  recurringMistakeTag?: string;
  uncertainMatch?: boolean;
  needsManualReview?: boolean;
}

export type PaperScoreType = "teacher" | "student" | "ai" | "none";

export interface PaperSummary {
  totalQuestions: number;
  maxMarks: number;
  gradedQuestionsCount?: number;
  isGradingComplete?: boolean;
  gradedMaxMarks?: number | null;
  totalTeacherMarks?: number | null;
  totalStudentMarks?: number | null;
  totalAiEstimatedMarks?: number | null;
  percentage?: number | null;
  scoreType?: PaperScoreType;
}

export interface PaperActionItem {
  id: string;
  priority: "high" | "medium" | "low";
  topic: string;
  recommendation: string;
  actionType: "flashcards" | "revision" | "practice_quiz" | "read_notes";
  completed: boolean;
}

export interface Paper {
  id: string;
  title: string;
  paperType: PaperType;
  subjectId?: string;
  subjectName?: string;
  subjectEmoji?: string;
  examId?: string;
  date: string; // YYYY-MM-DD
  status: PaperStatus;
  sourceType: PaperSourceType;
  aiProcessingConsentGiven: boolean;
  rawExtractedText?: string;
  summary: PaperSummary;
  questions: QuestionAnalysis[];
  actionPlan: PaperActionItem[];
  createdAt?: Timestamp | null;
  updatedAt?: Timestamp | null;
}
