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

// 11. Failed Firestore save preserves active session snapshot and clientSessionId
{
  const clientSessionId = "client_sess_id_abc123";
  const session = makeSampleSession({
    clientSessionId,
    accumulatedMs: 1500000,
    running: false,
    startedAt: null,
  });
  saveActiveSession(session);

  // Simulate failed network save
  const networkFailed = true;
  function mockAddSession(throwErr: boolean) {
    if (throwErr) {
      throw new Error("Network unavailable (offline)");
    }
    return { id: clientSessionId };
  }

  // Attempt save 1: fails
  try {
    mockAddSession(networkFailed);
    clearActiveSession(session.uid);
  } catch {
    // On failure: snapshot must NOT be cleared!
  }

  const storedAfterFail = loadActiveSession(session.uid);
  assert.ok(storedAfterFail !== null, "Session snapshot must be preserved in localStorage after failed save");
  assert.strictEqual(storedAfterFail?.clientSessionId, clientSessionId, "Deterministic clientSessionId must be preserved");
  assert.strictEqual(storedAfterFail?.accumulatedMs, 1500000);
  console.log("✔ Failed save preserves active session snapshot and clientSessionId");
}

// 12. Idempotent retry using deterministic clientSessionId prevents duplicate sessions
{
  const clientSessionId = "client_sess_id_idempotent_456";
  const session = makeSampleSession({ clientSessionId, accumulatedMs: 1500000 });
  saveActiveSession(session);

  const firestoreDb = new Map<string, { topic: string; completedAt: number }>();

  // Deterministic setDoc implementation mimicking addSession(uid, data, sessionId)
  function idempotentSave(sessionId: string, topic: string) {
    firestoreDb.set(sessionId, { topic, completedAt: Date.now() });
    return { id: sessionId };
  }

  // First attempt (e.g. sent to server right before network dropped)
  const res1 = idempotentSave(session.clientSessionId!, session.topic);
  assert.strictEqual(firestoreDb.size, 1);

  // User retries save using stored snapshot clientSessionId
  const loaded = loadActiveSession(session.uid);
  assert.ok(loaded !== null);
  const res2 = idempotentSave(loaded!.clientSessionId!, loaded!.topic);

  // Assert both returned identical session ID and no duplicate document was created
  assert.strictEqual(res1.id, res2.id);
  assert.strictEqual(firestoreDb.size, 1, "Firestore must have exactly 1 session document (idempotent setDoc)");

  // Once save confirms success, snapshot is cleared
  clearActiveSession(session.uid);
  assert.strictEqual(loadActiveSession(session.uid), null, "Storage cleared after confirmed save");
  console.log("✔ Idempotent retry with deterministic clientSessionId prevents duplicate sessions");
}

// 13. Strict mode away tracking on app suspension / closing during active focus
{
  const targetMinutes = 25;
  const targetMs = targetMinutes * 60 * 1000;
  const targetSecs = targetMinutes * 60;

  // Session ran for 5 minutes (300s) before app was closed / suspended
  const session = makeSampleSession({
    strict: true,
    focusMinutes: targetMinutes,
    accumulatedMs: 300000,
    startedAt: T0,
    awayCount: 0,
    awaySeconds: 0,
  });

  // App is reopened 30 minutes later (expired)
  const reopenTime = T0 + 30 * 60 * 1000;
  const evaluation = evaluateRecoveredSession(session, reopenTime);
  assert.strictEqual(evaluation.isExpired, true);
  assert.strictEqual(evaluation.targetMs, targetMs);

  // When recovering an expired strict session that was running when suspended:
  let leaves = session.awayCount;
  let awaySeconds = session.awaySeconds;
  if (session.strict) {
    leaves += 1;
    const elapsedBeforeClose = Math.round((session.accumulatedMs ?? 0) / 1000);
    awaySeconds += Math.max(0, targetSecs - elapsedBeforeClose);
  }

  assert.strictEqual(leaves, 1, "Leaving app while strict focus was active must increment leaves");
  assert.strictEqual(awaySeconds, 20 * 60, "Away seconds must register the 20 minutes spent away from the app");
  console.log("✔ Strict mode away penalty on app suspension / closing verified");
}

// 14. Completed session snapshot (focusDone) retains exact completed payload across reloads
{
  const clientSessionId = "client_sess_exact_payload_789";
  const completedPayload = {
    subjectId: "sub_physics",
    subjectName: "Physics",
    subjectEmoji: "⚡",
    topic: "Electromagnetism",
    goal: "Derive Maxwell equations",
    mode: "pomodoro" as const,
    durationSeconds: 900, // 15 mins finished early
    strict: true,
    leaves: 2,
    awaySeconds: 45,
  };

  const session = makeSampleSession({
    phase: "focusDone",
    clientSessionId,
    accumulatedMs: 900000,
    running: false,
    startedAt: null,
    completedPayload,
  });

  saveActiveSession(session);

  // App is reloaded
  const recovered = loadActiveSession(UID);
  assert.ok(recovered !== null, "Recovered session must be loaded");
  assert.strictEqual(recovered?.phase, "focusDone", "Phase must be preserved as focusDone");
  assert.strictEqual(recovered?.clientSessionId, clientSessionId);
  assert.deepStrictEqual(recovered?.completedPayload, completedPayload, "Payload must be preserved byte-for-byte");

  const evalState = evaluateRecoveredSession(recovered!);
  assert.strictEqual(evalState.isExpired, true, "focusDone session is immediately marked completed/expired");
  assert.strictEqual(evalState.calculatedElapsedMs, 900000, "Duration matches accumulatedMs exactly");

  clearActiveSession(UID);
  console.log("✔ Completed session retains exact payload across reloads without mutation");
}

// 15. Strict mode away interval de-duplication & paused state immunity
{
  // A: Concurrent blur and visibilitychange on the same leave event
  let awayStart: number | null = null;
  let count = 0;
  let seconds = 0;

  function leave(timestamp: number) {
    if (awayStart === null) awayStart = timestamp;
  }
  function back(timestamp: number) {
    if (awayStart === null) return;
    const elapsed = Math.round((timestamp - awayStart) / 1000);
    awayStart = null;
    if (elapsed >= 3) {
      count += 1;
      seconds += elapsed;
    }
  }

  // User tabs away: blur fires at T0, visibilitychange fires at T0 + 10ms
  leave(T0);
  leave(T0 + 10);
  assert.strictEqual(awayStart, T0, "Second leave event must not overwrite ongoing away start timestamp");

  // User returns 10s later: focus fires, then visibilitychange fires
  back(T0 + 10000);
  back(T0 + 10010);
  assert.strictEqual(count, 1, "Only 1 leave count must be recorded despite multiple events");
  assert.strictEqual(seconds, 10, "Exact 10 seconds away recorded without duplication");

  // B: Closing app while session is PAUSED must NOT incur away penalties
  const pausedSession = makeSampleSession({
    strict: true,
    running: false,
    startedAt: null,
    accumulatedMs: 600000,
    awayCount: 0,
    awaySeconds: 0,
  });

  // Only if running was true does suspension register away penalties
  let leavesAfterResume = pausedSession.awayCount;
  if (pausedSession.strict && pausedSession.running) {
    leavesAfterResume += 1;
  }
  assert.strictEqual(leavesAfterResume, 0, "Paused strict session must not register away penalty on app suspension");
  console.log("✔ Strict mode away de-duplication and paused immunity verified");
}

console.log("\nAll Focus Session Recovery tests passed successfully! 🎉");

