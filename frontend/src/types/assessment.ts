import type { Timestamp } from "firebase/firestore";

export type AssessmentSource = "quiz" | "flashcards" | "test" | "manual";

export interface AssessmentResult {
  id: string;
  subjectId: string;
  subjectName: string;
  subjectEmoji?: string;
  topic: string;
  score: number; // e.g. 3
  totalQuestions: number; // e.g. 5
  accuracy: number; // 0.0 to 1.0 (score / totalQuestions)
  incorrectAnswers?: string[]; // optional notes or question summaries
  source: AssessmentSource;
  createdAt?: Timestamp | null;
}

export type TopicStatus =
  | "needs_revision"
  | "improving"
  | "on_track"
  | "not_enough_data";

export type TopicTrend =
  | "improving"
  | "declining"
  | "stable"
  | "insufficient_data";

export interface TopicPerformance {
  topicKey: string; // unique identifier: `${subjectId || "general"}::${topic.toLowerCase()}`
  topic: string;
  subjectId: string;
  subjectName: string;
  subjectEmoji: string;
  totalAttempts: number;
  totalQuestions: number;
  totalCorrect: number;
  overallAccuracy: number; // 0.0 to 1.0
  recentAccuracy: number; // weighted or latest attempt accuracy
  trend: TopicTrend;
  status: TopicStatus;
  statusReason: string; // human-readable explanation of why this status was assigned
  lastAttemptAt: string | null; // ISO string or human date
  lastReviewedAt: string | null;
  isReviewedRecently: boolean;
}

export type RevisionUrgency = "urgent" | "high" | "medium" | "low";

export interface RevisionRecommendation {
  id: string;
  topicKey: string;
  topic: string;
  subjectId: string;
  subjectName: string;
  subjectEmoji: string;
  priority: number; // numerical priority score for sorting
  urgency: RevisionUrgency;
  reason: string;
  examId?: string;
  examName?: string;
  examDate?: string;
  daysUntilExam?: number;
  isReviewed: boolean;
  accuracyPercent: number | null;
  status: TopicStatus;
  suggestedAction: "quiz" | "flashcards" | "notes";
}

export interface ReviewedTopicRecord {
  topicKey: string;
  topic: string;
  subjectId: string;
  reviewedAt: Timestamp | null;
}
