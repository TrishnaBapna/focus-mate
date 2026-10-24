import type { Timestamp } from "firebase/firestore";
import type { PaperMistakeTag } from "./paper";

export type RevisionTaskStatus = "pending" | "in_progress" | "completed" | "skipped";

export type RevisionTaskPriority = "urgent" | "high" | "medium" | "low";

export type RevisionActionType =
  | "flashcards"
  | "practice_quiz"
  | "revision"
  | "read_notes"
  | "exam_prep";

export type RevisionEvidenceType =
  | "academic_mistake"
  | "weak_topic"
  | "upcoming_exam"
  | "unfinished_action"
  | "general";

export interface RevisionTask {
  id: string; // Unique deterministic identifier e.g. "rev-paper-xyz-act-1"
  sourceType: "paper_action" | "weak_topic" | "exam_syllabus" | "general_suggestion";
  sourceId?: string; // paperId, examId, or topicKey
  sourceActionId?: string; // action plan item ID if sourced from a paper
  sourcePaperTitle?: string;
  sourceQuestionNumbers?: string[];
  mistakeTag?: PaperMistakeTag;

  subjectId: string;
  subjectName: string;
  subjectEmoji: string;
  topic: string;

  title: string; // What to study or practice
  rationale: string; // Why the task was recommended (grounded in evidence)
  evidenceType: RevisionEvidenceType;
  concreteSteps: string[]; // Step-by-step guidance
  measurableGoal: string; // Specific completion criterion

  suggestedDurationMinutes: number;
  priority: RevisionTaskPriority;
  priorityScore: number;
  dueDate: string; // "YYYY-MM-DD"
  rescheduledDate?: string;

  status: RevisionTaskStatus;
  notes?: string;

  createdAt?: Timestamp | string | null;
  updatedAt?: Timestamp | string | null;
  completedAt?: Timestamp | string | null;
}

export type RevisionFilterTab =
  | "today"
  | "upcoming"
  | "overdue"
  | "completed"
  | "by_subject";

export interface SubjectRevisionProgress {
  subjectId: string;
  subjectName: string;
  subjectEmoji: string;
  totalTasks: number;
  completedTasks: number;
  pendingTasks: number;
  urgentTasks: number;
  completionRate: number; // 0 to 100
  upcomingExamDate?: string;
  daysUntilExam?: number;
}
