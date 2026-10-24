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
  generatePersonalizedRevisionTasks,
  filterRevisionTasks,
  computeSubjectRevisionProgress,
  addDaysToDateString,
} from "./revisionPlanner.ts";
import type { Paper } from "../types/paper.ts";
import type { Exam } from "../types/exam.ts";
import type { Subject } from "../types/index.ts";
import type { RevisionTaskRecord } from "../services/revisionPlanner.ts";

console.log("Running Personalized Revision Planner Tests...");

const TODAY = "2026-10-24";

// 1. Missing data / sparse evidence scenario
{
  const subjects: Subject[] = [
    { id: "sub-1", name: "Physics", emoji: "⚡", color: "#f59e0b" },
    { id: "sub-2", name: "Calculus", emoji: "📐", color: "#3b82f6" },
  ];

  const tasks = generatePersonalizedRevisionTasks({
    papers: [],
    exams: [],
    subjects,
    todayDate: TODAY,
  });

  assert.equal(tasks.length, 2, "Generates baseline diagnostic tasks when no papers or assessments exist");
  assert.equal(tasks[0].evidenceType, "general", "Clearly tags fallback tasks as general evidence");
  assert.ok(tasks[0].rationale.includes("General Recommendation"), "Rationale explicitly discloses lack of evidence");
  assert.ok(tasks[0].concreteSteps.length >= 2, "Includes actionable concrete steps");
  assert.ok(tasks[0].measurableGoal.length > 0, "Includes measurable completion criterion");

  console.log("✔ Sparse data safely falls back to transparent general recommendations");
}

// 2. Paper Action Plan & Question-level mistake citation
{
  const mockPaper: Paper = {
    id: "paper-1",
    title: "Midterm Physics 2026",
    paperType: "exam",
    subjectId: "sub-phys",
    subjectName: "Physics",
    subjectEmoji: "⚡",
    date: "2026-10-15",
    status: "analyzed",
    sourceType: "pdf",
    aiProcessingConsentGiven: true,
    summary: {
      totalQuestions: 2,
      maxMarks: 20,
      totalTeacherMarks: 12,
      percentage: 60,
      scoreType: "teacher",
    },
    questions: [
      {
        id: "q1",
        questionNumber: "1b",
        questionText: "Calculate Doppler shift frequency",
        maxMarks: 10,
        teacherAwardedMarks: 4,
        topic: "Doppler Effect",
        mistakeTag: "calculation",
        mistakePoints: ["Substituted velocity instead of speed of sound"],
      },
      {
        id: "q2",
        questionNumber: "2a",
        questionText: "Define wave superposition",
        maxMarks: 10,
        teacherAwardedMarks: 8,
        topic: "Wave Optics",
      },
    ],
    actionPlan: [
      {
        id: "act-1",
        priority: "high",
        topic: "Doppler Effect",
        recommendation: "Practice Doppler frequency shift formula with proper speed of sound values",
        actionType: "revision",
        completed: false,
      },
    ],
  };

  const tasks = generatePersonalizedRevisionTasks({
    papers: [mockPaper],
    todayDate: TODAY,
  });

  assert.equal(tasks.length, 1, "Extracts revision task from paper action plan");
  const task = tasks[0];
  assert.equal(task.sourceType, "paper_action");
  assert.equal(task.topic, "Doppler Effect");
  assert.equal(task.mistakeTag, "calculation", "Captures question-level mistake tag");
  assert.ok(task.sourceQuestionNumbers?.includes("1b"), "Cites exact question number 1b");
  assert.ok(task.rationale.includes("Midterm Physics 2026"), "Cites source paper title in rationale");
  assert.ok(task.rationale.includes("Calculation Error"), "Includes mistake pattern in rationale");
  assert.ok(task.concreteSteps.some((s) => s.includes("Q1b")), "Directs student to review specific question");
  assert.ok(task.measurableGoal.includes("Doppler Effect"), "Has measurable completion criterion");

  console.log("✔ Paper action items include question numbers, mistake tags, and concrete steps");
}

// 3. Upcoming Exam Urgency Escalation
{
  const mockPaper: Paper = {
    id: "paper-2",
    title: "Calculus Quiz 3",
    paperType: "practice",
    subjectId: "sub-math",
    subjectName: "Mathematics",
    date: "2026-10-20",
    status: "analyzed",
    sourceType: "text",
    aiProcessingConsentGiven: true,
    summary: { totalQuestions: 1, maxMarks: 10, percentage: 50 },
    questions: [],
    actionPlan: [
      {
        id: "act-calc",
        priority: "medium", // Originally medium
        topic: "Integration by Parts",
        recommendation: "Review LIATE rule for choosing u and dv",
        actionType: "practice_quiz",
        completed: false,
      },
    ],
  };

  // Exam in 2 days (2026-10-26)
  const mockExam: Exam = {
    id: "exam-math",
    name: "Final Calculus Exam",
    date: "2026-10-26",
    subjectId: "sub-math",
    subjectName: "Mathematics",
    subjectEmoji: "📐",
    syllabus: [{ id: "s1", title: "Integration by Parts", done: false }],
  };

  const tasks = generatePersonalizedRevisionTasks({
    papers: [mockPaper],
    exams: [mockExam],
    todayDate: TODAY, // 2026-10-24
  });

  assert.equal(tasks.length, 1);
  const task = tasks[0];
  assert.equal(task.priority, "urgent", "Escalates priority to urgent for exam within 2 days");
  assert.ok(task.rationale.includes("Final Calculus Exam"), "Mentions upcoming exam in rationale");
  assert.ok(task.dueDate <= "2026-10-26", "Due date is scheduled on or before exam date");

  console.log("✔ Imminent upcoming exams escalate task priority to urgent");
}

// 4. Missing Exam Date Handling (No invented dates)
{
  const mockExamWithoutDate: Exam = {
    id: "exam-unscheduled",
    name: "Unscheduled Chemistry Test",
    date: "", // No date set
    subjectId: "sub-chem",
    subjectName: "Chemistry",
    subjectEmoji: "🧪",
    syllabus: [{ id: "s1", title: "Thermodynamics", done: false }],
  };

  const tasks = generatePersonalizedRevisionTasks({
    papers: [],
    exams: [mockExamWithoutDate],
    subjects: [{ id: "sub-chem", name: "Chemistry", emoji: "🧪", color: "#10b981" }],
    todayDate: TODAY,
  });

  // Does not invent a date or crash
  assert.ok(tasks.length > 0);
  assert.ok(!tasks.some((t) => t.dueDate === "NaN-NaN-NaN"));

  console.log("✔ Missing exam dates handled cleanly without inventing dates");
}

// 5. Deduplication across papers and topics
{
  const paperA: Paper = {
    id: "p-a",
    title: "Paper A",
    paperType: "practice",
    subjectId: "sub-1",
    date: TODAY,
    status: "analyzed",
    sourceType: "text",
    aiProcessingConsentGiven: true,
    summary: { totalQuestions: 1, maxMarks: 5 },
    questions: [],
    actionPlan: [
      {
        id: "act-dup",
        priority: "medium",
        topic: "Linear Algebra",
        recommendation: "Matrix multiplication rules",
        actionType: "revision",
        completed: false,
      },
    ],
  };

  const paperB: Paper = {
    id: "p-b",
    title: "Paper B",
    paperType: "practice",
    subjectId: "sub-1",
    date: TODAY,
    status: "analyzed",
    sourceType: "text",
    aiProcessingConsentGiven: true,
    summary: { totalQuestions: 1, maxMarks: 5 },
    questions: [],
    actionPlan: [
      {
        id: "act-dup-2",
        priority: "high",
        topic: "Linear Algebra", // duplicate topic
        recommendation: "Eigenvalues and eigenvectors",
        actionType: "revision",
        completed: false,
      },
    ],
  };

  const tasks = generatePersonalizedRevisionTasks({
    papers: [paperA, paperB],
    todayDate: TODAY,
  });

  const algebraTasks = tasks.filter((t) => t.topic.toLowerCase() === "linear algebra");
  assert.equal(algebraTasks.length, 1, "Deduplicates tasks for identical subject and topic");

  console.log("✔ Topic deduplication avoids redundant revision tasks");
}

// 6. Persistence Overrides & State Transitions
{
  const mockPaper: Paper = {
    id: "p-persist",
    title: "Test Paper",
    paperType: "practice",
    subjectId: "sub-1",
    date: TODAY,
    status: "analyzed",
    sourceType: "text",
    aiProcessingConsentGiven: true,
    summary: { totalQuestions: 1, maxMarks: 5 },
    questions: [],
    actionPlan: [
      {
        id: "act-p1",
        priority: "medium",
        topic: "Organic Synthesis",
        recommendation: "Review Markovnikov rule",
        actionType: "revision",
        completed: false,
      },
    ],
  };

  const savedRecord: RevisionTaskRecord = {
    id: "rev-paper-p-persist-act-p1",
    status: "in_progress",
    rescheduledDate: "2026-10-30",
    notes: "Started flashcards on synthesis",
  };

  const tasks = generatePersonalizedRevisionTasks({
    papers: [mockPaper],
    savedRecords: [savedRecord],
    todayDate: TODAY,
  });

  assert.equal(tasks.length, 1);
  assert.equal(tasks[0].status, "in_progress", "Applies in_progress state override");
  assert.equal(tasks[0].dueDate, "2026-10-30", "Applies rescheduledDate override");
  assert.equal(tasks[0].notes, "Started flashcards on synthesis", "Retains user notes");

  console.log("✔ Task status transitions and rescheduling persist correctly");
}

// 7. Filtering: today, upcoming, overdue, completed
{
  const sampleTasks = [
    {
      id: "t1",
      title: "Task 1",
      dueDate: "2026-10-24", // today
      status: "pending" as const,
      priority: "high" as const,
      priorityScore: 80,
      topic: "Topic 1",
      subjectId: "s1",
      subjectName: "Sub",
      subjectEmoji: "📚",
      rationale: "r",
      evidenceType: "academic_mistake" as const,
      concreteSteps: [],
      measurableGoal: "m",
      suggestedDurationMinutes: 30,
      sourceType: "paper_action" as const,
    },
    {
      id: "t2",
      title: "Task 2",
      dueDate: "2026-10-26", // future
      status: "pending" as const,
      priority: "medium" as const,
      priorityScore: 50,
      topic: "Topic 2",
      subjectId: "s1",
      subjectName: "Sub",
      subjectEmoji: "📚",
      rationale: "r",
      evidenceType: "academic_mistake" as const,
      concreteSteps: [],
      measurableGoal: "m",
      suggestedDurationMinutes: 30,
      sourceType: "paper_action" as const,
    },
    {
      id: "t3",
      title: "Task 3",
      dueDate: "2026-10-20", // overdue
      status: "in_progress" as const,
      priority: "urgent" as const,
      priorityScore: 90,
      topic: "Topic 3",
      subjectId: "s1",
      subjectName: "Sub",
      subjectEmoji: "📚",
      rationale: "r",
      evidenceType: "academic_mistake" as const,
      concreteSteps: [],
      measurableGoal: "m",
      suggestedDurationMinutes: 30,
      sourceType: "paper_action" as const,
    },
    {
      id: "t4",
      title: "Task 4",
      dueDate: "2026-10-22",
      status: "completed" as const,
      priority: "low" as const,
      priorityScore: 20,
      topic: "Topic 4",
      subjectId: "s1",
      subjectName: "Sub",
      subjectEmoji: "📚",
      rationale: "r",
      evidenceType: "academic_mistake" as const,
      concreteSteps: [],
      measurableGoal: "m",
      suggestedDurationMinutes: 30,
      sourceType: "paper_action" as const,
    },
  ];

  const todayList = filterRevisionTasks(sampleTasks, "today", TODAY);
  assert.ok(todayList.some((t) => t.id === "t1"), "Today includes tasks due today");

  const upcomingList = filterRevisionTasks(sampleTasks, "upcoming", TODAY);
  assert.equal(upcomingList.length, 1);
  assert.equal(upcomingList[0].id, "t2", "Upcoming includes future tasks");

  const overdueList = filterRevisionTasks(sampleTasks, "overdue", TODAY);
  assert.equal(overdueList.length, 1);
  assert.equal(overdueList[0].id, "t3", "Overdue captures uncompleted past tasks");

  const completedList = filterRevisionTasks(sampleTasks, "completed", TODAY);
  assert.equal(completedList.length, 1);
  assert.equal(completedList[0].id, "t4", "Completed captures finished tasks");

  console.log("✔ Filter tabs (today, upcoming, overdue, completed) slice tasks accurately");
}

// 8. Subject Progress Metrics
{
  const subjects: Subject[] = [{ id: "sub-bio", name: "Biology", emoji: "🧬", color: "#10b981" }];
  const exams: Exam[] = [
    {
      id: "exam-bio",
      name: "Biology Board",
      date: addDaysToDateString(TODAY, 5), // in 5 days
      subjectId: "sub-bio",
      subjectName: "Biology",
      subjectEmoji: "🧬",
      syllabus: [],
    },
  ];
  const sampleTasks = [
    {
      id: "t-bio-1",
      title: "Genetics review",
      dueDate: TODAY,
      status: "completed" as const,
      priority: "high" as const,
      priorityScore: 70,
      topic: "Genetics",
      subjectId: "sub-bio",
      subjectName: "Biology",
      subjectEmoji: "🧬",
      rationale: "r",
      evidenceType: "academic_mistake" as const,
      concreteSteps: [],
      measurableGoal: "m",
      suggestedDurationMinutes: 30,
      sourceType: "paper_action" as const,
    },
    {
      id: "t-bio-2",
      title: "Cell division",
      dueDate: TODAY,
      status: "pending" as const,
      priority: "urgent" as const,
      priorityScore: 90,
      topic: "Cell Division",
      subjectId: "sub-bio",
      subjectName: "Biology",
      subjectEmoji: "🧬",
      rationale: "r",
      evidenceType: "academic_mistake" as const,
      concreteSteps: [],
      measurableGoal: "m",
      suggestedDurationMinutes: 30,
      sourceType: "paper_action" as const,
    },
  ];

  const progress = computeSubjectRevisionProgress(sampleTasks, subjects, exams, TODAY);
  assert.equal(progress.length, 1);
  assert.equal(progress[0].subjectId, "sub-bio");
  assert.equal(progress[0].totalTasks, 2);
  assert.equal(progress[0].completedTasks, 1);
  assert.equal(progress[0].completionRate, 50);
  assert.equal(progress[0].urgentTasks, 1);
  assert.equal(progress[0].daysUntilExam, 5);

  console.log("✔ Subject progress tracks completion rate, urgent tasks, and exam countdown");
}

console.log("All Personalized Revision Planner Tests Passed! ⚡🎯");
