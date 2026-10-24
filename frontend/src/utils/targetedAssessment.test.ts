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
  match(actual: string, regex: RegExp, message?: string) {
    if (!regex.test(actual)) {
      throw new Error(`${message ?? "Assertion failed"}: "${actual}" does not match pattern ${regex}`);
    }
  },
  throws(fn: () => void, regex?: RegExp) {
    let threw = false;
    try {
      fn();
    } catch (err) {
      threw = true;
      if (regex && err instanceof Error) {
        if (!regex.test(err.message)) {
          throw new Error(`Expected error message to match ${regex}, got "${err.message}"`, { cause: err });
        }
      }
    }
    if (!threw) {
      throw new Error("Expected function to throw an error, but it succeeded");
    }
  },
};

function test(name: string, fn: () => void) {
  try {
    fn();
    console.log(`✔ ${name}`);
  } catch (err) {
    console.error(`✘ ${name}`);
    throw err;
  }
}

import {
  evaluateMcq,
  evaluateNumerical,
  evaluateShortAnswer,
  evaluateTargetedAssessment,
  compareAssessmentAttempts,
  getFallbackTargetedQuestions,
  buildTargetedQuizPrompt,
  parseTargetedQuizResponse,
} from "./targetedAssessment.ts";
import type { TargetedQuestion, StudentAnswer, AssessmentResult } from "../types/assessment.ts";

test("evaluateMcq: correctly grades right, wrong, and unanswered questions", () => {
  const mcq: TargetedQuestion = {
    id: "q1",
    type: "mcq",
    prompt: "What is the unit of force?",
    options: ["Joule", "Newton", "Pascal", "Watt"],
    correctOptionIndex: 1,
    explanation: "Force is measured in Newtons (N).",
    difficulty: "foundational",
  };

  // Correct answer
  const correct = evaluateMcq(mcq, { selectedOptionIndex: 1 });
  assert.strictEqual(correct.isCorrect, true);
  assert.strictEqual(correct.earnedMarks, 1);
  assert.strictEqual(correct.maxMarks, 1);
  assert.strictEqual(correct.gradingMethod, "deterministic_mcq");
  assert.match(correct.feedback, /Correct!/);

  // Incorrect answer
  const wrong = evaluateMcq(mcq, { selectedOptionIndex: 0 });
  assert.strictEqual(wrong.isCorrect, false);
  assert.strictEqual(wrong.earnedMarks, 0);
  assert.match(wrong.feedback, /Incorrect/);
  assert.match(wrong.studentAnswerDisplay, /A\. Joule/);

  // Unanswered
  const unanswered = evaluateMcq(mcq, {});
  assert.strictEqual(unanswered.isCorrect, false);
  assert.strictEqual(unanswered.earnedMarks, 0);
  assert.strictEqual(unanswered.studentAnswerDisplay, "Unanswered");
  assert.match(unanswered.feedback, /Unanswered/);
});

test("evaluateNumerical: evaluates within and outside tolerance limits", () => {
  const numQ: TargetedQuestion = {
    id: "q2",
    type: "numerical",
    prompt: "Calculate velocity given distance 100m and time 5s.",
    numericalAnswer: 20,
    tolerancePercent: 5, // ±5% is 19 to 21
    expectedUnit: "m/s",
    explanation: "v = d / t = 100 / 5 = 20 m/s.",
    difficulty: "standard",
  };

  // Exact match
  const exact = evaluateNumerical(numQ, { numericValue: 20 });
  assert.strictEqual(exact.isCorrect, true);
  assert.strictEqual(exact.earnedMarks, 1);
  assert.strictEqual(exact.gradingMethod, "deterministic_numerical");
  assert.strictEqual(exact.studentAnswerDisplay, "20 m/s");

  // Inside tolerance (20.8 is within 5% of 20, which is up to 21)
  const withinTol = evaluateNumerical(numQ, { numericValue: 20.8 });
  assert.strictEqual(withinTol.isCorrect, true);
  assert.strictEqual(withinTol.earnedMarks, 1);

  // Outside tolerance (22 is > 21)
  const outsideTol = evaluateNumerical(numQ, { numericValue: 22 });
  assert.strictEqual(outsideTol.isCorrect, false);
  assert.strictEqual(outsideTol.earnedMarks, 0);
  assert.match(outsideTol.feedback, /Incorrect/);

  // Unanswered / NaN
  const unanswered = evaluateNumerical(numQ, { numericValue: undefined });
  assert.strictEqual(unanswered.isCorrect, false);
  assert.strictEqual(unanswered.studentAnswerDisplay, "Unanswered");
});

test("evaluateShortAnswer: handles rubric matching and AI estimation", () => {
  const shortQ: TargetedQuestion = {
    id: "q3",
    type: "short_answer",
    prompt: "Explain Lenz's Law.",
    modelAnswer: "An induced current flows in a direction such that its magnetic field opposes the change in flux producing it.",
    rubricKeywords: ["induced", "magnetic field", "opposes", "flux"],
    explanation: "Conservation of energy dictates that induced emf opposes magnetic flux change.",
    difficulty: "standard",
  };

  // Unanswered
  const unans = evaluateShortAnswer(shortQ, { textAnswer: "" });
  assert.strictEqual(unans.isCorrect, false);
  assert.strictEqual(unans.earnedMarks, 0);
  assert.strictEqual(unans.studentAnswerDisplay, "Unanswered");

  // Rubric match fallback with 3 of 4 keywords
  const rubricGood = evaluateShortAnswer(shortQ, {
    textAnswer: "The induced current opposes the change in magnetic flux.",
  });
  assert.strictEqual(rubricGood.isCorrect, true);
  assert.ok(rubricGood.earnedMarks >= 0.7);
  assert.match(rubricGood.feedback, /\[Rubric Estimate\]/);

  // Explicit AI grading ratio
  const aiGraded = evaluateShortAnswer(
    shortQ,
    { textAnswer: "Current opposes flux." },
    0.9,
    "Clear conceptual grasp with concise wording."
  );
  assert.strictEqual(aiGraded.isCorrect, true);
  assert.strictEqual(aiGraded.earnedMarks, 0.9);
  assert.strictEqual(aiGraded.gradingMethod, "ai_estimated");
  assert.match(aiGraded.feedback, /\[AI Estimate\]/);
});

test("evaluateTargetedAssessment: runs complete multi-format assessment", () => {
  const questions: TargetedQuestion[] = [
    {
      id: "q1",
      type: "mcq",
      prompt: "Q1 MCQ",
      options: ["A", "B", "C"],
      correctOptionIndex: 0,
      explanation: "A is correct",
      difficulty: "standard",
    },
    {
      id: "q2",
      type: "numerical",
      prompt: "Q2 Numerical",
      numericalAnswer: 50,
      tolerancePercent: 2,
      explanation: "50 is correct",
      difficulty: "standard",
    },
  ];

  const answers: Record<string, StudentAnswer> = {
    q1: { selectedOptionIndex: 0 }, // correct (1 pt)
    q2: { numericValue: 40 }, // incorrect (0 pt)
  };

  const evalResult = evaluateTargetedAssessment(questions, answers);
  assert.strictEqual(evalResult.results.length, 2);
  assert.strictEqual(evalResult.totalEarned, 1);
  assert.strictEqual(evalResult.totalMax, 2);
  assert.strictEqual(evalResult.accuracy, 0.5);
  assert.strictEqual(evalResult.incorrectSummaries.length, 1);
  assert.match(evalResult.incorrectSummaries[0], /Q2 Numerical/);
});

test("compareAssessmentAttempts: tracks delta and attaches integrity disclaimers", () => {
  const pastAttempts: AssessmentResult[] = [
    {
      id: "attempt-1",
      subjectId: "sub1",
      subjectName: "Physics",
      topic: "Doppler Effect",
      score: 2,
      totalQuestions: 5,
      accuracy: 0.4,
      source: "quiz",
    },
  ];

  // Improvement comparison (+30%)
  const improved = compareAssessmentAttempts(0.7, pastAttempts, "Doppler Effect");
  assert.strictEqual(improved.hasPrevious, true);
  assert.strictEqual(improved.deltaPercent, 30);
  assert.strictEqual(improved.isImproved, true);
  assert.match(improved.insight, /climb|progress|recovery/i);
  assert.match(improved.disclaimer, /differences in question difficulty/i);
  assert.match(improved.disclaimer, /does not constitute official academic certification/i);

  // First time topic
  const baseline = compareAssessmentAttempts(0.8, pastAttempts, "Thermodynamics");
  assert.strictEqual(baseline.hasPrevious, false);
  assert.strictEqual(baseline.deltaPercent, null);
  assert.match(baseline.insight, /baseline/i);
});

test("getFallbackTargetedQuestions: produces valid fallback sets with count", () => {
  const phys = getFallbackTargetedQuestions("Doppler Shift", "Physics", "calculation", 2);
  assert.strictEqual(phys.length, 2);
  assert.strictEqual(phys[0].type, "mcq");

  const math = getFallbackTargetedQuestions("Integration by parts", "Mathematics", undefined, 3);
  assert.strictEqual(math.length, 3);

  const gen = getFallbackTargetedQuestions("Ancient Rome", "History", undefined, 2);
  assert.strictEqual(gen.length, 2);
  assert.match(gen[0].prompt, /Ancient Rome/);
});

test("buildTargetedQuizPrompt & parseTargetedQuizResponse: generates and parses AI response", () => {
  const prompt = buildTargetedQuizPrompt("Organic Chemistry", "Chemistry", 3, "challenge", "misread_question");
  assert.match(prompt, /Organic Chemistry/);
  assert.match(prompt, /misread_question/);
  assert.match(prompt, /challenge/);

  // Mock valid response with markdown json fences
  const mockResponse = `\`\`\`json
{
  "questions": [
    {
      "id": "q1",
      "type": "mcq",
      "prompt": "What is an enantiomer?",
      "options": ["Mirror image", "Structural isomer", "Conformer", "Polymer"],
      "correctOptionIndex": 0,
      "explanation": "Enantiomers are non-superimposable mirror images.",
      "difficulty": "challenge"
    },
    {
      "id": "q2",
      "type": "numerical",
      "prompt": "Find pH given [H+] = 0.01 M",
      "numericalAnswer": 2,
      "tolerancePercent": 1,
      "expectedUnit": "pH",
      "explanation": "pH = -log(0.01) = 2.",
      "difficulty": "standard"
    }
  ]
}
\`\`\``;

  const parsed = parseTargetedQuizResponse(mockResponse);
  assert.strictEqual(parsed.length, 2);
  assert.strictEqual(parsed[0].id, "q1");
  assert.strictEqual(parsed[0].type, "mcq");
  assert.strictEqual(parsed[1].type, "numerical");
  assert.strictEqual(parsed[1].numericalAnswer, 2);

  // Malformed response throws error
  assert.throws(() => parseTargetedQuizResponse("Not valid json at all"), /expected format/);
});
