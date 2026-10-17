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

// 8. Low overall performance with improving recent performance
{
  const recoveringTopic: AssessmentResult[] = [
    {
      id: "rec1",
      subjectId: "math",
      subjectName: "Math",
      topic: "Trigonometry",
      score: 1,
      totalQuestions: 5,
      accuracy: 0.2,
      source: "quiz",
      createdAt: mockTimestamp(1000),
    },
    {
      id: "rec2",
      subjectId: "math",
      subjectName: "Math",
      topic: "Trigonometry",
      score: 2,
      totalQuestions: 5,
      accuracy: 0.4,
      source: "quiz",
      createdAt: mockTimestamp(2000),
    },
    {
      id: "rec3",
      subjectId: "math",
      subjectName: "Math",
      topic: "Trigonometry",
      score: 4,
      totalQuestions: 5,
      accuracy: 0.8, // 80% on recent attempt!
      source: "quiz",
      createdAt: mockTimestamp(3000),
    },
  ];

  const res = classifyTopicPerformance(recoveringTopic);
  assert.strictEqual(res[0].status, "improving", "Low overall (46.7%) with 80% recent must be classified as improving");
  assert.strictEqual(res[0].recentAccuracy, 0.8);
  console.log("✔ Low overall performance with improving recent performance correctly classified as 'improving'");
}

// 9. Strong overall performance with declining recent performance
{
  const decliningTopic: AssessmentResult[] = [
    {
      id: "dec1",
      subjectId: "cs",
      subjectName: "Computer Science",
      topic: "Data Structures",
      score: 5,
      totalQuestions: 5,
      accuracy: 1.0,
      source: "quiz",
      createdAt: mockTimestamp(1000),
    },
    {
      id: "dec2",
      subjectId: "cs",
      subjectName: "Computer Science",
      topic: "Data Structures",
      score: 5,
      totalQuestions: 5,
      accuracy: 1.0,
      source: "quiz",
      createdAt: mockTimestamp(2000),
    },
    {
      id: "dec3",
      subjectId: "cs",
      subjectName: "Computer Science",
      topic: "Data Structures",
      score: 2,
      totalQuestions: 5,
      accuracy: 0.4, // Dropped to 40% on recent attempt!
      source: "quiz",
      createdAt: mockTimestamp(3000),
    },
  ];

  const res = classifyTopicPerformance(decliningTopic);
  // Overall is 12/15 = 80%, but recent dropped to 40% (< 65% passing threshold)
  assert.strictEqual(res[0].status, "needs_revision", "Strong overall with failing recent must be classified as needs_revision");
  assert.strictEqual(res[0].recentAccuracy, 0.4);
  assert.strictEqual(res[0].overallAccuracy, 0.8);
  console.log("✔ Strong overall performance with declining recent performance correctly classified as 'needs_revision'");
}

// 10. Boundary conditions and insufficient data tests
{
  // A) Exact boundary: 65% overall and 65% recent -> on_track
  const exactBoundaryPassing: AssessmentResult[] = [
    {
      id: "b1",
      subjectId: "sub1",
      subjectName: "Subject",
      topic: "Boundary Pass",
      score: 13,
      totalQuestions: 20, // 65%
      accuracy: 0.65,
      source: "quiz",
      createdAt: mockTimestamp(1000),
    },
    {
      id: "b2",
      subjectId: "sub1",
      subjectName: "Subject",
      topic: "Boundary Pass",
      score: 13,
      totalQuestions: 20, // 65%
      accuracy: 0.65,
      source: "quiz",
      createdAt: mockTimestamp(2000),
    },
  ];
  const passRes = classifyTopicPerformance(exactBoundaryPassing);
  assert.strictEqual(passRes[0].status, "on_track", "65% overall and 65% recent is on_track");

  // B) Just below boundary: 60% overall and 60% recent -> needs_revision
  const belowBoundary: AssessmentResult[] = [
    {
      id: "b3",
      subjectId: "sub1",
      subjectName: "Subject",
      topic: "Boundary Fail",
      score: 3,
      totalQuestions: 5, // 60%
      accuracy: 0.6,
      source: "quiz",
      createdAt: mockTimestamp(1000),
    },
    {
      id: "b4",
      subjectId: "sub1",
      subjectName: "Subject",
      topic: "Boundary Fail",
      score: 3,
      totalQuestions: 5, // 60%
      accuracy: 0.6,
      source: "quiz",
      createdAt: mockTimestamp(2000),
    },
  ];
  const failRes = classifyTopicPerformance(belowBoundary);
  assert.strictEqual(failRes[0].status, "needs_revision", "60% overall and recent is needs_revision");

  // C) Insufficient attempts: 1 attempt with 20 questions -> not_enough_data
  const singleAttempt: AssessmentResult[] = [
    {
      id: "b5",
      subjectId: "sub1",
      subjectName: "Subject",
      topic: "Single Attempt",
      score: 18,
      totalQuestions: 20,
      accuracy: 0.9,
      source: "quiz",
      createdAt: mockTimestamp(1000),
    },
  ];
  assert.strictEqual(classifyTopicPerformance(singleAttempt)[0].status, "not_enough_data");

  // D) Insufficient questions: 2 attempts with 2 questions each (4 total) -> not_enough_data
  const fewQuestions: AssessmentResult[] = [
    {
      id: "b6",
      subjectId: "sub1",
      subjectName: "Subject",
      topic: "Few Questions",
      score: 2,
      totalQuestions: 2,
      accuracy: 1.0,
      source: "quiz",
      createdAt: mockTimestamp(1000),
    },
    {
      id: "b7",
      subjectId: "sub1",
      subjectName: "Subject",
      topic: "Few Questions",
      score: 2,
      totalQuestions: 2,
      accuracy: 1.0,
      source: "quiz",
      createdAt: mockTimestamp(2000),
    },
  ];
  assert.strictEqual(classifyTopicPerformance(fewQuestions)[0].status, "not_enough_data");

  console.log("✔ Boundary thresholds and insufficient data requirements verified");
}

// 11. Review invalidation when a new assessment arrives after reviewed marker
{
  const topicKey = normalizeTopicKey("math", "Algebra");
  const reviewedMap = new Map<string, string>();
  // Marked reviewed at T = 5000
  reviewedMap.set(topicKey, new Date(5000).toISOString());

  // Assessment 1 at T = 2000, Assessment 2 at T = 7000 (after review!)
  const algebraAssessments: AssessmentResult[] = [
    {
      id: "alg1",
      subjectId: "math",
      subjectName: "Math",
      topic: "Algebra",
      score: 2,
      totalQuestions: 5,
      accuracy: 0.4,
      source: "quiz",
      createdAt: mockTimestamp(2000),
    },
    {
      id: "alg2",
      subjectId: "math",
      subjectName: "Math",
      topic: "Algebra",
      score: 1,
      totalQuestions: 5, // Poor score after being marked reviewed
      accuracy: 0.2,
      source: "quiz",
      createdAt: mockTimestamp(7000), // Newer than review timestamp (5000)
    },
  ];

  const now = new Date(8000);
  const evaluated = classifyTopicPerformance(algebraAssessments, { reviewedMap, now });
  // Because new evidence arrived at T=7000 after review at T=5000, review status MUST be invalidated!
  assert.strictEqual(evaluated[0].isReviewedRecently, false, "New assessment after review must invalidate reviewed status");

  const recs = buildRevisionRecommendations(evaluated, [], reviewedMap);
  assert.strictEqual(recs[0].isReviewed, false);
  assert.strictEqual(recs[0].urgency, "high", "Without an exam, weak topic has high urgency and is not demoted to low");
  console.log("✔ New assessment recorded after review marker safely invalidates reviewed status");
}

// 12. Imminent exam (< 3 days) protects urgency despite active review marker
{
  const topicKey = normalizeTopicKey("chem", "Acids");
  const reviewedMap = new Map<string, string>();
  // Marked reviewed 1 hour ago
  const reviewedAt = new Date("2026-10-16T10:00:00Z");
  reviewedMap.set(topicKey, reviewedAt.toISOString());

  const assessments: AssessmentResult[] = [
    {
      id: "ac1",
      subjectId: "chem",
      subjectName: "Chemistry",
      topic: "Acids",
      score: 2,
      totalQuestions: 5,
      accuracy: 0.4,
      source: "quiz",
      createdAt: mockTimestamp(reviewedAt.getTime() - 10000),
    },
    {
      id: "ac2",
      subjectId: "chem",
      subjectName: "Chemistry",
      topic: "Acids",
      score: 2,
      totalQuestions: 5,
      accuracy: 0.4,
      source: "quiz",
      createdAt: mockTimestamp(reviewedAt.getTime() - 5000),
    },
  ];

  const now = new Date("2026-10-16T11:00:00Z");
  const evaluated = classifyTopicPerformance(assessments, { reviewedMap, now });
  assert.strictEqual(evaluated[0].isReviewedRecently, true);

  // Chemistry exam is in 2 days!
  const examDate = new Date(now);
  examDate.setDate(examDate.getDate() + 2);
  const exams: Exam[] = [
    {
      id: "exam_chem",
      name: "Chemistry Final",
      subjectId: "chem",
      subjectName: "Chemistry",
      subjectEmoji: "🧪",
      date: examDate.toISOString().slice(0, 10),
      syllabus: [{ id: "syl_a", title: "Acids", done: false }],
    },
  ];

  const recs = buildRevisionRecommendations(evaluated, exams, reviewedMap, now);
  // Imminent exam must NEVER be suppressed to low urgency!
  assert.strictEqual(recs[0].urgency, "urgent", "Imminent exam (<= 3 days) must retain urgent status despite review");
  assert.ok(recs[0].reason.includes("Imminent exam in 2 days"));
  console.log("✔ Imminent exam (< 3 days) retains urgent status and cannot be suppressed by review marker");
}

// 13. Expired review marker (> 7 days) expires and does not suppress weak topic
{
  const topicKey = normalizeTopicKey("bio", "Ecology");
  const reviewedMap = new Map<string, string>();
  // Reviewed 10 days ago
  const tenDaysAgo = new Date("2026-10-06T12:00:00Z");
  reviewedMap.set(topicKey, tenDaysAgo.toISOString());

  const assessments: AssessmentResult[] = [
    {
      id: "eco1",
      subjectId: "bio",
      subjectName: "Biology",
      topic: "Ecology",
      score: 2,
      totalQuestions: 5,
      accuracy: 0.4,
      source: "quiz",
      createdAt: mockTimestamp(tenDaysAgo.getTime() - 20000),
    },
    {
      id: "eco2",
      subjectId: "bio",
      subjectName: "Biology",
      topic: "Ecology",
      score: 2,
      totalQuestions: 5,
      accuracy: 0.4,
      source: "quiz",
      createdAt: mockTimestamp(tenDaysAgo.getTime() - 10000),
    },
  ];

  const now = new Date("2026-10-16T12:00:00Z"); // 10 days after review
  const evaluated = classifyTopicPerformance(assessments, { reviewedMap, now });
  assert.strictEqual(evaluated[0].isReviewedRecently, false, "Review marker > 7 days old must expire");

  const recs = buildRevisionRecommendations(evaluated, [], reviewedMap);
  assert.strictEqual(recs[0].isReviewed, false);
  assert.strictEqual(recs[0].urgency, "high"); // Full urgency restored
  console.log("✔ Expired review marker (> 7 days) correctly expires and restores recommendation urgency");
}

console.log("\nAll Weak Topic Detection & Smart Revision tests passed successfully! 🎉");
