const assert = {
  strictEqual<T>(actual: T, expected: T, message?: string) {
    if (actual !== expected) {
      throw new Error(`${message ?? "Assertion failed"}: expected ${expected}, got ${actual}`);
    }
  },
};
import {
  computeSessionWeekOverlap,
  computeSubjectGoals,
  formatStudyTime,
  formatTargetHours,
  getLocalWeekRange,
} from "./goals.ts";
import type { FocusSession, SessionMode, Subject, SubjectGoal } from "../types";
import type { Timestamp } from "firebase/firestore";

const mockTimestamp = (iso: string): Timestamp =>
  ({ toDate: () => new Date(iso) }) as unknown as Timestamp;

console.log("Running Subject Goals logic tests...");

// 1. Test getLocalWeekRange
// Using a fixed reference date: Wednesday, Oct 15, 2026
const wednesday = new Date("2026-10-15T14:30:00");
const range = getLocalWeekRange(wednesday);

assert.strictEqual(range.start.getDay(), 1, "Week start must be Monday");
assert.strictEqual(range.start.getHours(), 0, "Week start must be 00:00:00");
assert.strictEqual(range.start.getMinutes(), 0);
assert.strictEqual(range.end.getDay(), 0, "Week end must be Sunday");
assert.strictEqual(range.end.getHours(), 23, "Week end must be 23:59:59.999");
assert.strictEqual(range.startKey, "2026-10-12", "Monday should be 2026-10-12");
assert.strictEqual(range.endKey, "2026-10-18", "Sunday should be 2026-10-18");
console.log("✔ getLocalWeekRange passed (Mon 2026-10-12 to Sun 2026-10-18)");

// 2. Test computeSessionWeekOverlap
// A) Session completely inside week (e.g. 1 hour on Wednesday)
const sessionInside: FocusSession = {
  id: "s1",
  subjectId: "sub1",
  subjectName: "Math",
  subjectEmoji: "📐",
  topic: "Algebra",
  goal: "",
  mode: "timer",
  durationSeconds: 3600,
  completedAt: mockTimestamp("2026-10-15T15:00:00"),
};
assert.strictEqual(
  computeSessionWeekOverlap(sessionInside, range.start, range.end),
  3600,
  "Entire duration should be counted when inside week"
);

// B) Session crossing Sunday midnight into Monday of this week!
// Started at Sunday 23:40 (previous week) and ended at Monday 00:20 (40 mins = 2400s)
// Only 20 minutes (1200s) should fall in this week!
const sessionCrossingIn: FocusSession = {
  id: "s2",
  subjectId: "sub1",
  subjectName: "Math",
  subjectEmoji: "📐",
  topic: "Midnight study",
  goal: "",
  mode: "timer",
  durationSeconds: 2400,
  completedAt: mockTimestamp("2026-10-12T00:20:00"), // Monday 00:20
};
assert.strictEqual(
  computeSessionWeekOverlap(sessionCrossingIn, range.start, range.end),
  1200,
  "Only 1200 seconds (Monday portion) should be counted"
);

// C) Session crossing Sunday midnight out of this week into next week
// Started Sunday 23:50 and ended next Monday 00:10 (20 mins = 1200s)
// 10 minutes (600s) should fall in this week!
const sessionCrossingOut: FocusSession = {
  id: "s3",
  subjectId: "sub1",
  subjectName: "Math",
  subjectEmoji: "📐",
  topic: "Late Sunday study",
  goal: "",
  mode: "timer",
  durationSeconds: 1200,
  completedAt: mockTimestamp("2026-10-19T00:10:00"), // Next Monday 00:10
};
assert.strictEqual(
  computeSessionWeekOverlap(sessionCrossingOut, range.start, range.end),
  600,
  "Only 600 seconds (Sunday portion) should be counted"
);

// D) Break session exclusion
const breakSession: FocusSession = {
  id: "s4",
  subjectId: "sub1",
  subjectName: "Math",
  subjectEmoji: "📐",
  topic: "",
  goal: "",
  mode: "break" as unknown as SessionMode,
  durationSeconds: 300,
  completedAt: mockTimestamp("2026-10-15T15:00:00"),
};
assert.strictEqual(
  computeSessionWeekOverlap(breakSession, range.start, range.end),
  0,
  "Breaks must be completely excluded"
);
console.log("✔ computeSessionWeekOverlap boundary & break tests passed");

// 3. Test formatting
assert.strictEqual(formatStudyTime(0), "0h");
assert.strictEqual(formatStudyTime(1800), "30m");
assert.strictEqual(formatStudyTime(3600), "1h");
assert.strictEqual(formatStudyTime(5400), "1h 30m");
assert.strictEqual(formatTargetHours(5), "5h");
assert.strictEqual(formatTargetHours(2.5), "2.5h");
console.log("✔ formatStudyTime and formatTargetHours passed");

// 4. Test computeSubjectGoals with edge cases:
// - Duplicate sessions
// - Subject with 0 sessions
// - Deleted subject with orphaned goal
const subjects: Subject[] = [
  { id: "sub1", name: "Math", emoji: "📐", color: "#ffd6c2" },
  { id: "sub2", name: "Physics", emoji: "⚡", color: "#d4f1d9" },
  { id: "sub3", name: "Chemistry", emoji: "🧪", color: "#ffe9a8" },
];

const goals: SubjectGoal[] = [
  { id: "sub1", subjectId: "sub1", targetHours: 5 }, // 5h target
  { id: "sub2", subjectId: "sub2", targetHours: 2 }, // 2h target
  { id: "deleted_sub", subjectId: "deleted_sub", targetHours: 10 }, // orphaned goal for deleted subject
];

// Sessions with duplicate ID test
const sessions: FocusSession[] = [
  sessionInside, // Math: 3600s (1h)
  sessionInside, // duplicate of s1 - must be deduplicated!
  sessionCrossingIn, // Math: 1200s (20m) -> total Math = 4800s (1h 20m)
  // Physics has 0 sessions
];

const result = computeSubjectGoals(subjects, goals, sessions, wednesday);

assert.strictEqual(result.progressList.length, 2, "Deleted subject goal should be safely excluded");
assert.strictEqual(result.unconfiguredSubjects.length, 1, "Chemistry should be unconfigured");
assert.strictEqual(result.unconfiguredSubjects[0].id, "sub3");

const mathProgress = result.progressList.find((p) => p.subject.id === "sub1")!;
assert.strictEqual(mathProgress.targetHours, 5);
assert.strictEqual(mathProgress.targetSeconds, 18000);
assert.strictEqual(mathProgress.actualSeconds, 4800, "Math actual must be 4800s (deduplicated)");
assert.strictEqual(mathProgress.remainingSeconds, 13200);
assert.strictEqual(mathProgress.progressPercent, 27); // 4800 / 18000 = 26.66% -> 27%
assert.strictEqual(mathProgress.isAchieved, false);

const physicsProgress = result.progressList.find((p) => p.subject.id === "sub2")!;
assert.strictEqual(physicsProgress.actualSeconds, 0, "Physics has 0 sessions");
assert.strictEqual(physicsProgress.remainingSeconds, 7200);
assert.strictEqual(physicsProgress.progressPercent, 0);

assert.strictEqual(result.summary.totalTargetHours, 7);
assert.strictEqual(result.summary.totalActualSeconds, 4800);
assert.strictEqual(result.summary.goalsCount, 2);
assert.strictEqual(result.summary.achievedCount, 0);

console.log("✔ computeSubjectGoals full pipeline tests passed!");
