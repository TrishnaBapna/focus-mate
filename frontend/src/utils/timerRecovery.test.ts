import {
  clearActiveSession,
  evaluateRecoveredSession,
  getStorageKey,
  isValidStoredSession,
  loadActiveSession,
  MAX_SESSION_AGE_MS,
  RECOVERY_VERSION,
  saveActiveSession,
  type StoredFocusSession,
} from "./timerRecovery.ts";

const assert = {
  strictEqual<T>(actual: T, expected: T, message?: string) {
    if (actual !== expected) {
      throw new Error(`${message ?? "Assertion failed"}: expected ${expected}, got ${actual}`);
    }
  },
  deepStrictEqual<T>(actual: T, expected: T, message?: string) {
    const a = JSON.stringify(actual);
    const b = JSON.stringify(expected);
    if (a !== b) {
      throw new Error(`${message ?? "Assertion failed"}: expected ${b}, got ${a}`);
    }
  },
  ok(value: unknown, message?: string) {
    if (!value) {
      throw new Error(message ?? "Expected truthy value");
    }
  },
};

// Polyfill window & localStorage if running in Node.js CLI
if (typeof window === "undefined") {
  const store = new Map<string, string>();
  const mockLocalStorage = {
    getItem: (k: string) => store.get(k) ?? null,
    setItem: (k: string, v: string) => store.set(k, String(v)),
    removeItem: (k: string) => store.delete(k),
    clear: () => store.clear(),
  };
  (globalThis as unknown as { window: unknown }).window = { localStorage: mockLocalStorage };
}

console.log("Running Focus Session Recovery automated tests...");

const UID = "test_user_42";
const T0 = Date.now(); // Base timestamp

function makeSampleSession(overrides: Partial<StoredFocusSession> = {}): StoredFocusSession {
  return {
    version: RECOVERY_VERSION,
    uid: UID,
    phase: "focus",
    mode: "pomodoro",
    subjectId: "sub_math",
    subjectName: "Math",
    subjectEmoji: "📐",
    topic: "Calculus",
    goal: "Finish integration problems",
    focusMinutes: 25,
    breakMinutes: 5,
    strict: false,
    running: true,
    startedAt: T0,
    accumulatedMs: 0,
    savedAt: T0,
    awayCount: 0,
    awaySeconds: 0,
    ...overrides,
  };
}

// 1. Refresh during an active timer (trustworthy timestamp delta math)
{
  const session = makeSampleSession();
  const reloadTime = T0 + 5 * 60 * 1000; // 5 minutes (300,000 ms) later
  const res = evaluateRecoveredSession(session, reloadTime);

  assert.strictEqual(res.isExpired, false, "5 minutes into 25 min timer is not expired");
  assert.strictEqual(res.calculatedElapsedMs, 300000, "Calculated elapsed should be exactly 5 minutes");
  assert.strictEqual(res.targetMs, 1500000, "Target should be 25 minutes");
  console.log("✔ Active timer refresh calculation passed");
}

// 2. Refresh while paused
{
  const session = makeSampleSession({
    running: false,
    startedAt: null,
    accumulatedMs: 600000, // 10 minutes elapsed before pause
    savedAt: T0 + 600000,
  });
  // User reloads 2 hours later
  const reloadTime = T0 + 2 * 60 * 60 * 1000;
  const res = evaluateRecoveredSession(session, reloadTime);

  assert.strictEqual(res.isExpired, false, "Paused timer should not expire based on wall clock");
  assert.strictEqual(res.calculatedElapsedMs, 600000, "Paused timer elapsed must remain exactly 10 minutes");
  console.log("✔ Paused timer refresh calculation passed");
}

// 3. Recovery after device sleeps / tab inactive
{
  // Started running, accumulated 60s, then ran for another 14 mins while device went to sleep
  const session = makeSampleSession({
    accumulatedMs: 60000,
    startedAt: T0,
  });
  const wakeTime = T0 + 14 * 60 * 1000; // 14 mins after resume
  const res = evaluateRecoveredSession(session, wakeTime);

  assert.strictEqual(res.calculatedElapsedMs, 60000 + 14 * 60 * 1000, "Elapsed accurately reflects total wall clock");
  assert.strictEqual(res.isExpired, false);
  console.log("✔ Sleep / inactive tab wakeup calculation passed");
}

// 4. Timer expiry while app is closed
{
  const session = makeSampleSession({
    focusMinutes: 25,
    startedAt: T0,
    accumulatedMs: 0,
  });
  // App reopened 35 minutes later (10 minutes after target expiry)
  const reopenTime = T0 + 35 * 60 * 1000;
  const res = evaluateRecoveredSession(session, reopenTime);

  assert.strictEqual(res.isExpired, true, "Should be flagged as expired");
  assert.strictEqual(res.targetMs, 1500000, "Target is 25 minutes (1,500,000 ms)");
  assert.strictEqual(res.calculatedElapsedMs, 1500000, "Expired session duration is capped to target duration for credit");
  console.log("✔ Expiry while closed calculation passed");
}

// 5. Pomodoro focus-to-break transitions
{
  // In-progress break
  const breakSession = makeSampleSession({
    phase: "break",
    breakMinutes: 5,
    startedAt: T0,
    accumulatedMs: 0,
    running: true,
  });
  const breakReloadTime = T0 + 2 * 60 * 1000; // 2 minutes in
  const res = evaluateRecoveredSession(breakSession, breakReloadTime);

  assert.strictEqual(res.isExpired, false, "Break is still active at 2 minutes");
  assert.strictEqual(res.calculatedElapsedMs, 120000);
  assert.strictEqual(res.targetMs, 300000, "Break target is 5 mins (300,000 ms)");

  // Expired break
  const breakExpiredTime = T0 + 6 * 60 * 1000; // 6 minutes after start
  const expRes = evaluateRecoveredSession(breakSession, breakExpiredTime);
  assert.strictEqual(expRes.isExpired, true, "Break is expired at 6 minutes");
  console.log("✔ Pomodoro focus-to-break transition recovery passed");
}

// 6. Stopwatch recovery
{
  const stopwatchSession = makeSampleSession({
    mode: "stopwatch",
    focusMinutes: 0,
    accumulatedMs: 120000,
    startedAt: T0,
    running: true,
  });
  const reloadTime = T0 + 180000; // 3 minutes later
  const res = evaluateRecoveredSession(stopwatchSession, reloadTime);

  assert.strictEqual(res.targetMs, null, "Stopwatch has no targetMs");
  assert.strictEqual(res.isExpired, false, "Stopwatch never expires automatically");
  assert.strictEqual(res.calculatedElapsedMs, 120000 + 180000, "300,000 ms total elapsed");
  console.log("✔ Stopwatch recovery passed");
}

// 7. Cancellation and storage cleanup
{
  const session = makeSampleSession();
  saveActiveSession(session);
  assert.ok(loadActiveSession(UID) !== null, "Session should be saved in storage");

  clearActiveSession(UID);
  assert.strictEqual(loadActiveSession(UID), null, "Storage should be completely cleared after cancellation");
  console.log("✔ Cancellation and storage cleanup passed");
}

// 8. User logout and multi-user account switching isolation
{
  const aliceUid = "user_alice";
  const bobUid = "user_bob";

  const aliceSession = makeSampleSession({ uid: aliceUid, topic: "Alice's Math" });
  saveActiveSession(aliceSession);

  // Bob should NOT be able to load Alice's active session
  assert.strictEqual(loadActiveSession(bobUid), null, "Bob must not access Alice's session");
  assert.ok(loadActiveSession(aliceUid) !== null, "Alice's session is present");

  // On Alice logout, clear her active session
  clearActiveSession(aliceUid);
  assert.strictEqual(loadActiveSession(aliceUid), null, "Alice's session is cleared on logout");
  assert.strictEqual(loadActiveSession(bobUid), null, "Bob still has null session");
  console.log("✔ User isolation and account switching passed");
}

// 9. Corrupted, stale, and invalid recovery state handling
{
  // A) Storage key format
  assert.strictEqual(getStorageKey("xyz"), "focusmate_active_session_xyz");

  // B) Invalid JSON in localStorage
  window.localStorage.setItem(getStorageKey(UID), "{ corrupted json ");
  assert.strictEqual(loadActiveSession(UID), null, "Invalid JSON should be handled without throwing and return null");
  assert.strictEqual(window.localStorage.getItem(getStorageKey(UID)), null, "Corrupted entry should be pruned");

  // C) Incompatible version
  const wrongVersion = makeSampleSession({ version: 99 as unknown as 1 });
  assert.strictEqual(isValidStoredSession(wrongVersion, UID), false, "Wrong version must be rejected");

  // D) Stale session (> 24 hours old)
  const staleSession = makeSampleSession({
    savedAt: T0 - (MAX_SESSION_AGE_MS + 1000),
  });
  assert.strictEqual(isValidStoredSession(staleSession, UID, T0), false, "Stale session (> 24h) must be rejected");

  // E) Clock backwards skew (> 1 minute)
  const futureSession = makeSampleSession({
    savedAt: T0 + 120000, // saved 2 mins in the future
  });
  assert.strictEqual(isValidStoredSession(futureSession, UID, T0), false, "Excessive clock skew must be rejected");

  // F) Negative durations or invalid numbers
  const badNumbers = makeSampleSession({ focusMinutes: -10 });
  assert.strictEqual(isValidStoredSession(badNumbers, UID, T0), false, "Negative minutes must be rejected");

  console.log("✔ Corrupted and stale session handling passed");
}

// 10. Exactly-once session completion & duplicate prevention
{
  // Simulating the lifecycle of recovering an expired session:
  // Step 1: User returns after session expired while closed
  const session = makeSampleSession({ startedAt: T0 });
  saveActiveSession(session);

  const evaluation = evaluateRecoveredSession(session, T0 + 30 * 60 * 1000); // 30 mins later
  assert.strictEqual(evaluation.isExpired, true);

  // Step 2: During recovery processing, clearActiveSession is executed immediately
  clearActiveSession(session.uid);

  // Step 3: If a subsequent reload occurs or an effect re-runs, storage is already empty
  const reloaded = loadActiveSession(session.uid);
  assert.strictEqual(reloaded, null, "Storage must be empty so session is not submitted twice to Firestore");

  console.log("✔ Exactly-once session completion and duplicate prevention verified");
}

console.log("\nAll Focus Session Recovery tests passed successfully! 🎉");
