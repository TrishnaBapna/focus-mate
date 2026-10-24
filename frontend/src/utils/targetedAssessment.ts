import type {
  QuestionGradingResult,
  RetestComparison,
  StudentAnswer,
  TargetedQuestion,
} from "../types/assessment";
import type { AssessmentResult } from "../types/assessment";
/**
 * Extracts and parses a JSON payload from AI text, stripping code fences if present.
 */
export function extractJson(text: string): unknown {
  const cleaned = text.replace(/```json|```/g, "").trim();
  const start = cleaned.search(/[{[]/);
  const end = Math.max(cleaned.lastIndexOf("}"), cleaned.lastIndexOf("]"));
  if (start === -1 || end === -1) {
    throw new Error("The AI's answer wasn't in the expected format. Please try again.");
  }
  try {
    return JSON.parse(cleaned.slice(start, end + 1));
  } catch {
    throw new Error("The AI's answer wasn't in the expected format. Please try again.");
  }
}

/**
 * Deterministically grades an MCQ question based on the stored correctOptionIndex.
 */
export function evaluateMcq(
  question: TargetedQuestion,
  answer?: StudentAnswer
): QuestionGradingResult {
  const selectedIndex = answer?.selectedOptionIndex;
  const isUnanswered = selectedIndex === null || selectedIndex === undefined;
  const isCorrect = !isUnanswered && selectedIndex === question.correctOptionIndex;

  const studentDisplay = isUnanswered
    ? "Unanswered"
    : question.options && selectedIndex >= 0 && selectedIndex < question.options.length
    ? `${String.fromCharCode(65 + selectedIndex)}. ${question.options[selectedIndex]}`
    : `Option ${selectedIndex}`;

  const correctDisplay =
    question.options &&
    typeof question.correctOptionIndex === "number" &&
    question.correctOptionIndex >= 0 &&
    question.correctOptionIndex < question.options.length
      ? `${String.fromCharCode(65 + question.correctOptionIndex)}. ${question.options[question.correctOptionIndex]}`
      : "Unknown";

  const feedback = isCorrect
    ? `Correct! ${question.explanation}`
    : isUnanswered
    ? `Unanswered. Correct answer was ${correctDisplay}. ${question.explanation}`
    : `Incorrect. Correct answer was ${correctDisplay}. ${question.explanation}`;

  return {
    questionId: question.id,
    isCorrect,
    earnedMarks: isCorrect ? 1 : 0,
    maxMarks: 1,
    gradingMethod: "deterministic_mcq",
    feedback,
    studentAnswerDisplay: studentDisplay,
    correctAnswerDisplay: correctDisplay,
    isFlagged: answer?.isFlagged,
  };
}

/**
 * Evaluates a numerical problem-solving question using configured tolerance percentage.
 * Handles negative values, zeroes, floating point approximations, and unit labels.
 */
export function evaluateNumerical(
  question: TargetedQuestion,
  answer?: StudentAnswer
): QuestionGradingResult {
  const studentVal = answer?.numericValue;
  const expectedVal = question.numericalAnswer ?? 0;
  const tolPercent = question.tolerancePercent ?? 5; // default ±5%
  const unit = question.expectedUnit ? ` ${question.expectedUnit}` : "";

  const isUnanswered = studentVal === null || studentVal === undefined || isNaN(studentVal);
  const allowedMargin = Math.max((tolPercent / 100) * Math.abs(expectedVal), 0.001);
  const isCorrect = !isUnanswered && Math.abs(studentVal - expectedVal) <= allowedMargin;

  const studentDisplay = isUnanswered ? "Unanswered" : `${studentVal}${unit}`;
  const correctDisplay = `${expectedVal}${unit} (±${tolPercent}%)`;

  const feedback = isCorrect
    ? `Correct! Result falls within the ±${tolPercent}% numerical tolerance. ${question.explanation}`
    : isUnanswered
    ? `Unanswered. Expected ${correctDisplay}. ${question.explanation}`
    : `Incorrect. You answered ${studentDisplay}, expected ${correctDisplay}. ${question.explanation}`;

  return {
    questionId: question.id,
    isCorrect,
    earnedMarks: isCorrect ? 1 : 0,
    maxMarks: 1,
    gradingMethod: "deterministic_numerical",
    feedback,
    studentAnswerDisplay: studentDisplay,
    correctAnswerDisplay: correctDisplay,
    isFlagged: answer?.isFlagged,
  };
}

/**
 * Evaluates a conceptual short answer, matching rubric keywords or applying AI feedback.
 * Explicitly marks evaluation as AI-estimated or rubric-checked.
 */
export function evaluateShortAnswer(
  question: TargetedQuestion,
  answer?: StudentAnswer,
  aiRatio?: number,
  aiFeedback?: string
): QuestionGradingResult {
  const text = (answer?.textAnswer || "").trim();
  const isUnanswered = text.length === 0;

  if (isUnanswered) {
    return {
      questionId: question.id,
      isCorrect: false,
      earnedMarks: 0,
      maxMarks: 1,
      gradingMethod: "ai_estimated",
      feedback: `Unanswered. Model answer: "${question.modelAnswer || question.explanation}".`,
      studentAnswerDisplay: "Unanswered",
      correctAnswerDisplay: question.modelAnswer || question.explanation,
      isFlagged: answer?.isFlagged,
    };
  }

  // If AI evaluation ratio is supplied directly
  if (typeof aiRatio === "number" && !isNaN(aiRatio)) {
    const clampedRatio = Math.max(0, Math.min(1, aiRatio));
    const isCorrect = clampedRatio >= 0.7;
    return {
      questionId: question.id,
      isCorrect,
      earnedMarks: Math.round(clampedRatio * 10) / 10,
      maxMarks: 1,
      gradingMethod: "ai_estimated",
      feedback: `[AI Estimate] ${aiFeedback || (isCorrect ? "Answer aligns with key concepts." : "Partial or missing key concepts.")} ${question.explanation}`,
      studentAnswerDisplay: text,
      correctAnswerDisplay: question.modelAnswer || question.explanation,
      isFlagged: answer?.isFlagged,
    };
  }

  // Rubric keyword matching fallback
  const keywords = question.rubricKeywords || [];
  const lower = text.toLowerCase();
  const matched = keywords.filter((k) => lower.includes(k.toLowerCase())).length;
  const ratio = keywords.length > 0 ? matched / keywords.length : text.length > 20 ? 0.8 : 0.4;
  const isCorrect = ratio >= 0.6;

  return {
    questionId: question.id,
    isCorrect,
    earnedMarks: Math.round(ratio * 10) / 10,
    maxMarks: 1,
    gradingMethod: "ai_estimated",
    feedback: `[Rubric Estimate] ${matched} of ${keywords.length} key rubric elements recognized. ${question.explanation}`,
    studentAnswerDisplay: text,
    correctAnswerDisplay: question.modelAnswer || question.explanation,
    isFlagged: answer?.isFlagged,
  };
}

/**
 * Runs full assessment evaluation across questions and answers.
 */
export function evaluateTargetedAssessment(
  questions: TargetedQuestion[],
  answers: Record<string, StudentAnswer>
): {
  results: QuestionGradingResult[];
  totalEarned: number;
  totalMax: number;
  accuracy: number;
  incorrectSummaries: string[];
} {
  const results: QuestionGradingResult[] = [];
  const incorrectSummaries: string[] = [];

  for (const q of questions) {
    const ans = answers[q.id];
    let res: QuestionGradingResult;

    if (q.type === "mcq") {
      res = evaluateMcq(q, ans);
    } else if (q.type === "numerical") {
      res = evaluateNumerical(q, ans);
    } else {
      res = evaluateShortAnswer(q, ans);
    }

    results.push(res);
    if (!res.isCorrect) {
      incorrectSummaries.push(
        `${q.prompt.slice(0, 60)}… (Answered: ${res.studentAnswerDisplay}, Expected: ${res.correctAnswerDisplay})`
      );
    }
  }

  const totalEarned = results.reduce((sum, r) => sum + r.earnedMarks, 0);
  const totalMax = results.reduce((sum, r) => sum + r.maxMarks, 0);
  const accuracy = totalMax > 0 ? Math.round((totalEarned / totalMax) * 1000) / 1000 : 0;

  return {
    results,
    totalEarned: Math.round(totalEarned * 10) / 10,
    totalMax,
    accuracy,
    incorrectSummaries,
  };
}

/**
 * Compares current assessment results against prior attempts for the same topic.
 */
export function compareAssessmentAttempts(
  currentAccuracy: number,
  previousAttempts: AssessmentResult[] = [],
  currentTopic: string
): RetestComparison {
  const lowerTopic = currentTopic.toLowerCase().trim();
  const pastAttempts = previousAttempts.filter(
    (a) => a.topic.toLowerCase().trim() === lowerTopic
  );

  if (pastAttempts.length === 0) {
    return {
      hasPrevious: false,
      previousAccuracy: null,
      currentAccuracy,
      deltaPercent: null,
      isImproved: false,
      insight: "Initial baseline quiz recorded for this topic.",
      disclaimer:
        "Note: This is your first recorded practice attempt on this topic. Practice scores are kept separate from official exam grades.",
    };
  }

  // Most recent prior attempt
  const prior = pastAttempts[0];
  const priorPct = Math.round(prior.accuracy * 100);
  const currPct = Math.round(currentAccuracy * 100);
  const delta = currPct - priorPct;
  const isImproved = delta > 0;

  let insight: string;
  if (delta > 15) {
    insight = `Significant recovery! Accuracy climbed by +${delta}% (from ${priorPct}% to ${currPct}%).`;
  } else if (delta > 0) {
    insight = `Positive progress: +${delta}% higher accuracy compared to your previous attempt (${priorPct}%).`;
  } else if (delta === 0) {
    insight = `Performance is consistent with prior attempt (${currPct}%). Continue practicing key definitions and problem variations.`;
  } else {
    insight = `Score decreased by ${Math.abs(delta)}% (from ${priorPct}% to ${currPct}%). Review foundational notes before retesting.`;
  }

  return {
    hasPrevious: true,
    previousAccuracy: prior.accuracy,
    currentAccuracy,
    deltaPercent: delta,
    isImproved,
    insight,
    disclaimer:
      "Note: Practice retests measure topic recovery using newly generated questions. Differences in question difficulty may affect exact scores. A single quiz does not constitute official academic certification.",
  };
}

/**
 * Robust curriculum fallback question bank for standard subjects when AI is offline.
 * Discloses that questions are curated curriculum fallbacks.
 */
export function getFallbackTargetedQuestions(
  topic: string,
  subjectName: string,
  mistakeTag?: string,
  count: number = 3
): TargetedQuestion[] {
  const lowerTopic = topic.toLowerCase();
  const lowerSub = subjectName.toLowerCase();

  // 1. Physics / Doppler / Waves / Forces
  if (lowerTopic.includes("doppler") || lowerSub.includes("phys")) {
    const physQuestions: TargetedQuestion[] = [
      {
        id: "fb-phys-1",
        type: "mcq",
        prompt: `An observer is stationary while a sound source emits 440 Hz while moving toward the observer at 34 m/s (speed of sound = 340 m/s). What frequency does the observer perceive?`,
        options: ["400 Hz", "440 Hz", "488.9 Hz", "520 Hz"],
        correctOptionIndex: 2,
        explanation: "f' = f * (v / (v - vs)) = 440 * (340 / (340 - 34)) = 440 * (340 / 306) ≈ 488.9 Hz.",
        difficulty: "standard",
        targetedMistakeTag: mistakeTag || "calculation",
      },
      {
        id: "fb-phys-2",
        type: "numerical",
        prompt: `A wave has frequency 50 Hz and wavelength 6.8 m. Calculate the wave speed in m/s.`,
        numericalAnswer: 340,
        tolerancePercent: 2,
        expectedUnit: "m/s",
        explanation: "v = f * λ = 50 Hz * 6.8 m = 340 m/s.",
        difficulty: "foundational",
        targetedMistakeTag: "calculation",
      },
      {
        id: "fb-phys-3",
        type: "short_answer",
        prompt: `State what happens to the observed wavelength and frequency when a light source recedes from an observer (redshift).`,
        modelAnswer: "The observed wavelength increases and the observed frequency decreases.",
        rubricKeywords: ["wavelength", "frequency", "decrease", "increase", "redshift"],
        explanation: "When receding, wavefronts are spaced further apart, lengthening wavelength and lowering frequency.",
        difficulty: "standard",
        targetedMistakeTag: "conceptual",
      },
    ];
    return physQuestions.slice(0, count);
  }

  // 2. Calculus / Mathematics / Integration
  if (lowerTopic.includes("calculus") || lowerTopic.includes("integr") || lowerSub.includes("math")) {
    const mathQuestions: TargetedQuestion[] = [
      {
        id: "fb-math-1",
        type: "mcq",
        prompt: `According to the LIATE rule for integration by parts (∫ u dv = uv - ∫ v du), which function should be chosen as 'u' in ∫ x * sin(x) dx?`,
        options: ["sin(x)", "x", "cos(x)", "Either function"],
        correctOptionIndex: 1,
        explanation: "x is Algebraic (A) which precedes sin(x) Trigonometric (T) in LIATE.",
        difficulty: "standard",
        targetedMistakeTag: mistakeTag || "conceptual",
      },
      {
        id: "fb-math-2",
        type: "numerical",
        prompt: `Evaluate the definite integral ∫ from 0 to 2 of (3x^2 + 2x) dx.`,
        numericalAnswer: 12,
        tolerancePercent: 1,
        explanation: "∫(3x^2 + 2x)dx = [x^3 + x^2] from 0 to 2 = (8 + 4) - 0 = 12.",
        difficulty: "standard",
        targetedMistakeTag: "calculation",
      },
      {
        id: "fb-math-3",
        type: "mcq",
        prompt: `What is the derivative of f(x) = ln(3x^2 + 1)?`,
        options: ["6x / (3x^2 + 1)", "1 / (3x^2 + 1)", "6x * ln(3x^2 + 1)", "3x / (3x^2 + 1)"],
        correctOptionIndex: 0,
        explanation: "By chain rule, d/dx[ln(u)] = u'/u = (6x) / (3x^2 + 1).",
        difficulty: "standard",
        targetedMistakeTag: "misread_question",
      },
    ];
    return mathQuestions.slice(0, count);
  }

  // 3. General Fallback
  const generalQuestions: TargetedQuestion[] = [
    {
      id: "fb-gen-1",
      type: "mcq",
      prompt: `Which of the following best describes the primary definition or concept of "${topic}"?`,
      options: [
        `Core theoretical model describing ${topic}`,
        `An unrelated peripheral process`,
        `A static parameter that cannot vary`,
        `An empirical shortcut without mathematical foundation`,
      ],
      correctOptionIndex: 0,
      explanation: `Understanding the central theoretical model of ${topic} is key to solving diagnostic problems.`,
      difficulty: "foundational",
      targetedMistakeTag: mistakeTag || "conceptual",
    },
    {
      id: "fb-gen-2",
      type: "short_answer",
      prompt: `State the primary principle or governing equation associated with ${topic} and explain its practical significance.`,
      modelAnswer: `The governing principle of ${topic} relates key input variables to resulting outputs.`,
      rubricKeywords: ["principle", "variable", "system", "formula", "relationship"],
      explanation: `Explicitly identifying governing relationships prevents sign errors and conceptual gaps.`,
      difficulty: "standard",
      targetedMistakeTag: mistakeTag || "conceptual",
    },
    {
      id: "fb-gen-3",
      type: "mcq",
      prompt: `When checking your work on a problem involving ${topic}, what is the most reliable verification step?`,
      options: [
        "Verifying dimensional consistency (units) and boundary conditions",
        "Assuming the first calculated value must be right without checking",
        "Skipping intermediate steps to save time",
        "Re-writing only the final answer without working",
      ],
      correctOptionIndex: 0,
      explanation: "Checking dimensional consistency and boundary behavior catches arithmetic and unit slips.",
      difficulty: "standard",
      targetedMistakeTag: "calculation",
    },
  ];
  return generalQuestions.slice(0, count);
}

/**
 * Builds the AI prompt for generating targeted questions focusing on a weak topic or mistake.
 */
export function buildTargetedQuizPrompt(
  topic: string,
  subjectName: string,
  count: number = 3,
  difficulty: string = "standard",
  mistakeTag?: string
): string {
  const mistakeDirective = mistakeTag
    ? `Pay special attention to testing and correcting '${mistakeTag}' mistakes (e.g. if calculation, test arithmetic steps; if conceptual, test definitions; if misread_question, test distinguishing question constraints).`
    : "";

  return `Generate an academic practice assessment with exactly ${count} questions testing the student's mastery of the topic "${topic}" in subject "${subjectName}".
Difficulty level: ${difficulty}.
${mistakeDirective}

Requirements:
- Include a mix of multiple-choice ('mcq'), numerical ('numerical'), and conceptual short-answer ('short_answer') questions where appropriate.
- Every question must be clear, educational, and factually rigorous.
- Format response ONLY as valid JSON in this exact shape:
{
  "questions": [
    {
      "id": "q1",
      "type": "mcq",
      "prompt": "Question text here...",
      "options": ["Option A", "Option B", "Option C", "Option D"],
      "correctOptionIndex": 0,
      "explanation": "Detailed explanation of why A is correct and others are wrong.",
      "difficulty": "standard"
    },
    {
      "id": "q2",
      "type": "numerical",
      "prompt": "Problem asking for a numeric answer...",
      "numericalAnswer": 42.5,
      "tolerancePercent": 5,
      "expectedUnit": "m/s",
      "explanation": "Step by step working...",
      "difficulty": "standard"
    },
    {
      "id": "q3",
      "type": "short_answer",
      "prompt": "Conceptual question...",
      "modelAnswer": "Ideal concise student answer...",
      "rubricKeywords": ["keyword1", "keyword2"],
      "explanation": "Why this principle holds...",
      "difficulty": "standard"
    }
  ]
}`;
}

/**
 * Safely parses and validates AI generated targeted assessment questions.
 */
export function parseTargetedQuizResponse(responseText: string): TargetedQuestion[] {
  const data = extractJson(responseText);
  if (typeof data !== "object" || data === null || !("questions" in data)) {
    throw new Error("Invalid AI assessment structure. Expected 'questions' array.");
  }

  const rawList = (data as { questions: unknown[] }).questions;
  if (!Array.isArray(rawList) || rawList.length === 0) {
    throw new Error("No questions found in AI response.");
  }

  const validQuestions: TargetedQuestion[] = [];

  for (let i = 0; i < rawList.length; i++) {
    const item = rawList[i] as Record<string, unknown>;
    if (!item || typeof item.prompt !== "string" || item.prompt.trim().length === 0) continue;

    const type = item.type === "numerical" ? "numerical" : item.type === "short_answer" ? "short_answer" : "mcq";
    const id = typeof item.id === "string" ? item.id : `gen-q-${i + 1}`;
    const explanation = typeof item.explanation === "string" ? item.explanation : "";
    const difficulty =
      item.difficulty === "challenge" || item.difficulty === "foundational"
        ? item.difficulty
        : "standard";

    if (type === "mcq") {
      const options = Array.isArray(item.options)
        ? item.options.filter((o): o is string => typeof o === "string")
        : [];
      if (options.length < 2) continue;
      const correctOptionIndex =
        typeof item.correctOptionIndex === "number" &&
        item.correctOptionIndex >= 0 &&
        item.correctOptionIndex < options.length
          ? item.correctOptionIndex
          : 0;

      validQuestions.push({
        id,
        type: "mcq",
        prompt: item.prompt.trim(),
        options,
        correctOptionIndex,
        explanation,
        difficulty,
      });
    } else if (type === "numerical") {
      const numericalAnswer = typeof item.numericalAnswer === "number" ? item.numericalAnswer : 0;
      const tolerancePercent = typeof item.tolerancePercent === "number" ? item.tolerancePercent : 5;
      const expectedUnit = typeof item.expectedUnit === "string" ? item.expectedUnit : "";

      validQuestions.push({
        id,
        type: "numerical",
        prompt: item.prompt.trim(),
        numericalAnswer,
        tolerancePercent,
        expectedUnit,
        explanation,
        difficulty,
      });
    } else {
      // short_answer
      const modelAnswer = typeof item.modelAnswer === "string" ? item.modelAnswer : "";
      const rubricKeywords = Array.isArray(item.rubricKeywords)
        ? item.rubricKeywords.filter((k): k is string => typeof k === "string")
        : [];

      validQuestions.push({
        id,
        type: "short_answer",
        prompt: item.prompt.trim(),
        modelAnswer,
        rubricKeywords,
        explanation,
        difficulty,
      });
    }
  }

  if (validQuestions.length === 0) {
    throw new Error("Could not parse any valid questions from the AI output.");
  }

  return validQuestions;
}
