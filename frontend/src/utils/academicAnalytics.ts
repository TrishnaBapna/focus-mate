import type { Paper, PaperMistakeTag } from "../types/paper.ts";

export interface AcademicKpis {
  examAverage: number | null;
  gradedExamsCount: number;
  totalExamsCount: number;
  practiceAverage: number | null;
  scoredPracticeCount: number;
  totalPracticeCount: number;
  totalPapers: number;
  totalQuestionsAnalyzed: number;
  totalActionItems: number;
  completedActionItems: number;
  actionCompletionRate: number; // 0 to 100
}

export interface MistakeCategoryStat {
  tag: PaperMistakeTag;
  label: string;
  count: number;
  percentage: number; // 0 to 100
  color: string;
  description: string;
}

export interface SubjectAcademicStat {
  subjectId: string;
  name: string;
  emoji: string;
  examAverage: number | null;
  gradedExamsCount: number;
  practiceAverage: number | null;
  scoredPracticeCount: number;
  totalPapers: number;
  topMistakeTag: PaperMistakeTag | null;
  topMistakeLabel: string | null;
}

export interface PaperTimelinePoint {
  id: string;
  title: string;
  date: string;
  paperType: "exam" | "practice";
  percentage: number | null;
  scoreDisplay: string;
  isOfficial: boolean;
}

export interface UnifiedTopicMistakeStat {
  topic: string;
  subjectName?: string;
  totalQuestions: number;
  marksEarned: number;
  maxMarks: number;
  accuracy: number; // 0 to 100
  needsAttention: boolean;
  topMistakeTag: PaperMistakeTag | null;
}

export const MISTAKE_METADATA: Record<
  PaperMistakeTag,
  { label: string; color: string; description: string }
> = {
  calculation: {
    label: "Calculation Error",
    color: "#f59e0b",
    description: "Arithmetic slips, sign mistakes, or formula substitution errors.",
  },
  conceptual: {
    label: "Conceptual Gap",
    color: "#ef4444",
    description: "Misunderstanding underlying theory, definitions, or principles.",
  },
  misread_question: {
    label: "Misread Question",
    color: "#8b5cf6",
    description: "Overlooking units, constraints, or what the question specifically asked for.",
  },
  incomplete: {
    label: "Incomplete Answer",
    color: "#06b6d4",
    description: "Missing steps, skipped sub-parts, or lack of required justification.",
  },
  time_pressure: {
    label: "Time Pressure",
    color: "#ec4899",
    description: "Rushed handwriting, unfinished calculations, or skipped sections.",
  },
  other: {
    label: "Other Mistake",
    color: "#6b7280",
    description: "Formatting, ambiguous wording, or uncategorized slips.",
  },
};

/**
 * Computes high-level academic KPIs across papers, exams, and assessments.
 * Ensures official exams and practice estimates are never merged into one fabricated score.
 */
export function computeAcademicKpis(papers: Paper[]): AcademicKpis {
  const totalPapers = papers.length;
  const examPapers = papers.filter((p) => p.paperType === "exam");
  const practicePapers = papers.filter((p) => p.paperType === "practice");

  // Official exams with verified teacher marks and completed percentage
  const gradedExams = examPapers.filter(
    (p) =>
      typeof p.summary?.percentage === "number" &&
      p.summary.percentage !== null &&
      (p.summary.scoreType === "teacher" ||
        (typeof p.summary.totalTeacherMarks === "number" && p.summary.totalTeacherMarks !== null))
  );

  const examAverage =
    gradedExams.length > 0
      ? Math.round(
          gradedExams.reduce((sum, p) => sum + (p.summary.percentage ?? 0), 0) /
            gradedExams.length
        )
      : null;

  // Scored practice papers (self-marked or AI-estimated)
  const scoredPractice = practicePapers.filter(
    (p) => typeof p.summary?.percentage === "number" && p.summary.percentage !== null
  );

  const practiceAverage =
    scoredPractice.length > 0
      ? Math.round(
          scoredPractice.reduce((sum, p) => sum + (p.summary.percentage ?? 0), 0) /
            scoredPractice.length
        )
      : null;

  const totalQuestionsAnalyzed = papers.reduce(
    (sum, p) => sum + (p.questions?.length ?? p.summary?.totalQuestions ?? 0),
    0
  );

  let totalActionItems = 0;
  let completedActionItems = 0;

  for (const p of papers) {
    if (Array.isArray(p.actionPlan)) {
      totalActionItems += p.actionPlan.length;
      completedActionItems += p.actionPlan.filter((a) => a.completed).length;
    }
  }

  const actionCompletionRate =
    totalActionItems > 0
      ? Math.round((completedActionItems / totalActionItems) * 100)
      : 0;

  return {
    examAverage,
    gradedExamsCount: gradedExams.length,
    totalExamsCount: examPapers.length,
    practiceAverage,
    scoredPracticeCount: scoredPractice.length,
    totalPracticeCount: practicePapers.length,
    totalPapers,
    totalQuestionsAnalyzed,
    totalActionItems,
    completedActionItems,
    actionCompletionRate,
  };
}

/**
 * Aggregates mistake tags across all analyzed paper questions.
 * Answers the student's core question: "Why and where am I losing marks?"
 */
export function computeMistakeDistribution(papers: Paper[]): MistakeCategoryStat[] {
  const counts: Record<PaperMistakeTag, number> = {
    conceptual: 0,
    calculation: 0,
    misread_question: 0,
    incomplete: 0,
    time_pressure: 0,
    other: 0,
  };

  let totalTagged = 0;

  for (const p of papers) {
    if (!Array.isArray(p.questions)) continue;
    for (const q of p.questions) {
      if (q.mistakeTag && q.mistakeTag in counts) {
        counts[q.mistakeTag]++;
        totalTagged++;
      }
    }
  }

  const tags: PaperMistakeTag[] = [
    "calculation",
    "conceptual",
    "misread_question",
    "incomplete",
    "time_pressure",
    "other",
  ];

  return tags
    .map((tag) => {
      const meta = MISTAKE_METADATA[tag];
      const count = counts[tag];
      const percentage = totalTagged > 0 ? Math.round((count / totalTagged) * 100) : 0;
      return {
        tag,
        label: meta.label,
        count,
        percentage,
        color: meta.color,
        description: meta.description,
      };
    })
    .filter((stat) => stat.count > 0)
    .sort((a, b) => b.count - a.count);
}

/**
 * Groups academic metrics by subject, showing exam and practice averages per subject.
 */
export function computeSubjectAcademicBreakdown(
  papers: Paper[],
  knownSubjects: { id: string; name: string; emoji?: string }[] = []
): SubjectAcademicStat[] {
  const subjectMap = new Map<
    string,
    {
      subjectId: string;
      name: string;
      emoji: string;
      examScores: number[];
      practiceScores: number[];
      papersCount: number;
      mistakeCounts: Record<PaperMistakeTag, number>;
    }
  >();

  // Pre-populate with known subjects
  for (const s of knownSubjects) {
    subjectMap.set(s.id, {
      subjectId: s.id,
      name: s.name,
      emoji: s.emoji || "📚",
      examScores: [],
      practiceScores: [],
      papersCount: 0,
      mistakeCounts: {
        conceptual: 0,
        calculation: 0,
        misread_question: 0,
        incomplete: 0,
        time_pressure: 0,
        other: 0,
      },
    });
  }

  for (const p of papers) {
    const key = p.subjectId || "general";
    let entry = subjectMap.get(key);
    if (!entry) {
      entry = {
        subjectId: key,
        name: p.subjectName || (key === "general" ? "General / Unassigned" : "Other Subject"),
        emoji: p.subjectEmoji || "📄",
        examScores: [],
        practiceScores: [],
        papersCount: 0,
        mistakeCounts: {
          conceptual: 0,
          calculation: 0,
          misread_question: 0,
          incomplete: 0,
          time_pressure: 0,
          other: 0,
        },
      };
      subjectMap.set(key, entry);
    }

    entry.papersCount++;

    if (typeof p.summary?.percentage === "number" && p.summary.percentage !== null) {
      if (
        p.paperType === "exam" &&
        (p.summary.scoreType === "teacher" || p.summary.totalTeacherMarks != null)
      ) {
        entry.examScores.push(p.summary.percentage);
      } else if (p.paperType === "practice") {
        entry.practiceScores.push(p.summary.percentage);
      }
    }

    if (Array.isArray(p.questions)) {
      for (const q of p.questions) {
        if (q.mistakeTag && q.mistakeTag in entry.mistakeCounts) {
          entry.mistakeCounts[q.mistakeTag]++;
        }
      }
    }
  }

  const results: SubjectAcademicStat[] = [];

  for (const [, entry] of subjectMap) {
    if (entry.papersCount === 0 && entry.examScores.length === 0 && entry.practiceScores.length === 0) {
      continue;
    }

    const examAverage =
      entry.examScores.length > 0
        ? Math.round(entry.examScores.reduce((a, b) => a + b, 0) / entry.examScores.length)
        : null;

    const practiceAverage =
      entry.practiceScores.length > 0
        ? Math.round(
            entry.practiceScores.reduce((a, b) => a + b, 0) / entry.practiceScores.length
          )
        : null;

    // Find top mistake
    let topTag: PaperMistakeTag | null = null;
    let maxMistakes = 0;
    for (const [t, c] of Object.entries(entry.mistakeCounts)) {
      if (c > maxMistakes) {
        maxMistakes = c;
        topTag = t as PaperMistakeTag;
      }
    }

    results.push({
      subjectId: entry.subjectId,
      name: entry.name,
      emoji: entry.emoji,
      examAverage,
      gradedExamsCount: entry.examScores.length,
      practiceAverage,
      scoredPracticeCount: entry.practiceScores.length,
      totalPapers: entry.papersCount,
      topMistakeTag: topTag,
      topMistakeLabel: topTag ? MISTAKE_METADATA[topTag]?.label : null,
    });
  }

  return results.sort((a, b) => b.totalPapers - a.totalPapers);
}

/**
 * Builds chronological timeline points for visualizing paper progress.
 */
export function computePaperScoreTimeline(papers: Paper[]): PaperTimelinePoint[] {
  const scored = papers.filter(
    (p) => typeof p.summary?.percentage === "number" && p.summary.percentage !== null
  );

  return scored
    .map((p) => {
      const isOfficial =
        p.paperType === "exam" &&
        (p.summary.scoreType === "teacher" || p.summary.totalTeacherMarks != null);

      return {
        id: p.id,
        title: p.title,
        date: p.date,
        paperType: p.paperType,
        percentage: p.summary?.percentage ?? null,
        scoreDisplay: isOfficial
          ? `${p.summary.percentage}% (Official Exam)`
          : `${p.summary.percentage}% (Practice)`,
        isOfficial,
      };
    })
    .sort((a, b) => a.date.localeCompare(b.date));
}

/**
 * Gathers topic accuracy and mistake tags from paper question analyses.
 * Highlights topics needing revision (< 65% accuracy).
 */
export function computeTopicMasteryFromPapers(papers: Paper[]): UnifiedTopicMistakeStat[] {
  const topicMap = new Map<
    string,
    {
      topic: string;
      subjectName?: string;
      totalQuestions: number;
      marksEarned: number;
      maxMarks: number;
      mistakes: Record<PaperMistakeTag, number>;
    }
  >();

  for (const p of papers) {
    if (!Array.isArray(p.questions)) continue;
    for (const q of p.questions) {
      const rawTopic = (q.topic || "").trim();
      if (!rawTopic) continue;

      const key = `${p.subjectId || "gen"}::${rawTopic.toLowerCase()}`;
      let entry = topicMap.get(key);
      if (!entry) {
        entry = {
          topic: rawTopic,
          subjectName: p.subjectName,
          totalQuestions: 0,
          marksEarned: 0,
          maxMarks: 0,
          mistakes: {
            conceptual: 0,
            calculation: 0,
            misread_question: 0,
            incomplete: 0,
            time_pressure: 0,
            other: 0,
          },
        };
        topicMap.set(key, entry);
      }

      entry.totalQuestions++;
      entry.maxMarks += q.maxMarks || 0;

      const earned =
        p.paperType === "exam"
          ? (typeof q.teacherAwardedMarks === "number" ? q.teacherAwardedMarks : 0)
          : (typeof q.studentEnteredMarks === "number"
              ? q.studentEnteredMarks
              : typeof q.aiEstimatedMarks === "number"
              ? q.aiEstimatedMarks
              : 0);
      entry.marksEarned += earned;

      if (q.mistakeTag && q.mistakeTag in entry.mistakes) {
        entry.mistakes[q.mistakeTag]++;
      }
    }
  }

  const results: UnifiedTopicMistakeStat[] = [];

  for (const [, entry] of topicMap) {
    const accuracy =
      entry.maxMarks > 0 ? Math.round((entry.marksEarned / entry.maxMarks) * 100) : 0;

    let topTag: PaperMistakeTag | null = null;
    let maxM = 0;
    for (const [t, c] of Object.entries(entry.mistakes)) {
      if (c > maxM) {
        maxM = c;
        topTag = t as PaperMistakeTag;
      }
    }

    results.push({
      topic: entry.topic,
      subjectName: entry.subjectName,
      totalQuestions: entry.totalQuestions,
      marksEarned: entry.marksEarned,
      maxMarks: entry.maxMarks,
      accuracy,
      needsAttention: accuracy < 65,
      topMistakeTag: topTag,
    });
  }

  return results.sort((a, b) => a.accuracy - b.accuracy);
}
