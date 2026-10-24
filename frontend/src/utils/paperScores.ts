import type { PaperScoreType, PaperSummary, PaperType, QuestionAnalysis } from "../types/paper";

export interface MarksValidationResult {
  isValid: boolean;
  error?: string;
  field?: "teacher" | "student" | "max";
}

/**
 * Validates entered marks for a single question.
 * Ensures marks are non-negative and do not exceed question maximum.
 */
export function validateQuestionMarks(
  q: QuestionAnalysis,
  paperType: PaperType
): MarksValidationResult {
  if (typeof q.maxMarks !== "number" || isNaN(q.maxMarks) || q.maxMarks <= 0) {
    return {
      isValid: false,
      error: `Question ${q.questionNumber}: Maximum marks must be greater than 0.`,
      field: "max",
    };
  }

  if (paperType === "exam") {
    if (typeof q.teacherAwardedMarks === "number") {
      if (isNaN(q.teacherAwardedMarks) || q.teacherAwardedMarks < 0) {
        return {
          isValid: false,
          error: `Question ${q.questionNumber}: Teacher marks cannot be negative.`,
          field: "teacher",
        };
      }
      if (q.teacherAwardedMarks > q.maxMarks) {
        return {
          isValid: false,
          error: `Question ${q.questionNumber}: Teacher marks (${q.teacherAwardedMarks}) exceed maximum marks (${q.maxMarks}).`,
          field: "teacher",
        };
      }
    }
  } else {
    // Practice paper
    if (typeof q.studentEnteredMarks === "number") {
      if (isNaN(q.studentEnteredMarks) || q.studentEnteredMarks < 0) {
        return {
          isValid: false,
          error: `Question ${q.questionNumber}: Self-entered marks cannot be negative.`,
          field: "student",
        };
      }
      if (q.studentEnteredMarks > q.maxMarks) {
        return {
          isValid: false,
          error: `Question ${q.questionNumber}: Self-entered marks (${q.studentEnteredMarks}) exceed maximum marks (${q.maxMarks}).`,
          field: "student",
        };
      }
    }
  }

  return { isValid: true };
}

/**
 * Validates all questions in a paper.
 * Returns array of errors (empty if all valid).
 */
export function validateAllPaperMarks(
  questions: QuestionAnalysis[],
  paperType: PaperType
): MarksValidationResult[] {
  const errors: MarksValidationResult[] = [];
  for (const q of questions) {
    const res = validateQuestionMarks(q, paperType);
    if (!res.isValid) {
      errors.push(res);
    }
  }
  return errors;
}

/**
 * Computes an academically honest PaperSummary.
 * - Never treats null/missing marks as 0.
 * - Does not compute full-paper percentage for partially graded papers.
 * - Never uses AI estimates as fallback for official exams.
 */
export function computePaperSummary(
  questions: QuestionAnalysis[],
  paperType: PaperType
): PaperSummary {
  const totalQuestions = questions.length;
  const maxMarks = questions.reduce((acc, q) => acc + (typeof q.maxMarks === "number" ? q.maxMarks : 0), 0);

  if (totalQuestions === 0) {
    return {
      totalQuestions: 0,
      maxMarks: 0,
      gradedQuestionsCount: 0,
      isGradingComplete: false,
      gradedMaxMarks: 0,
      totalTeacherMarks: null,
      totalStudentMarks: null,
      totalAiEstimatedMarks: null,
      percentage: null,
      scoreType: "none",
    };
  }

  // Calculate AI estimates if available (tracked across all paper types)
  const aiGradedQuestions = questions.filter(
    (q) => typeof q.aiEstimatedMarks === "number" && !isNaN(q.aiEstimatedMarks)
  );
  const totalAiEstimatedMarks =
    aiGradedQuestions.length > 0
      ? aiGradedQuestions.reduce((acc, q) => acc + (q.aiEstimatedMarks ?? 0), 0)
      : null;

  if (paperType === "exam") {
    const teacherGraded = questions.filter(
      (q) => typeof q.teacherAwardedMarks === "number" && !isNaN(q.teacherAwardedMarks)
    );
    const gradedCount = teacherGraded.length;

    if (gradedCount === 0) {
      return {
        totalQuestions,
        maxMarks,
        gradedQuestionsCount: 0,
        isGradingComplete: false,
        gradedMaxMarks: 0,
        totalTeacherMarks: null,
        totalStudentMarks: null,
        totalAiEstimatedMarks,
        percentage: null,
        scoreType: "none",
      };
    }

    const totalTeacherMarks = teacherGraded.reduce((acc, q) => acc + (q.teacherAwardedMarks ?? 0), 0);
    const gradedMaxMarks = teacherGraded.reduce((acc, q) => acc + q.maxMarks, 0);
    const isGradingComplete = gradedCount === totalQuestions;

    // Full-paper percentage is ONLY computed when all questions are graded
    const percentage =
      isGradingComplete && maxMarks > 0
        ? Math.round((totalTeacherMarks / maxMarks) * 100)
        : null;

    return {
      totalQuestions,
      maxMarks,
      gradedQuestionsCount: gradedCount,
      isGradingComplete,
      gradedMaxMarks,
      totalTeacherMarks,
      totalStudentMarks: null,
      totalAiEstimatedMarks,
      percentage,
      scoreType: "teacher",
    };
  }

  // Practice paper marking
  const studentGraded = questions.filter(
    (q) => typeof q.studentEnteredMarks === "number" && !isNaN(q.studentEnteredMarks)
  );
  const studentGradedCount = studentGraded.length;

  if (studentGradedCount > 0) {
    const totalStudentMarks = studentGraded.reduce((acc, q) => acc + (q.studentEnteredMarks ?? 0), 0);
    const gradedMaxMarks = studentGraded.reduce((acc, q) => acc + q.maxMarks, 0);
    const isGradingComplete = studentGradedCount === totalQuestions;
    const percentage =
      isGradingComplete && maxMarks > 0
        ? Math.round((totalStudentMarks / maxMarks) * 100)
        : null;

    return {
      totalQuestions,
      maxMarks,
      gradedQuestionsCount: studentGradedCount,
      isGradingComplete,
      gradedMaxMarks,
      totalTeacherMarks: null,
      totalStudentMarks,
      totalAiEstimatedMarks,
      percentage,
      scoreType: "student",
    };
  }

  // No student marks entered: check if complete AI estimates are available for practice
  if (aiGradedQuestions.length === totalQuestions && totalQuestions > 0 && maxMarks > 0) {
    const percentage =
      totalAiEstimatedMarks !== null ? Math.round((totalAiEstimatedMarks / maxMarks) * 100) : null;

    return {
      totalQuestions,
      maxMarks,
      gradedQuestionsCount: totalQuestions,
      isGradingComplete: true,
      gradedMaxMarks: maxMarks,
      totalTeacherMarks: null,
      totalStudentMarks: null,
      totalAiEstimatedMarks,
      percentage,
      scoreType: "ai",
    };
  }

  // Unassessed / partially assessed practice paper
  return {
    totalQuestions,
    maxMarks,
    gradedQuestionsCount: 0,
    isGradingComplete: false,
    gradedMaxMarks: 0,
    totalTeacherMarks: null,
    totalStudentMarks: null,
    totalAiEstimatedMarks,
    percentage: null,
    scoreType: "none",
  };
}

export interface ScoreDisplay {
  badgeText: string;
  detailText: string;
  subText: string;
  statusText: string;
  scoreType: PaperScoreType;
  isComplete: boolean;
  isPartial: boolean;
  isPending: boolean;
  color?: string;
}

/**
 * Returns user-facing score labels and status for cards and detail views.
 */
export function formatPaperScoreDisplay(
  summary: PaperSummary,
  paperType: PaperType
): ScoreDisplay {
  const isComplete = Boolean(summary.isGradingComplete && summary.percentage !== null);
  const isPartial = Boolean(
    !summary.isGradingComplete &&
      typeof summary.gradedQuestionsCount === "number" &&
      summary.gradedQuestionsCount > 0
  );
  const isPending = !isComplete && !isPartial;
  const scoreType: PaperScoreType = summary.scoreType ?? "none";

  if (paperType === "exam") {
    if (isComplete) {
      const detailText = `Teacher: ${summary.totalTeacherMarks}/${summary.maxMarks} (Official)`;
      return {
        badgeText: `${summary.percentage}%`,
        detailText,
        subText: detailText,
        statusText: "Graded",
        scoreType,
        isComplete: true,
        isPartial: false,
        isPending: false,
      };
    }
    if (isPartial) {
      const detailText = `Graded ${summary.gradedQuestionsCount}/${summary.totalQuestions} qs (${summary.totalTeacherMarks}/${summary.gradedMaxMarks} marks)`;
      return {
        badgeText: "Partial",
        detailText,
        subText: detailText,
        statusText: `Partial (${summary.gradedQuestionsCount}/${summary.totalQuestions})`,
        scoreType,
        isComplete: false,
        isPartial: true,
        isPending: false,
      };
    }
    const detailText =
      summary.totalAiEstimatedMarks !== null
        ? `AI Est: ${summary.totalAiEstimatedMarks}/${summary.maxMarks} (Formative only)`
        : `${summary.totalQuestions} questions`;
    return {
      badgeText: "Grading pending",
      detailText,
      subText: detailText,
      statusText: "Grading pending",
      scoreType,
      isComplete: false,
      isPartial: false,
      isPending,
    };
  }

  // Practice paper
  if (summary.scoreType === "student" && isComplete) {
    const detailText = `Self-marked: ${summary.totalStudentMarks}/${summary.maxMarks}`;
    return {
      badgeText: `${summary.percentage}%`,
      detailText,
      subText: detailText,
      statusText: "Self-assessed",
      scoreType,
      isComplete: true,
      isPartial: false,
      isPending: false,
    };
  }

  if (summary.scoreType === "student" && isPartial) {
    const detailText = `Self-marked ${summary.gradedQuestionsCount}/${summary.totalQuestions} qs (${summary.totalStudentMarks}/${summary.gradedMaxMarks} marks)`;
    return {
      badgeText: "Partial",
      detailText,
      subText: detailText,
      statusText: `Partial (${summary.gradedQuestionsCount}/${summary.totalQuestions})`,
      scoreType,
      isComplete: false,
      isPartial: true,
      isPending: false,
    };
  }

  if (summary.scoreType === "ai" && isComplete) {
    const detailText = `AI Estimate: ${summary.totalAiEstimatedMarks}/${summary.maxMarks}`;
    return {
      badgeText: `${summary.percentage}%`,
      detailText,
      subText: detailText,
      statusText: "AI Assessed",
      scoreType,
      isComplete: true,
      isPartial: false,
      isPending: false,
    };
  }

  const detailText = `${summary.totalQuestions} questions`;
  return {
    badgeText: "Unmarked",
    detailText,
    subText: detailText,
    statusText: "Unmarked",
    scoreType,
    isComplete: false,
    isPartial: false,
    isPending,
  };
}
