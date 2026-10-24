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
  match(actual: string, regex: RegExp, message?: string) {
    if (!regex.test(actual)) {
      throw new Error(`${message ?? "Assertion failed"}: expected "${actual}" to match ${regex}`);
    }
  },
};
import {
  computePaperSummary,
  formatPaperScoreDisplay,
  validateAllPaperMarks,
  validateQuestionMarks,
} from "./paperScores.ts";
import type { QuestionAnalysis } from "../types/paper.ts";

console.log("Running Paper Academic Calculation & Validation Tests...");

// 1. Exam paper with no teacher marks entered (ungraded)
{
  const qs: QuestionAnalysis[] = [
    { id: "q1", questionNumber: "1", questionText: "Q1", maxMarks: 10 },
    { id: "q2", questionNumber: "2", questionText: "Q2", maxMarks: 10 },
  ];
  const summary = computePaperSummary(qs, "exam");
  assert.equal(summary.totalTeacherMarks, null, "Ungraded exam must have null totalTeacherMarks");
  assert.equal(summary.percentage, null, "Ungraded exam must have null percentage");
  assert.equal(summary.isGradingComplete, false, "Ungraded exam isGradingComplete must be false");
  assert.equal(summary.gradedQuestionsCount, 0, "Ungraded exam gradedQuestionsCount must be 0");
  assert.equal(summary.scoreType, "none", "scoreType must be none");

  const display = formatPaperScoreDisplay(summary, "exam");
  assert.equal(display.badgeText, "Grading pending");
  assert.equal(display.isPending, true);
  console.log("✔ Ungraded exam returns null percentage and 'Grading pending'");
}

// 2. Exam paper with AI estimates present, but no teacher marks
{
  const qs: QuestionAnalysis[] = [
    { id: "q1", questionNumber: "1", questionText: "Q1", maxMarks: 10, aiEstimatedMarks: 8 },
    { id: "q2", questionNumber: "2", questionText: "Q2", maxMarks: 10, aiEstimatedMarks: 7 },
  ];
  const summary = computePaperSummary(qs, "exam");
  assert.equal(summary.totalTeacherMarks, null, "Official marks must remain null");
  assert.equal(summary.percentage, null, "Official percentage must not fallback to AI estimates");
  assert.equal(summary.totalAiEstimatedMarks, 15, "AI estimates tracked separately");
  assert.equal(summary.scoreType, "none", "Official scoreType must remain none");

  const display = formatPaperScoreDisplay(summary, "exam");
  assert.equal(display.badgeText, "Grading pending");
  assert.match(display.detailText, /AI Est: 15\/20/);
  console.log("✔ Official exam never substitutes AI estimates for teacher marks");
}

// 3. Partially graded exam paper (1 of 3 questions graded)
{
  const qs: QuestionAnalysis[] = [
    { id: "q1", questionNumber: "1", questionText: "Q1", maxMarks: 10, teacherAwardedMarks: 10 },
    { id: "q2", questionNumber: "2", questionText: "Q2", maxMarks: 10 }, // ungraded
    { id: "q3", questionNumber: "3", questionText: "Q3", maxMarks: 10 }, // ungraded
  ];
  const summary = computePaperSummary(qs, "exam");
  assert.equal(summary.totalTeacherMarks, 10);
  assert.equal(summary.gradedQuestionsCount, 1);
  assert.equal(summary.gradedMaxMarks, 10);
  assert.equal(summary.isGradingComplete, false);
  assert.equal(summary.percentage, null, "Partial grading must NOT calculate full-paper percentage");

  const display = formatPaperScoreDisplay(summary, "exam");
  assert.equal(display.isPartial, true);
  assert.equal(display.badgeText, "Partial");
  assert.match(display.detailText, /Graded 1\/3 qs/);
  console.log("✔ Partially graded exam represents partial state honestly without full percentage");
}

// 4. Fully graded exam paper
{
  const qs: QuestionAnalysis[] = [
    { id: "q1", questionNumber: "1", questionText: "Q1", maxMarks: 10, teacherAwardedMarks: 8 },
    { id: "q2", questionNumber: "2", questionText: "Q2", maxMarks: 10, teacherAwardedMarks: 9 },
  ];
  const summary = computePaperSummary(qs, "exam");
  assert.equal(summary.totalTeacherMarks, 17);
  assert.equal(summary.maxMarks, 20);
  assert.equal(summary.percentage, 85);
  assert.equal(summary.isGradingComplete, true);
  assert.equal(summary.scoreType, "teacher");

  const display = formatPaperScoreDisplay(summary, "exam");
  assert.equal(display.isComplete, true);
  assert.equal(display.badgeText, "85%");
  assert.match(display.detailText, /Teacher: 17\/20 \(Official\)/);
  console.log("✔ Fully graded exam computes official score and 85% percentage");
}

// 5. Exam paper with legitimate zero marks awarded
{
  const qs: QuestionAnalysis[] = [
    { id: "q1", questionNumber: "1", questionText: "Q1", maxMarks: 10, teacherAwardedMarks: 0 },
    { id: "q2", questionNumber: "2", questionText: "Q2", maxMarks: 10, teacherAwardedMarks: 0 },
  ];
  const summary = computePaperSummary(qs, "exam");
  assert.equal(summary.totalTeacherMarks, 0);
  assert.equal(summary.percentage, 0, "Legitimate zero marks produces 0%");
  assert.equal(summary.isGradingComplete, true, "Grading is complete when all questions are evaluated");
  console.log("✔ Legitimate zero marks awarded by teacher correctly produces 0% complete grade");
}

// 6. Practice paper with self-entered marks
{
  const qs: QuestionAnalysis[] = [
    { id: "q1", questionNumber: "1", questionText: "Q1", maxMarks: 5, studentEnteredMarks: 4 },
    { id: "q2", questionNumber: "2", questionText: "Q2", maxMarks: 5, studentEnteredMarks: 5 },
  ];
  const summary = computePaperSummary(qs, "practice");
  assert.equal(summary.totalStudentMarks, 9);
  assert.equal(summary.percentage, 90);
  assert.equal(summary.scoreType, "student");
  assert.equal(summary.totalTeacherMarks, null);
  console.log("✔ Practice paper with self-entered marks uses student scoreType");
}

// 7. Practice paper with AI estimated marks only
{
  const qs: QuestionAnalysis[] = [
    { id: "q1", questionNumber: "1", questionText: "Q1", maxMarks: 10, aiEstimatedMarks: 7 },
    { id: "q2", questionNumber: "2", questionText: "Q2", maxMarks: 10, aiEstimatedMarks: 8 },
  ];
  const summary = computePaperSummary(qs, "practice");
  assert.equal(summary.totalAiEstimatedMarks, 15);
  assert.equal(summary.percentage, 75);
  assert.equal(summary.scoreType, "ai");
  assert.equal(summary.totalStudentMarks, null);

  const display = formatPaperScoreDisplay(summary, "practice");
  assert.equal(display.badgeText, "75%");
  assert.match(display.detailText, /AI Estimate: 15\/20/);
  console.log("✔ Practice paper with AI estimates tags scoreType as 'ai'");
}

// 8. Marks validation (Fix 6)
{
  const validQ: QuestionAnalysis = {
    id: "q1",
    questionNumber: "1",
    questionText: "Text",
    maxMarks: 10,
    teacherAwardedMarks: 8,
  };
  assert.equal(validateQuestionMarks(validQ, "exam").isValid, true);

  // Negative marks rejected
  const negQ: QuestionAnalysis = {
    id: "q2",
    questionNumber: "2",
    questionText: "Text",
    maxMarks: 10,
    teacherAwardedMarks: -2,
  };
  const negRes = validateQuestionMarks(negQ, "exam");
  assert.equal(negRes.isValid, false);
  assert.match(negRes.error!, /cannot be negative/);

  // Exceeding max marks rejected
  const exceedQ: QuestionAnalysis = {
    id: "q3",
    questionNumber: "3",
    questionText: "Text",
    maxMarks: 10,
    teacherAwardedMarks: 15,
  };
  const exceedRes = validateQuestionMarks(exceedQ, "exam");
  assert.equal(exceedRes.isValid, false);
  assert.match(exceedRes.error!, /exceed maximum marks/);

  // Practice self-entered marks exceeding max
  const exceedStudentQ: QuestionAnalysis = {
    id: "q4",
    questionNumber: "4",
    questionText: "Text",
    maxMarks: 5,
    studentEnteredMarks: 6,
  };
  const exceedStudentRes = validateQuestionMarks(exceedStudentQ, "practice");
  assert.equal(exceedStudentRes.isValid, false);
  assert.match(exceedStudentRes.error!, /exceed maximum marks/);

  const allErrors = validateAllPaperMarks([validQ, negQ, exceedQ], "exam");
  assert.equal(allErrors.length, 2);
  console.log("✔ Marks validation correctly rejects negative marks and marks exceeding maximum");
}

console.log("All Paper Academic Calculation & Validation Tests Passed! 🎓");
