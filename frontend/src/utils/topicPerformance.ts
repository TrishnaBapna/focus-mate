import { daysUntil } from "./exams.ts";
import type {
  AssessmentResult,
  RevisionRecommendation,
  RevisionUrgency,
  TopicPerformance,
  TopicStatus,
  TopicTrend,
} from "../types/assessment.ts";
import type { Exam } from "../types/exam.ts";

/**
 * Normalizes a topic key for consistent grouping across subjects and topics.
 * Format: `<subjectId>::<lowercaseTopic>`
 */
export function normalizeTopicKey(subjectId: string | undefined, topic: string): string {
  const s = (subjectId || "general").trim();
  const t = topic.trim().toLowerCase();
  return `${s}::${t}`;
}

/**
 * Calculates a safe accuracy ratio (0.0 to 1.0) clamped and rounded to 3 decimal places.
 * Handles zeroes, negative scores, NaNs, and division by zero cleanly.
 */
export function calculateAccuracy(score: number, total: number): number {
  if (typeof total !== "number" || typeof score !== "number" || isNaN(total) || isNaN(score) || total <= 0) {
    return 0;
  }
  const safeScore = Math.max(0, Math.min(score, total));
  return Math.round((safeScore / total) * 1000) / 1000;
}

/**
 * Filters out malformed records and removes exact duplicate assessment IDs.
 */
export function deDuplicateAssessments(assessments: AssessmentResult[]): AssessmentResult[] {
  if (!Array.isArray(assessments)) return [];

  const seenIds = new Set<string>();
  const valid: AssessmentResult[] = [];

  for (const a of assessments) {
    if (!a || typeof a !== "object") continue;
    if (!a.topic || typeof a.topic !== "string" || !a.topic.trim()) continue;
    if (typeof a.totalQuestions !== "number" || isNaN(a.totalQuestions) || a.totalQuestions <= 0) continue;
    if (typeof a.score !== "number" || isNaN(a.score) || a.score < 0) continue;

    // Deduplicate by assessment ID if provided
    if (a.id) {
      if (seenIds.has(a.id)) continue;
      seenIds.add(a.id);
    }

    valid.push({
      ...a,
      topic: a.topic.trim(),
      subjectId: (a.subjectId || "").trim(),
      subjectName: (a.subjectName || "General").trim(),
      accuracy: calculateAccuracy(a.score, a.totalQuestions),
    });
  }

  return valid;
}

/**
 * Minimum evidence criteria:
 * A topic requires at least 2 separate attempts and at least 5 total questions
 * before it is confidently classified as "needs_revision", "improving", or "on_track".
 */
export const MIN_ATTEMPTS_REQUIRED = 2;
export const MIN_QUESTIONS_REQUIRED = 5;

/**
 * Thresholds:
 * - Needs Revision: overall < 65% and recent < 70% (or recent attempt < 50%)
 * - Improving: overall < 75% but recent >= 75%
 * - On Track: overall >= 65% and recent >= 65%
 */
export const PASSING_THRESHOLD = 0.65;
export const MASTERY_THRESHOLD = 0.75;

export interface ClassifyOptions {
  reviewedMap?: Map<string, string>; // topicKey -> ISO date string when marked reviewed
  now?: Date;
}

/**
 * Analyzes assessment history by topic and computes transparent performance metrics.
 */
export function classifyTopicPerformance(
  assessments: AssessmentResult[],
  options: ClassifyOptions = {}
): TopicPerformance[] {
  const cleanAssessments = deDuplicateAssessments(assessments);
  if (cleanAssessments.length === 0) return [];

  const now = options.now ?? new Date();
  const reviewedMap = options.reviewedMap ?? new Map<string, string>();

  // 1. Group assessments by normalized topic key
  const byTopic = new Map<string, AssessmentResult[]>();
  for (const a of cleanAssessments) {
    const key = normalizeTopicKey(a.subjectId, a.topic);
    const list = byTopic.get(key) ?? [];
    list.push(a);
    byTopic.set(key, list);
  }

  const results: TopicPerformance[] = [];

  for (const [topicKey, items] of byTopic.entries()) {
    // Sort chronologically: oldest first
    items.sort((x, y) => {
      const timeX = x.createdAt?.toMillis ? x.createdAt.toMillis() : 0;
      const timeY = y.createdAt?.toMillis ? y.createdAt.toMillis() : 0;
      return timeX - timeY;
    });

    const representative = items[items.length - 1];
    const totalAttempts = items.length;
    let totalQuestions = 0;
    let totalCorrect = 0;

    for (const item of items) {
      totalQuestions += item.totalQuestions;
      totalCorrect += Math.min(item.score, item.totalQuestions);
    }

    const overallAccuracy = calculateAccuracy(totalCorrect, totalQuestions);

    // Recent accuracy: calculated from the latest completed attempt
    const latestItem = items[items.length - 1];
    const recentAccuracy = calculateAccuracy(latestItem.score, latestItem.totalQuestions);

    // Trend analysis
    let trend: TopicTrend = "insufficient_data";
    if (totalAttempts >= 2) {
      if (recentAccuracy >= overallAccuracy + 0.1) {
        trend = "improving";
      } else if (recentAccuracy <= overallAccuracy - 0.1) {
        trend = "declining";
      } else {
        trend = "stable";
      }
    }

    // Determine status & transparent reason based on documented rules
    let status: TopicStatus;
    let statusReason: string;

    const hasSufficientData =
      totalAttempts >= MIN_ATTEMPTS_REQUIRED && totalQuestions >= MIN_QUESTIONS_REQUIRED;

    if (!hasSufficientData) {
      status = "not_enough_data";
      statusReason = `Needs at least ${MIN_ATTEMPTS_REQUIRED} attempts and ${MIN_QUESTIONS_REQUIRED} questions for reliable classification (currently ${totalAttempts} attempt${totalAttempts === 1 ? "" : "s"}, ${totalQuestions} question${totalQuestions === 1 ? "" : "s"}).`;
    } else if (overallAccuracy < PASSING_THRESHOLD && recentAccuracy < 0.7) {
      status = "needs_revision";
      statusReason = `Demonstrated low accuracy (${Math.round(overallAccuracy * 100)}% overall, ${Math.round(recentAccuracy * 100)}% recent) across ${totalAttempts} attempts. Needs targeted review.`;
    } else if (recentAccuracy < 0.5) {
      status = "needs_revision";
      statusReason = `Latest attempt dropped significantly to ${Math.round(recentAccuracy * 100)}%. Immediate revision recommended.`;
    } else if (overallAccuracy < MASTERY_THRESHOLD && recentAccuracy >= MASTERY_THRESHOLD) {
      status = "improving";
      statusReason = `Strong recent progress: latest score is ${Math.round(recentAccuracy * 100)}% (up from ${Math.round(overallAccuracy * 100)}% overall).`;
    } else {
      status = "on_track";
      statusReason = `Solid performance: ${Math.round(overallAccuracy * 100)}% overall accuracy across ${totalQuestions} questions.`;
    }

    // Review tracking: check if marked reviewed recently (within last 7 days)
    const reviewedIso = reviewedMap.get(topicKey);
    let isReviewedRecently = false;
    if (reviewedIso) {
      const reviewedTime = new Date(reviewedIso).getTime();
      const sevenDaysMs = 7 * 24 * 60 * 60 * 1000;
      if (!isNaN(reviewedTime) && now.getTime() - reviewedTime <= sevenDaysMs) {
        isReviewedRecently = true;
      }
    }

    const lastAttemptDate = representative.createdAt?.toDate
      ? representative.createdAt.toDate().toISOString()
      : null;

    results.push({
      topicKey,
      topic: representative.topic,
      subjectId: representative.subjectId,
      subjectName: representative.subjectName,
      subjectEmoji: representative.subjectEmoji || "📚",
      totalAttempts,
      totalQuestions,
      totalCorrect,
      overallAccuracy,
      recentAccuracy,
      trend,
      status,
      statusReason,
      lastAttemptAt: lastAttemptDate,
      lastReviewedAt: reviewedIso ?? null,
      isReviewedRecently,
    });
  }

  // Sort: Needs revision first, then improving, not enough data, on track
  const statusRank: Record<TopicStatus, number> = {
    needs_revision: 0,
    improving: 1,
    not_enough_data: 2,
    on_track: 3,
  };

  return results.sort((a, b) => {
    const rankDiff = statusRank[a.status] - statusRank[b.status];
    if (rankDiff !== 0) return rankDiff;
    return a.overallAccuracy - b.overallAccuracy;
  });
}

/**
 * Builds smart revision recommendations combining:
 * 1. Demonstrated weak topics (from actual assessment results).
 * 2. Upcoming exams & syllabus topics (within next 21 days).
 * 3. User reviewed state (suppressing or demoting reviewed topics without changing scores).
 */
export function buildRevisionRecommendations(
  topics: TopicPerformance[],
  exams: Exam[] = [],
  reviewedMap: Map<string, string> = new Map()
): RevisionRecommendation[] {
  const recommendations: RevisionRecommendation[] = [];

  // Helper to find relevant upcoming exams for a topic or subject
  function findUpcomingExam(subjectId: string, topicName: string) {
    const lowerTopic = topicName.toLowerCase();
    for (const exam of exams) {
      const days = daysUntil(exam.date);
      if (days < 0 || days > 21) continue;

      const isSameSubject = exam.subjectId && exam.subjectId === subjectId;
      const isInSyllabus = exam.syllabus.some((s) =>
        s.title.toLowerCase().includes(lowerTopic) || lowerTopic.includes(s.title.toLowerCase())
      );

      if (isInSyllabus || isSameSubject) {
        return { exam, days, inSyllabus: isInSyllabus };
      }
    }
    return null;
  }

  for (const topic of topics) {
    const examMatch = findUpcomingExam(topic.subjectId, topic.topic);
    const isReviewed = topic.isReviewedRecently || !!reviewedMap.get(topic.topicKey);

    let priority = 0;
    let urgency: RevisionUrgency = "medium";
    let reason: string;

    // Base priority by status
    if (topic.status === "needs_revision") {
      priority += 100;
      // Lower accuracy adds higher urgency
      priority += Math.round((1 - topic.overallAccuracy) * 40);
      reason = `Scored ${Math.round(topic.overallAccuracy * 100)}% across ${topic.totalAttempts} attempts. Needs targeted revision.`;
    } else if (topic.status === "improving") {
      priority += 50;
      reason = `Improving (${Math.round(topic.recentAccuracy * 100)}% on recent quiz), but still below mastery. Solidify knowledge.`;
    } else if (topic.status === "not_enough_data") {
      priority += 25;
      reason = `Only ${topic.totalAttempts} assessment recorded. Take a quick quiz to check topic mastery.`;
    } else {
      // on_track
      priority += 10;
      reason = `Mastery on track (${Math.round(topic.overallAccuracy * 100)}%). Keep fresh with periodic review.`;
    }

    // Exam proximity bonus
    if (examMatch) {
      const days = examMatch.days;
      const when = days === 0 ? "today" : days === 1 ? "tomorrow" : `in ${days} days`;
      if (days <= 3) {
        priority += 65;
        urgency = "urgent";
      } else if (days <= 7) {
        priority += 45;
        urgency = priority >= 130 ? "urgent" : "high";
      } else if (days <= 14) {
        priority += 25;
        urgency = priority >= 110 ? "high" : "medium";
      } else {
        priority += 10;
      }

      const syllabusNote = examMatch.inSyllabus ? " (on syllabus)" : "";
      reason = `Crucial for ${examMatch.exam.name} ${when}${syllabusNote}. ${reason}`;
    } else {
      urgency = priority >= 120 ? "high" : priority >= 60 ? "medium" : "low";
    }

    // Demote reviewed topics
    if (isReviewed) {
      priority = Math.max(1, priority - 120);
      urgency = "low";
      reason = `Marked reviewed recently · ${reason}`;
    }

    // Determine suggested action
    let suggestedAction: "quiz" | "flashcards" | "notes";
    if (topic.status === "needs_revision") {
      suggestedAction = "notes";
    } else if (topic.status === "improving" || topic.status === "not_enough_data") {
      suggestedAction = "quiz";
    } else {
      suggestedAction = "flashcards";
    }

    recommendations.push({
      id: `rec-${topic.topicKey}`,
      topicKey: topic.topicKey,
      topic: topic.topic,
      subjectId: topic.subjectId,
      subjectName: topic.subjectName,
      subjectEmoji: topic.subjectEmoji,
      priority,
      urgency,
      reason,
      examId: examMatch?.exam.id,
      examName: examMatch?.exam.name,
      examDate: examMatch?.exam.date,
      daysUntilExam: examMatch?.days,
      isReviewed,
      accuracyPercent:
        topic.status === "not_enough_data" ? null : Math.round(topic.overallAccuracy * 100),
      status: topic.status,
      suggestedAction,
    });
  }

  // Also surface upcoming exam syllabus items that haven't been completed yet
  for (const exam of exams) {
    const days = daysUntil(exam.date);
    if (days < 0 || days > 21) continue;

    for (const item of exam.syllabus) {
      if (item.done) continue;
      const key = normalizeTopicKey(exam.subjectId, item.title);
      // If already surfaced from assessments, skip duplicate
      if (recommendations.some((r) => r.topicKey === key)) continue;

      const isReviewed = !!reviewedMap.get(key);
      const when = days === 0 ? "today" : days === 1 ? "tomorrow" : `in ${days} days`;
      let priority = 70 + (21 - days);
      if (isReviewed) priority = Math.max(1, priority - 100);

      recommendations.push({
        id: `rec-syllabus-${exam.id}-${item.id}`,
        topicKey: key,
        topic: item.title,
        subjectId: exam.subjectId,
        subjectName: exam.subjectName,
        subjectEmoji: exam.subjectEmoji || "🎓",
        priority,
        urgency: days <= 5 && !isReviewed ? "urgent" : days <= 10 && !isReviewed ? "high" : "medium",
        reason: `Syllabus topic for ${exam.name} (${when}). Not marked completed yet.`,
        examId: exam.id,
        examName: exam.name,
        examDate: exam.date,
        daysUntilExam: days,
        isReviewed,
        accuracyPercent: null,
        status: "not_enough_data",
        suggestedAction: "notes",
      });
    }
  }

  // Sort descending by priority (highest urgency first)
  return recommendations.sort((a, b) => b.priority - a.priority);
}

export function getStatusLabel(status: TopicStatus): string {
  switch (status) {
    case "needs_revision":
      return "Needs Revision";
    case "improving":
      return "Improving";
    case "on_track":
      return "On Track";
    case "not_enough_data":
      return "Not Enough Data";
  }
}

export function getStatusBadgeClass(status: TopicStatus): string {
  switch (status) {
    case "needs_revision":
      return "badge-danger";
    case "improving":
      return "badge-warning";
    case "on_track":
      return "badge-success";
    case "not_enough_data":
      return "badge-neutral";
  }
}
