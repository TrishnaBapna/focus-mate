import {
  calculateAccuracy,
  classifyTopicPerformance,
  buildRevisionRecommendations,
  deDuplicateAssessments,
  normalizeTopicKey,
  getStatusLabel,
} from "./topicPerformance.ts";
import type { AssessmentResult } from "../types/assessment.ts";
import type { Exam } from "../types/exam.ts";
import type { Timestamp } from "firebase/firestore";

const assert = {
  strictEqual<T>(actual: T, expected: T, message?: string) {
    if (actual !== expected) {
      throw new Error(`${message ?? "Assertion failed"}: expected ${expected}, got ${actual}`);
    }
  },
  ok(value: unknown, message?: string) {
    if (!value) {
      throw new Error(message ?? "Expected truthy value");
    }
  },
};

const mockTimestamp = (millis: number): Timestamp =>
  ({
    toMillis: () => millis,
    toDate: () => new Date(millis),
  }) as unknown as Timestamp;

console.log("Running Weak Topic Detection & Smart Revision logic tests...");

// 1. calculateAccuracy boundary checks
{
  assert.strictEqual(calculateAccuracy(4, 5), 0.8, "4/5 must be 0.8");
  assert.strictEqual(calculateAccuracy(1, 3), 0.333, "1/3 rounded to 3 decimals");
  assert.strictEqual(calculateAccuracy(0, 5), 0, "0/5 must be 0");
  assert.strictEqual(calculateAccuracy(5, 0), 0, "division by 0 must return 0");
  assert.strictEqual(calculateAccuracy(-1, 5), 0, "negative score clamped to 0");
  assert.strictEqual(calculateAccuracy(10, 5), 1.0, "score exceeding total clamped to 1.0");
  assert.strictEqual(calculateAccuracy(NaN, 5), 0, "NaN score must return 0");
  assert.strictEqual(calculateAccuracy(4, NaN), 0, "NaN total must return 0");
  console.log("✔ calculateAccuracy handles zeroes, bounds, and NaNs safely");
}

// 2. normalizeTopicKey
{
  assert.strictEqual(normalizeTopicKey("sub_1", "  Thermodynamics "), "sub_1::thermodynamics");
  assert.strictEqual(normalizeTopicKey("", "Cell Biology"), "general::cell biology");
  console.log("✔ normalizeTopicKey produces consistent lowercased keys");
}

// 3. deDuplicateAssessments and malformed record filtering
{
  const rawList: AssessmentResult[] = [
    {
      id: "a1",
      subjectId: "sub_1",
      subjectName: "Physics",
      topic: "Friction",
      score: 3,
      totalQuestions: 5,
      accuracy: 0.6,
      source: "quiz",
    },
    // Exact duplicate ID
    {
      id: "a1",
      subjectId: "sub_1",
      subjectName: "Physics",
      topic: "Friction",
      score: 3,
      totalQuestions: 5,
      accuracy: 0.6,
      source: "quiz",
    },
    // Missing topic
    {
      id: "a2",
      subjectId: "sub_1",
      subjectName: "Physics",
      topic: "",
      score: 5,
      totalQuestions: 5,
      accuracy: 1.0,
      source: "quiz",
    },
    // Invalid zero total questions
    {
      id: "a3",
      subjectId: "sub_1",
      subjectName: "Physics",
      topic: "Optics",
      score: 0,
      totalQuestions: 0,
      accuracy: 0,
      source: "quiz",
    },
    // Valid distinct item
    {
      id: "a4",
      subjectId: "sub_1",
      subjectName: "Physics",
      topic: "Friction",
      score: 4,
      totalQuestions: 5,
      accuracy: 0.8,
      source: "quiz",
    },
  ];

  const cleaned = deDuplicateAssessments(rawList);
  assert.strictEqual(cleaned.length, 2, "Must only retain unique, valid assessments");
  assert.strictEqual(cleaned[0].id, "a1");
  assert.strictEqual(cleaned[1].id, "a4");
  console.log("✔ deDuplicateAssessments filters malformed data and eliminates duplicate IDs");
}

// 4. Insufficient data threshold
{
  // A) 1 attempt with 5 questions (< 2 attempts)
  const singleAttempt: AssessmentResult[] = [
    {
      id: "q1",
      subjectId: "sub_1",
      subjectName: "Math",
      topic: "Calculus",
      score: 1,
      totalQuestions: 5,
      accuracy: 0.2,
      source: "quiz",
      createdAt: mockTimestamp(1000),
    },
  ];

  const res1 = classifyTopicPerformance(singleAttempt);
  assert.strictEqual(res1.length, 1);
  assert.strictEqual(res1[0].status, "not_enough_data");
  assert.strictEqual(res1[0].totalAttempts, 1);
  assert.ok(res1[0].statusReason.includes("Needs at least"));

  // B) 2 attempts but only 4 questions (< 5 questions)
  const twoShortAttempts: AssessmentResult[] = [
    {
      id: "q2",
      subjectId: "sub_1",
      subjectName: "Math",
      topic: "Calculus",
      score: 1,
      totalQuestions: 2,
      accuracy: 0.5,
      source: "quiz",
      createdAt: mockTimestamp(1000),
    },
    {
      id: "q3",
      subjectId: "sub_1",
      subjectName: "Math",
      topic: "Calculus",
      score: 0,
      totalQuestions: 2,
      accuracy: 0,
      source: "quiz",
      createdAt: mockTimestamp(2000),
    },
  ];

  const res2 = classifyTopicPerformance(twoShortAttempts);
  assert.strictEqual(res2[0].status, "not_enough_data", "Fewer than 5 questions must be not_enough_data");
  console.log("✔ Evidence threshold strictly enforced (requires attempts >= 2 and questions >= 5)");
}

// 5. Classification boundary rules: Needs Revision vs Improving vs On Track
{
  // A) Needs Revision: 2 attempts, 10 questions, 4 correct (40% overall, 40% recent)
  const weakTopic: AssessmentResult[] = [
    {
      id: "w1",
      subjectId: "sub_chem",
      subjectName: "Chemistry",
      topic: "Stoichiometry",
      score: 2,
      totalQuestions: 5,
      accuracy: 0.4,
      source: "quiz",
      createdAt: mockTimestamp(1000),
    },
    {
      id: "w2",
      subjectId: "sub_chem",
      subjectName: "Chemistry",
      topic: "Stoichiometry",
      score: 2,
      totalQuestions: 5,
      accuracy: 0.4,
      source: "quiz",
      createdAt: mockTimestamp(2000),
    },
  ];
  const weakRes = classifyTopicPerformance(weakTopic);
  assert.strictEqual(weakRes[0].status, "needs_revision");
  assert.strictEqual(weakRes[0].overallAccuracy, 0.4);
  assert.strictEqual(getStatusLabel(weakRes[0].status), "Needs Revision");

  // B) Improving: First attempt low (2/5 = 40%), second attempt high (5/5 = 100%)
  // Overall = 7/10 = 70% (< 75%), Recent = 100% (>= 75%) -> "improving"
  const improvingTopic: AssessmentResult[] = [
    {
      id: "i1",
      subjectId: "sub_bio",
      subjectName: "Biology",
      topic: "Genetics",
      score: 2,
      totalQuestions: 5,
      accuracy: 0.4,
      source: "quiz",
      createdAt: mockTimestamp(1000),
    },
    {
      id: "i2",
      subjectId: "sub_bio",
      subjectName: "Biology",
      topic: "Genetics",
      score: 5,
      totalQuestions: 5,
      accuracy: 1.0,
      source: "quiz",
      createdAt: mockTimestamp(2000),
    },
  ];
  const impRes = classifyTopicPerformance(improvingTopic);
  assert.strictEqual(impRes[0].status, "improving");
  assert.strictEqual(impRes[0].trend, "improving");
  assert.strictEqual(impRes[0].recentAccuracy, 1.0);
  assert.strictEqual(impRes[0].overallAccuracy, 0.7);

  // C) On Track: Both attempts high (4/5 and 5/5 -> 9/10 = 90%)
  const strongTopic: AssessmentResult[] = [
    {
      id: "s1",
      subjectId: "sub_phy",
      subjectName: "Physics",
      topic: "Newton's Laws",
      score: 4,
      totalQuestions: 5,
      accuracy: 0.8,
      source: "quiz",
      createdAt: mockTimestamp(1000),
    },
    {
      id: "s2",
      subjectId: "sub_phy",
      subjectName: "Physics",
      topic: "Newton's Laws",
      score: 5,
      totalQuestions: 5,
      accuracy: 1.0,
      source: "quiz",
      createdAt: mockTimestamp(2000),
    },
  ];
  const strongRes = classifyTopicPerformance(strongTopic);
  assert.strictEqual(strongRes[0].status, "on_track");
  assert.strictEqual(strongRes[0].overallAccuracy, 0.9);
  console.log("✔ Classification boundaries (needs_revision, improving, on_track) correctly assigned");
}

// 6. Marking as reviewed without altering historical scores
{
  const topicAssessments: AssessmentResult[] = [
    {
      id: "r1",
      subjectId: "sub_1",
      subjectName: "History",
      topic: "Renaissance",
      score: 2,
      totalQuestions: 5,
      accuracy: 0.4,
      source: "quiz",
      createdAt: mockTimestamp(1000),
    },
    {
      id: "r2",
      subjectId: "sub_1",
      subjectName: "History",
      topic: "Renaissance",
      score: 2,
      totalQuestions: 5,
      accuracy: 0.4,
      source: "quiz",
      createdAt: mockTimestamp(2000),
    },
  ];

  const now = new Date("2026-10-16T12:00:00Z");
  const topicKey = normalizeTopicKey("sub_1", "Renaissance");

  // Reviewed 1 hour ago
  const reviewedMap = new Map<string, string>();
  reviewedMap.set(topicKey, new Date("2026-10-16T11:00:00Z").toISOString());

  const classified = classifyTopicPerformance(topicAssessments, { reviewedMap, now });
  assert.strictEqual(classified[0].isReviewedRecently, true);
  // Historical accuracy must remain exactly untouched!
  assert.strictEqual(classified[0].overallAccuracy, 0.4);
  assert.strictEqual(classified[0].totalQuestions, 10);
  assert.strictEqual(classified[0].totalCorrect, 4);

  // Recommendations: reviewed topic must be demoted in priority but preserved
  const recs = buildRevisionRecommendations(classified, [], reviewedMap);
  assert.strictEqual(recs[0].isReviewed, true);
  assert.strictEqual(recs[0].urgency, "low");
  assert.ok(recs[0].reason.includes("Marked reviewed"));
  console.log("✔ Mark as reviewed preserves historical score and safely adjusts recommendation priority");
}

// 7. Revision recommendations: Upcoming exam syllabus prioritization
{
  const futureExamDate = new Date();
  futureExamDate.setDate(futureExamDate.getDate() + 4);
  const examDateStr = futureExamDate.toISOString().slice(0, 10);

  // Topic A: Needs revision (Math: Integration)
  const mathAssessments: AssessmentResult[] = [
    {
      id: "m1",
      subjectId: "math",
      subjectName: "Math",
      topic: "Integration",
      score: 2,
      totalQuestions: 5,
      accuracy: 0.4,
      source: "quiz",
    },
    {
      id: "m2",
      subjectId: "math",
      subjectName: "Math",
      topic: "Integration",
      score: 2,
      totalQuestions: 5,
      accuracy: 0.4,
      source: "quiz",
    },
  ];

  // Topic B: Needs revision (History: Cold War), but NO upcoming exam
  const histAssessments: AssessmentResult[] = [
    {
      id: "h1",
      subjectId: "hist",
      subjectName: "History",
      topic: "Cold War",
      score: 2,
      totalQuestions: 5,
      accuracy: 0.4,
      source: "quiz",
    },
    {
      id: "h2",
      subjectId: "hist",
      subjectName: "History",
      topic: "Cold War",
      score: 2,
      totalQuestions: 5,
      accuracy: 0.4,
      source: "quiz",
    },
  ];

  // Upcoming Math exam in 4 days with "Integration" on syllabus!
  const mockExams: Exam[] = [
    {
      id: "exam_math_midterm",
      name: "Calculus Midterm",
      subjectId: "math",
      subjectName: "Math",
      subjectEmoji: "📐",
      date: examDateStr, // 4 days away
      syllabus: [
        { id: "syl_1", title: "Integration", done: false },
        { id: "syl_2", title: "Derivatives", done: true },
      ],
    },
  ];

  const allTopics = classifyTopicPerformance([...mathAssessments, ...histAssessments]);
  const recs = buildRevisionRecommendations(allTopics, mockExams, new Map());

  assert.strictEqual(recs.length, 2);
  // Math: Integration MUST be first because it's both weak AND on an upcoming exam in 4 days!
  assert.strictEqual(recs[0].topic, "Integration");
  assert.strictEqual(recs[0].urgency, "urgent");
  assert.strictEqual(recs[0].examName, "Calculus Midterm");
  assert.ok(recs[0].priority > recs[1].priority, "Topic with upcoming exam must rank above topic without exam");
  console.log("✔ Smart revision recommendations correctly correlate weak topics with upcoming exams");
}

console.log("\nAll Weak Topic Detection & Smart Revision tests passed successfully! 🎉");
