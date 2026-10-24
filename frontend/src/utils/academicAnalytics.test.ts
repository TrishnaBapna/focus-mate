const assert = {
  strictEqual<T>(actual: T, expected: T, message?: string) {
    if (actual !== expected) {
      throw new Error(`${message ?? "Assertion failed"}: expected ${String(expected)}, got ${String(actual)}`);
    }
  },
  equal<T>(actual: T, expected: T, message?: string) {
    if (actual != expected) {
      throw new Error(`${message ?? "Assertion failed"}: expected ${String(expected)}, got ${String(actual)}`);
    }
  },
  ok(condition: unknown, message?: string) {
    if (!condition) {
      throw new Error(message ?? "Assertion failed: truthy expected");
    }
  },
};

import {
  computeAcademicKpis,
  computeMistakeDistribution,
  computePaperScoreTimeline,
  computeSubjectAcademicBreakdown,
  computeTopicMasteryFromPapers,
} from "./academicAnalytics.ts";
import type { Paper } from "../types/paper.ts";

console.log("Running Unified Academic Analytics Tests...");

// 1. Empty state
{
  const kpis = computeAcademicKpis([]);
  assert.equal(kpis.totalPapers, 0);
  assert.equal(kpis.examAverage, null);
  assert.equal(kpis.practiceAverage, null);
  assert.equal(kpis.totalQuestionsAnalyzed, 0);
  assert.equal(kpis.actionCompletionRate, 0);

  const mistakes = computeMistakeDistribution([]);
  assert.equal(mistakes.length, 0);

  const timeline = computePaperScoreTimeline([]);
  assert.equal(timeline.length, 0);

  console.log("✔ Empty state safely handles zero papers without NaNs or crashes");
}

// 2. Official Exam vs Practice Isolation in KPIs
{
  const mockPapers: Paper[] = [
    {
      id: "p1",
      title: "Midterm Exam",
      paperType: "exam",
      date: "2026-10-10",
      status: "analyzed",
      sourceType: "pdf",
      aiProcessingConsentGiven: true,
      summary: {
        totalQuestions: 2,
        maxMarks: 20,
        totalTeacherMarks: 16,
        percentage: 80,
        scoreType: "teacher",
        isGradingComplete: true,
      },
      questions: [],
      actionPlan: [{ id: "a1", priority: "high", topic: "Calculus", recommendation: "Review", actionType: "revision", completed: true }],
    },
    {
      id: "p2",
      title: "Practice Set 1",
      paperType: "practice",
      date: "2026-10-15",
      status: "analyzed",
      sourceType: "text",
      aiProcessingConsentGiven: true,
      summary: {
        totalQuestions: 2,
        maxMarks: 20,
        totalStudentMarks: 18,
        percentage: 90,
        scoreType: "student",
        isGradingComplete: true,
      },
      questions: [],
      actionPlan: [{ id: "a2", priority: "medium", topic: "Algebra", recommendation: "Cards", actionType: "flashcards", completed: false }],
    },
    {
      id: "p3",
      title: "Ungraded Exam",
      paperType: "exam",
      date: "2026-10-20",
      status: "ready_for_review",
      sourceType: "pdf",
      aiProcessingConsentGiven: false,
      summary: {
        totalQuestions: 5,
        maxMarks: 50,
        totalTeacherMarks: null,
        percentage: null,
        scoreType: "none",
        isGradingComplete: false,
      },
      questions: [],
      actionPlan: [],
    },
  ];

  const kpis = computeAcademicKpis(mockPapers);
  assert.equal(kpis.totalPapers, 3);
  assert.equal(kpis.examAverage, 80, "Exam average must be strictly based on graded exams");
  assert.equal(kpis.gradedExamsCount, 1);
  assert.equal(kpis.totalExamsCount, 2);
  assert.equal(kpis.practiceAverage, 90, "Practice average must be strictly based on practice papers");
  assert.equal(kpis.scoredPracticeCount, 1);
  assert.equal(kpis.totalPracticeCount, 1);
  assert.equal(kpis.totalActionItems, 2);
  assert.equal(kpis.completedActionItems, 1);
  assert.equal(kpis.actionCompletionRate, 50);

  console.log("✔ Official exams and practice scores are strictly isolated without blended averages");
}

// 3. Mistake Tag Distribution Aggregation
{
  const papersWithMistakes: Paper[] = [
    {
      id: "p1",
      title: "Physics Paper",
      paperType: "practice",
      date: "2026-10-10",
      status: "analyzed",
      sourceType: "text",
      aiProcessingConsentGiven: true,
      summary: { totalQuestions: 3, maxMarks: 30 },
      questions: [
        { id: "q1", questionNumber: "1", questionText: "Q1", maxMarks: 10, mistakeTag: "calculation" },
        { id: "q2", questionNumber: "2", questionText: "Q2", maxMarks: 10, mistakeTag: "calculation" },
        { id: "q3", questionNumber: "3", questionText: "Q3", maxMarks: 10, mistakeTag: "conceptual" },
      ],
      actionPlan: [],
    },
    {
      id: "p2",
      title: "Math Paper",
      paperType: "exam",
      date: "2026-10-12",
      status: "analyzed",
      sourceType: "text",
      aiProcessingConsentGiven: true,
      summary: { totalQuestions: 1, maxMarks: 10 },
      questions: [
        { id: "q4", questionNumber: "1", questionText: "Q1", maxMarks: 10, mistakeTag: "misread_question" },
      ],
      actionPlan: [],
    },
  ];

  const distribution = computeMistakeDistribution(papersWithMistakes);
  assert.equal(distribution.length, 3);
  assert.equal(distribution[0].tag, "calculation");
  assert.equal(distribution[0].count, 2);
  assert.equal(distribution[0].percentage, 50, "2 out of 4 total tagged = 50%");
  assert.equal(distribution[1].tag, "conceptual");
  assert.equal(distribution[1].count, 1);
  assert.equal(distribution[1].percentage, 25);
  assert.equal(distribution[2].tag, "misread_question");
  assert.equal(distribution[2].count, 1);
  assert.equal(distribution[2].percentage, 25);

  console.log("✔ Mistake categories aggregate accurately and rank by frequency");
}

// 4. Chronological Score Timeline
{
  const timelinePapers: Paper[] = [
    {
      id: "p2",
      title: "Late Paper",
      paperType: "practice",
      date: "2026-10-22",
      status: "analyzed",
      sourceType: "text",
      aiProcessingConsentGiven: true,
      summary: { totalQuestions: 1, maxMarks: 10, percentage: 85 },
      questions: [],
      actionPlan: [],
    },
    {
      id: "p1",
      title: "Early Exam",
      paperType: "exam",
      date: "2026-10-01",
      status: "analyzed",
      sourceType: "text",
      aiProcessingConsentGiven: true,
      summary: { totalQuestions: 1, maxMarks: 10, totalTeacherMarks: 7, percentage: 70, scoreType: "teacher" },
      questions: [],
      actionPlan: [],
    },
    {
      id: "p3",
      title: "Unscored Draft",
      paperType: "exam",
      date: "2026-10-15",
      status: "ready_for_review",
      sourceType: "text",
      aiProcessingConsentGiven: false,
      summary: { totalQuestions: 1, maxMarks: 10, percentage: null },
      questions: [],
      actionPlan: [],
    },
  ];

  const points = computePaperScoreTimeline(timelinePapers);
  assert.equal(points.length, 2, "Unscored paper must be omitted from score timeline");
  assert.equal(points[0].id, "p1", "Earliest paper must be first");
  assert.equal(points[0].isOfficial, true);
  assert.equal(points[1].id, "p2", "Later paper must be second");
  assert.equal(points[1].isOfficial, false);

  console.log("✔ Timeline orders chronologically and separates official exam scores");
}

// 5. Subject Breakdown
{
  const subjectPapers: Paper[] = [
    {
      id: "p1",
      title: "Phys Exam",
      paperType: "exam",
      subjectId: "sub_phys",
      subjectName: "Physics",
      subjectEmoji: "⚡",
      date: "2026-10-01",
      status: "analyzed",
      sourceType: "pdf",
      aiProcessingConsentGiven: true,
      summary: { totalQuestions: 1, maxMarks: 10, totalTeacherMarks: 8, percentage: 80, scoreType: "teacher" },
      questions: [{ id: "q1", questionNumber: "1", questionText: "Q", maxMarks: 10, mistakeTag: "calculation" }],
      actionPlan: [],
    },
    {
      id: "p2",
      title: "Phys Practice",
      paperType: "practice",
      subjectId: "sub_phys",
      subjectName: "Physics",
      subjectEmoji: "⚡",
      date: "2026-10-05",
      status: "analyzed",
      sourceType: "text",
      aiProcessingConsentGiven: true,
      summary: { totalQuestions: 1, maxMarks: 10, totalStudentMarks: 9, percentage: 90 },
      questions: [],
      actionPlan: [],
    },
  ];

  const breakdown = computeSubjectAcademicBreakdown(subjectPapers, [{ id: "sub_phys", name: "Physics", emoji: "⚡" }]);
  assert.equal(breakdown.length, 1);
  assert.equal(breakdown[0].name, "Physics");
  assert.equal(breakdown[0].examAverage, 80);
  assert.equal(breakdown[0].practiceAverage, 90);
  assert.equal(breakdown[0].topMistakeTag, "calculation");

  console.log("✔ Subject breakdown correctly computes per-subject exam and practice scores");
}

// 6. Topic Mastery from Question Analyses
{
  const papers: Paper[] = [
    {
      id: "p1",
      title: "Paper 1",
      paperType: "exam",
      date: "2026-10-01",
      status: "analyzed",
      sourceType: "pdf",
      aiProcessingConsentGiven: true,
      summary: { totalQuestions: 2, maxMarks: 20 },
      questions: [
        { id: "q1", questionNumber: "1", questionText: "Q1", maxMarks: 10, teacherAwardedMarks: 4, topic: "Thermodynamics", mistakeTag: "conceptual" },
        { id: "q2", questionNumber: "2", questionText: "Q2", maxMarks: 10, teacherAwardedMarks: 9, topic: "Optics" },
      ],
      actionPlan: [],
    },
  ];

  const topicStats = computeTopicMasteryFromPapers(papers);
  assert.equal(topicStats.length, 2);
  const thermo = topicStats.find((t) => t.topic === "Thermodynamics")!;
  assert.equal(thermo.accuracy, 40);
  assert.equal(thermo.needsAttention, true, "Topic with 40% accuracy needs attention");
  assert.equal(thermo.topMistakeTag, "conceptual");

  const optics = topicStats.find((t) => t.topic === "Optics")!;
  assert.equal(optics.accuracy, 90);
  assert.equal(optics.needsAttention, false, "Topic with 90% accuracy is on track");

  console.log("✔ Topic mastery highlights weak topics with accuracy below 65%");
}

console.log("All Unified Academic Analytics Tests Passed! 📊🎓");
