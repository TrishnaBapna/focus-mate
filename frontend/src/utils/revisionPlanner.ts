import type { Exam } from "../types/exam";
import type { Paper, PaperMistakeTag } from "../types/paper";
import type { Subject } from "../types";
import type { TopicPerformance } from "../types/assessment";
import type {
  RevisionFilterTab,
  RevisionTask,
  RevisionTaskPriority,
  RevisionTaskStatus,
  SubjectRevisionProgress,
} from "../types/revision";
import type { RevisionTaskRecord } from "../services/revisionPlanner";
import { daysUntil } from "./exams.ts";
import { computeTopicMasteryFromPapers, MISTAKE_METADATA } from "./academicAnalytics.ts";

export interface GenerateRevisionParams {
  papers: Paper[];
  exams?: Exam[];
  subjects?: Subject[];
  subjectGoals?: Record<string, number>;
  topics?: TopicPerformance[];
  savedRecords?: RevisionTaskRecord[];
  todayDate?: string; // "YYYY-MM-DD"
}

export function getTodayDateString(): string {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, "0");
  const d = String(now.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

export function addDaysToDateString(dateStr: string, days: number): string {
  const [y, m, d] = dateStr.split("-").map(Number);
  const date = new Date(y, m - 1, d);
  date.setDate(date.getDate() + days);
  const nextY = date.getFullYear();
  const nextM = String(date.getMonth() + 1).padStart(2, "0");
  const nextD = String(date.getDate()).padStart(2, "0");
  return `${nextY}-${nextM}-${nextD}`;
}

/**
 * Synthesizes personalized revision recommendations from:
 * 1. Unfinished Paper Analysis action plans & question mistake tags
 * 2. Weak topics (< 65% accuracy) identified by academic diagnostic analysis
 * 3. Upcoming exam dates and syllabus milestones
 * 4. General baseline tasks when diagnostic evidence is sparse
 */
export function generatePersonalizedRevisionTasks(params: GenerateRevisionParams): RevisionTask[] {
  const {
    papers = [],
    exams = [],
    subjects = [],
    topics = [],
    savedRecords = [],
    todayDate = getTodayDateString(),
  } = params;

  const savedMap = new Map<string, RevisionTaskRecord>();
  for (const rec of savedRecords) {
    savedMap.set(rec.id, rec);
  }

  const generatedTasks: RevisionTask[] = [];
  const coveredTopicKeys = new Set<string>();

  // Helper to find upcoming exam for a subject or topic
  function findExamForSubject(subjectId?: string, topicName?: string) {
    if (!exams.length) return null;
    const lowerTopic = (topicName || "").trim().toLowerCase();

    for (const exam of exams) {
      if (!exam.date) continue;
      const days = daysUntil(exam.date, new Date(todayDate));
      if (days < 0 || days > 30) continue;

      const isSameSubject = subjectId && exam.subjectId === subjectId;
      const isInSyllabus =
        lowerTopic &&
        exam.syllabus?.some((s) => s.title.toLowerCase().includes(lowerTopic));

      if (isSameSubject || isInSyllabus) {
        return { exam, days, inSyllabus: !!isInSyllabus };
      }
    }
    return null;
  }

  // Helper to format due date based on exam proximity or default spacing
  function calculateDueDate(daysOffset: number, examDays?: number): string {
    if (typeof examDays === "number") {
      if (examDays <= 1) return todayDate;
      if (examDays <= 3) return addDaysToDateString(todayDate, 1);
      return addDaysToDateString(todayDate, Math.min(daysOffset, Math.max(1, examDays - 2)));
    }
    return addDaysToDateString(todayDate, daysOffset);
  }

  let paceOffset = 0;

  // -------------------------------------------------------------
  // SOURCE 1: Unfinished Paper Action Items (Direct Evidence)
  // -------------------------------------------------------------
  for (const paper of papers) {
    if (!Array.isArray(paper.actionPlan) || paper.actionPlan.length === 0) continue;

    for (const action of paper.actionPlan) {
      const rawTopic = action.topic.toLowerCase().trim();
      const topicKey = `${paper.subjectId || "gen"}::${rawTopic}`;
      if (coveredTopicKeys.has(rawTopic) || coveredTopicKeys.has(topicKey)) continue;

      const taskId = `rev-paper-${paper.id}-${action.id}`;
      const saved = savedMap.get(taskId);

      // Status resolution
      let status: RevisionTaskStatus = action.completed ? "completed" : "pending";
      if (saved && saved.status) {
        status = saved.status;
      }

      // Find questions in this paper related to this topic
      const relatedQuestions = (paper.questions || []).filter(
        (q) =>
          q.topic?.toLowerCase().trim() === action.topic?.toLowerCase().trim() ||
          q.strengthPoints?.some((s) => s.toLowerCase().includes(action.topic.toLowerCase())) ||
          q.mistakePoints?.some((m) => m.toLowerCase().includes(action.topic.toLowerCase()))
      );

      const qNumbers = relatedQuestions
        .map((q) => q.questionNumber)
        .filter(Boolean)
        .slice(0, 3);

      const mistakeTag: PaperMistakeTag | undefined =
        relatedQuestions.find((q) => q.mistakeTag)?.mistakeTag || undefined;

      const mistakeMeta = mistakeTag ? MISTAKE_METADATA[mistakeTag] : null;

      // Check upcoming exam
      const examMatch = findExamForSubject(paper.subjectId, action.topic);

      let priority: RevisionTaskPriority =
        action.priority === "high" ? "high" : action.priority === "low" ? "low" : "medium";
      let priorityScore = action.priority === "high" ? 70 : action.priority === "medium" ? 45 : 20;

      if (examMatch) {
        if (examMatch.days <= 3) {
          priority = "urgent";
          priorityScore += 60;
        } else if (examMatch.days <= 7) {
          priority = "high";
          priorityScore += 35;
        } else {
          priorityScore += 15;
        }
      }

      const qCitation = qNumbers.length > 0 ? ` (Q${qNumbers.join(", ")})` : "";
      const mistakeCitation = mistakeMeta ? ` · Top pattern: ${mistakeMeta.label}` : "";
      const examCitation = examMatch
        ? ` · Needed for ${examMatch.exam.name} in ${examMatch.days} days`
        : "";

      const rationale = `From paper "${paper.title}"${qCitation}${mistakeCitation}${examCitation}. ${action.recommendation}`;

      const concreteSteps = [
        `Review source question errors from "${paper.title}"${qCitation}.`,
        action.recommendation,
        `Solve 2-3 similar follow-up practice problems to verify full understanding.`,
      ];

      const measurableGoal = `Correctly solve 2 similar questions on "${action.topic}" without notes.`;

      const initialDueDate = calculateDueDate(paceOffset, examMatch?.days);
      const effectiveDueDate = saved?.rescheduledDate || initialDueDate;

      generatedTasks.push({
        id: taskId,
        sourceType: "paper_action",
        sourceId: paper.id,
        sourceActionId: action.id,
        sourcePaperTitle: paper.title,
        sourceQuestionNumbers: qNumbers,
        mistakeTag,
        subjectId: paper.subjectId || "",
        subjectName: paper.subjectName || "General",
        subjectEmoji: paper.subjectEmoji || "📄",
        topic: action.topic,
        title: `Fix ${action.topic}: ${action.recommendation}`,
        rationale,
        evidenceType: "academic_mistake",
        concreteSteps,
        measurableGoal,
        suggestedDurationMinutes: action.priority === "high" ? 45 : 30,
        priority,
        priorityScore,
        dueDate: effectiveDueDate,
        rescheduledDate: saved?.rescheduledDate,
        status,
        notes: saved?.notes,
      });

      coveredTopicKeys.add(action.topic.toLowerCase().trim());
      coveredTopicKeys.add(`${paper.subjectId || "gen"}::${action.topic.toLowerCase().trim()}`);
      if (status !== "completed") {
        paceOffset = (paceOffset + 1) % 4; // Pace tasks smoothly
      }
    }
  }

  // -------------------------------------------------------------
  // SOURCE 2: Weak Topics Identified by Paper Diagnostic (<65% accuracy)
  // -------------------------------------------------------------
  const paperTopics = computeTopicMasteryFromPapers(papers).filter((t) => t.needsAttention);
  for (const wt of paperTopics) {
    const rawTopic = wt.topic.toLowerCase().trim();
    const topicKey = `weak-paper::${rawTopic}`;
    if (coveredTopicKeys.has(rawTopic) || coveredTopicKeys.has(topicKey)) continue;

    const taskId = `rev-weak-${encodeURIComponent(wt.topic.toLowerCase().replace(/\s+/g, "-"))}`;
    const saved = savedMap.get(taskId);

    const examMatch = findExamForSubject(undefined, wt.topic);
    let priority: RevisionTaskPriority = wt.accuracy < 50 ? "high" : "medium";
    let priorityScore = Math.round((100 - wt.accuracy) * 0.8);

    if (examMatch) {
      if (examMatch.days <= 3) {
        priority = "urgent";
        priorityScore += 50;
      } else if (examMatch.days <= 7) {
        priority = "high";
        priorityScore += 30;
      }
    }

    const mistakeMeta = wt.topMistakeTag ? MISTAKE_METADATA[wt.topMistakeTag] : null;
    const mistakeText = mistakeMeta ? ` (${mistakeMeta.label})` : "";
    const examText = examMatch ? ` · Relevant for ${examMatch.exam.name} in ${examMatch.days}d` : "";

    const rationale = `Scored only ${wt.accuracy}% (${wt.marksEarned}/${wt.maxMarks} marks across ${wt.totalQuestions} questions)${mistakeText}${examText}.`;

    const concreteSteps = [
      `Review theory and core formulas for ${wt.topic}.`,
      wt.topMistakeTag === "calculation"
        ? "Work through calculation steps slowly and verify units."
        : wt.topMistakeTag === "conceptual"
        ? "Summarize the underlying concept in 3 bullet points before doing problems."
        : "Highlight keywords in each question before writing your answer.",
      "Complete a 5-question targeted quiz set to verify score recovery.",
    ];

    const initialDueDate = calculateDueDate(paceOffset, examMatch?.days);
    const effectiveDueDate = saved?.rescheduledDate || initialDueDate;

    generatedTasks.push({
      id: taskId,
      sourceType: "weak_topic",
      sourceId: wt.topic,
      mistakeTag: wt.topMistakeTag || undefined,
      subjectId: "",
      subjectName: wt.subjectName || "Core Topics",
      subjectEmoji: "⚡",
      topic: wt.topic,
      title: `Mastery Recovery: ${wt.topic}`,
      rationale,
      evidenceType: "weak_topic",
      concreteSteps,
      measurableGoal: `Attain >= 70% accuracy on 5 practice questions for ${wt.topic}.`,
      suggestedDurationMinutes: 35,
      priority,
      priorityScore,
      dueDate: effectiveDueDate,
      rescheduledDate: saved?.rescheduledDate,
      status: saved?.status || "pending",
      notes: saved?.notes,
    });

    coveredTopicKeys.add(rawTopic);
    coveredTopicKeys.add(topicKey);
    if (saved?.status !== "completed") {
      paceOffset = (paceOffset + 1) % 4;
    }
  }

  // -------------------------------------------------------------
  // SOURCE 3: Assessment Topics Needing Revision (<65% or failing)
  // -------------------------------------------------------------
  for (const at of topics) {
    if (at.status !== "needs_revision") continue;
    const rawTopic = at.topic.toLowerCase().trim();
    const topicKey = `${at.subjectId}::${rawTopic}`;
    if (coveredTopicKeys.has(rawTopic) || coveredTopicKeys.has(topicKey)) continue;

    const taskId = `rev-assess-${at.topicKey.replace(/[^a-zA-Z0-9_-]/g, "-")}`;
    const saved = savedMap.get(taskId);

    const examMatch = findExamForSubject(at.subjectId, at.topic);
    let priority: RevisionTaskPriority = at.overallAccuracy < 0.5 ? "high" : "medium";
    let priorityScore = Math.round((1 - at.overallAccuracy) * 80);

    if (examMatch) {
      if (examMatch.days <= 3) {
        priority = "urgent";
        priorityScore += 55;
      } else if (examMatch.days <= 7) {
        priority = "high";
        priorityScore += 30;
      }
    }

    const accuracyPct = Math.round(at.overallAccuracy * 100);
    const examText = examMatch ? ` · Upcoming exam: ${examMatch.exam.name} (${examMatch.days}d)` : "";

    const initialDueDate = calculateDueDate(paceOffset, examMatch?.days);
    const effectiveDueDate = saved?.rescheduledDate || initialDueDate;

    generatedTasks.push({
      id: taskId,
      sourceType: "weak_topic",
      sourceId: at.topicKey,
      subjectId: at.subjectId,
      subjectName: at.subjectName,
      subjectEmoji: at.subjectEmoji || "🎯",
      topic: at.topic,
      title: `Revision Drill: ${at.topic}`,
      rationale: `Diagnostic score is ${accuracyPct}% across ${at.totalAttempts} attempt(s)${examText}.`,
      evidenceType: "weak_topic",
      concreteSteps: [
        `Re-read notes on ${at.topic}.`,
        `Practice active recall using flashcards for this topic.`,
        `Take a 5-question check-up quiz to confirm accuracy above 65%.`,
      ],
      measurableGoal: `Pass 1 short review quiz with accuracy >= 70%.`,
      suggestedDurationMinutes: 30,
      priority,
      priorityScore,
      dueDate: effectiveDueDate,
      rescheduledDate: saved?.rescheduledDate,
      status: saved?.status || "pending",
      notes: saved?.notes,
    });

    coveredTopicKeys.add(rawTopic);
    coveredTopicKeys.add(topicKey);
    if (saved?.status !== "completed") {
      paceOffset = (paceOffset + 1) % 4;
    }
  }

  // -------------------------------------------------------------
  // SOURCE 4: Upcoming Exam Syllabus Items (within 21 days)
  // -------------------------------------------------------------
  for (const exam of exams) {
    if (!exam.date) continue;
    const days = daysUntil(exam.date, new Date(todayDate));
    if (days < 0 || days > 21) continue;

    for (const s of exam.syllabus || []) {
      if (s.done) continue;
      const rawTopic = s.title.toLowerCase().trim();
      const topicKey = `${exam.subjectId || "gen"}::${rawTopic}`;
      if (coveredTopicKeys.has(rawTopic) || coveredTopicKeys.has(topicKey)) continue;

      const taskId = `rev-exam-${exam.id}-${encodeURIComponent(s.title.toLowerCase().replace(/\s+/g, "-"))}`;
      const saved = savedMap.get(taskId);

      const priority: RevisionTaskPriority = days <= 3 ? "urgent" : days <= 7 ? "high" : "medium";
      const priorityScore = days <= 3 ? 90 : days <= 7 ? 65 : 40;

      const initialDueDate = calculateDueDate(paceOffset, days);
      const effectiveDueDate = saved?.rescheduledDate || initialDueDate;

      generatedTasks.push({
        id: taskId,
        sourceType: "exam_syllabus",
        sourceId: exam.id,
        subjectId: exam.subjectId || "",
        subjectName: exam.subjectName || "Exam Prep",
        subjectEmoji: exam.subjectEmoji || "🎓",
        topic: s.title,
        title: `Exam Syllabus: ${s.title}`,
        rationale: `Required for "${exam.name}" in ${days} days. Syllabus milestone not yet marked complete.`,
        evidenceType: "upcoming_exam",
        concreteSteps: [
          `Review syllabus notes for "${s.title}".`,
          `Complete at least 3 practice questions from past papers on this syllabus section.`,
          `Check off this syllabus topic in the Exams page once confident.`,
        ],
        measurableGoal: `Complete syllabus section review for "${exam.name}".`,
        suggestedDurationMinutes: 40,
        priority,
        priorityScore,
        dueDate: effectiveDueDate,
        rescheduledDate: saved?.rescheduledDate,
        status: saved?.status || "pending",
        notes: saved?.notes,
      });

      coveredTopicKeys.add(topicKey);
      if (saved?.status !== "completed") {
        paceOffset = (paceOffset + 1) % 4;
      }
    }
  }

  // -------------------------------------------------------------
  // SOURCE 5: Fallback General Suggestions (When Evidence is Sparse)
  // -------------------------------------------------------------
  if (generatedTasks.length === 0 && subjects.length > 0) {
    subjects.slice(0, 3).forEach((sub, idx) => {
      const taskId = `rev-gen-${sub.id}`;
      const saved = savedMap.get(taskId);

      generatedTasks.push({
        id: taskId,
        sourceType: "general_suggestion",
        sourceId: sub.id,
        subjectId: sub.id,
        subjectName: sub.name,
        subjectEmoji: sub.emoji,
        topic: "Diagnostic Baseline",
        title: `Analyze Paper or Diagnostic Quiz: ${sub.name}`,
        rationale: `General Recommendation (No past paper analysis or quiz evidence found yet). Upload a paper or take a quiz to reveal your exact knowledge gaps.`,
        evidenceType: "general",
        concreteSteps: [
          `Open Paper Analysis to upload a past paper or question sheet.`,
          `Or log a quiz score manually in Study to establish your baseline accuracy.`,
        ],
        measurableGoal: `Complete 1 paper analysis or 1 quiz in ${sub.name}.`,
        suggestedDurationMinutes: 25,
        priority: "medium",
        priorityScore: 30 - idx * 5,
        dueDate: addDaysToDateString(todayDate, idx),
        rescheduledDate: saved?.rescheduledDate,
        status: saved?.status || "pending",
        notes: saved?.notes,
      });
    });
  }

  // Sort: pending/in_progress first, then by priority score descending, then by due date ascending
  return generatedTasks.sort((a, b) => {
    const isADone = a.status === "completed" || a.status === "skipped";
    const isBDone = b.status === "completed" || b.status === "skipped";
    if (isADone !== isBDone) return isADone ? 1 : -1;
    if (b.priorityScore !== a.priorityScore) return b.priorityScore - a.priorityScore;
    return a.dueDate.localeCompare(b.dueDate);
  });
}

/**
 * Filter revision tasks by view tab: today, upcoming, overdue, completed, by_subject
 */
export function filterRevisionTasks(
  tasks: RevisionTask[],
  filter: RevisionFilterTab,
  todayDate: string = getTodayDateString()
): RevisionTask[] {
  switch (filter) {
    case "today":
      return tasks.filter((t) => {
        if (t.status === "completed") {
          // Completed today or due today
          return t.dueDate === todayDate;
        }
        if (t.status === "skipped") return false;
        return t.dueDate <= todayDate;
      });

    case "upcoming":
      return tasks.filter(
        (t) => t.dueDate > todayDate && t.status !== "completed" && t.status !== "skipped"
      );

    case "overdue":
      return tasks.filter(
        (t) => t.dueDate < todayDate && (t.status === "pending" || t.status === "in_progress")
      );

    case "completed":
      return tasks.filter((t) => t.status === "completed");

    case "by_subject":
    default:
      return tasks;
  }
}

/**
 * Computes completion metrics and upcoming exam countdowns per subject
 */
export function computeSubjectRevisionProgress(
  tasks: RevisionTask[],
  subjects: Subject[] = [],
  exams: Exam[] = [],
  todayDate: string = getTodayDateString()
): SubjectRevisionProgress[] {
  const map = new Map<string, { total: number; completed: number; pending: number; urgent: number }>();

  // Initialize with all known subjects
  for (const s of subjects) {
    map.set(s.id, { total: 0, completed: 0, pending: 0, urgent: 0 });
  }

  for (const t of tasks) {
    const key = t.subjectId || "general";
    const entry = map.get(key) || { total: 0, completed: 0, pending: 0, urgent: 0 };
    entry.total++;
    if (t.status === "completed") {
      entry.completed++;
    } else if (t.status !== "skipped") {
      entry.pending++;
      if (t.priority === "urgent") entry.urgent++;
    }
    map.set(key, entry);
  }

  const results: SubjectRevisionProgress[] = [];

  for (const [subjectId, stats] of map.entries()) {
    const subject = subjects.find((s) => s.id === subjectId);
    const name = subject?.name || (subjectId === "general" ? "General Revision" : "Core");
    const emoji = subject?.emoji || "📚";

    // Find nearest exam for this subject
    let nearestExamDate: string | undefined;
    let minDays: number | undefined;

    for (const e of exams) {
      if (e.subjectId === subjectId && e.date) {
        const days = daysUntil(e.date, new Date(todayDate));
        if (days >= 0 && (minDays === undefined || days < minDays)) {
          minDays = days;
          nearestExamDate = e.date;
        }
      }
    }

    const rate = stats.total > 0 ? Math.round((stats.completed / stats.total) * 100) : 0;

    results.push({
      subjectId,
      subjectName: name,
      subjectEmoji: emoji,
      totalTasks: stats.total,
      completedTasks: stats.completed,
      pendingTasks: stats.pending,
      urgentTasks: stats.urgent,
      completionRate: rate,
      upcomingExamDate: nearestExamDate,
      daysUntilExam: minDays,
    });
  }

  // Sort by urgent tasks first, then by nearest exam, then by completion rate
  return results.sort((a, b) => {
    if (b.urgentTasks !== a.urgentTasks) return b.urgentTasks - a.urgentTasks;
    if (a.daysUntilExam !== undefined && b.daysUntilExam !== undefined) {
      return a.daysUntilExam - b.daysUntilExam;
    }
    if (a.daysUntilExam !== undefined) return -1;
    if (b.daysUntilExam !== undefined) return 1;
    return a.completionRate - b.completionRate;
  });
}
