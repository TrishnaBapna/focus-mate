import { checkDistributedRateLimit, MAX_REQUESTS_PER_MINUTE, MAX_DAILY_REQUESTS } from "./index";

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

// In-memory Firestore transaction simulator for rigorous unit testing
class MockFirestore {
  private store = new Map<string, any>();
  public shouldFail = false;

  collection(name: string) {
    return {
      doc: (docId: string) => {
        const key = `${name}/${docId}`;
        return {
          path: key,
        };
      },
    };
  }

  async runTransaction<T>(updateFunction: (transaction: any) => Promise<T>): Promise<T> {
    if (this.shouldFail) {
      throw new Error("Simulated Firestore transaction failure or network timeout");
    }

    const transaction = {
      get: async (ref: { path: string }) => {
        const data = this.store.get(ref.path);
        return {
          data: () => (data ? JSON.parse(JSON.stringify(data)) : undefined),
        };
      },
      set: (ref: { path: string }, data: any, options?: { merge?: boolean }) => {
        if (options?.merge && this.store.has(ref.path)) {
          const existing = this.store.get(ref.path);
          this.store.set(ref.path, { ...existing, ...JSON.parse(JSON.stringify(data)) });
        } else {
          this.store.set(ref.path, JSON.parse(JSON.stringify(data)));
        }
      },
    };

    return await updateFunction(transaction);
  }

  getDoc(key: string) {
    return this.store.get(key);
  }
}

async function runRateLimiterTests() {
  console.log("Running AI Proxy Distributed Rate Limiter & Abuse Control tests...\n");

  // 1. Initial valid request succeeds
  {
    const mockDb = new MockFirestore();
    const uid = "student_alice";
    const res = await checkDistributedRateLimit(uid, true, mockDb as any);
    assert.strictEqual(res.allowed, true, "First request must be allowed");

    const doc = mockDb.getDoc(`systemRateLimits/${uid}`);
    assert.strictEqual(doc.timestamps.length, 1);
    assert.strictEqual(doc.dailyCount, 1);
    console.log("✔ 1. Initial valid request succeeds and creates rate-limit state");
  }

  // 2. Sliding-window limit (15 req/min) enforced for all users
  {
    const mockDb = new MockFirestore();
    const uid = "student_bob";

    // Perform MAX_REQUESTS_PER_MINUTE allowed requests
    for (let i = 0; i < MAX_REQUESTS_PER_MINUTE; i++) {
      const res = await checkDistributedRateLimit(uid, true, mockDb as any);
      assert.strictEqual(res.allowed, true, `Request ${i + 1} should be allowed`);
    }

    // 16th request within the same minute MUST be rejected
    const blockedRes = await checkDistributedRateLimit(uid, true, mockDb as any);
    assert.strictEqual(blockedRes.allowed, false, "Request exceeding 15 req/min must be rejected");
    assert.ok(blockedRes.reason?.includes("wait a minute"));
    console.log("✔ 2. Sliding-window limit (15 req/min) strictly enforced");
  }

  // 3. Sliding-window limit applies equally to BYOK users (abuse prevention)
  {
    const mockDb = new MockFirestore();
    const uid = "student_charlie_byok";

    for (let i = 0; i < MAX_REQUESTS_PER_MINUTE; i++) {
      const res = await checkDistributedRateLimit(uid, false, mockDb as any);
      assert.strictEqual(res.allowed, true, `BYOK request ${i + 1} should be allowed`);
    }

    // 16th BYOK request MUST also be blocked to protect Cloud Functions instances
    const blockedByok = await checkDistributedRateLimit(uid, false, mockDb as any);
    assert.strictEqual(blockedByok.allowed, false, "BYOK requests cannot exceed 15 req/min abuse limit");
    console.log("✔ 3. BYOK requests are strictly constrained by the per-minute abuse limit");
  }

  // 4. Platform daily quota (100 req/day) enforced on platform-funded keys
  {
    const mockDb = new MockFirestore();
    const uid = "student_david_platform";
    const todayKey = new Date().toISOString().slice(0, 10);

    // Pre-populate rate-limit state with 100 daily requests
    const path = `systemRateLimits/${uid}`;
    (mockDb as any).store.set(path, {
      timestamps: [], // empty minute window
      dailyDate: todayKey,
      dailyCount: MAX_DAILY_REQUESTS,
    });

    const res = await checkDistributedRateLimit(uid, true, mockDb as any);
    assert.strictEqual(res.allowed, false, "101st platform request must be blocked by daily quota");
    assert.ok(res.reason?.includes("Daily AI study request limit reached"));
    console.log("✔ 4. Platform daily quota (100 req/day) enforced on platform-funded keys");
  }

  // 5. BYOK requests are exempt from platform daily quota
  {
    const mockDb = new MockFirestore();
    const uid = "student_eve_byok";
    const todayKey = new Date().toISOString().slice(0, 10);

    // Pre-populate with 100 requests already consumed today
    const path = `systemRateLimits/${uid}`;
    (mockDb as any).store.set(path, {
      timestamps: [], // clear minute window
      dailyDate: todayKey,
      dailyCount: MAX_DAILY_REQUESTS,
    });

    // BYOK request must be permitted even when dailyCount >= 100
    const res = await checkDistributedRateLimit(uid, false, mockDb as any);
    assert.strictEqual(res.allowed, true, "BYOK request must bypass platform daily quota");
    console.log("✔ 5. BYOK requests bypass platform daily quota for unlimited practice");
  }

  // 6. Daily quota resets at UTC midnight
  {
    const mockDb = new MockFirestore();
    const uid = "student_frank";
    const yesterday = "2026-10-17"; // simulated yesterday in UTC

    const path = `systemRateLimits/${uid}`;
    (mockDb as any).store.set(path, {
      timestamps: [],
      dailyDate: yesterday,
      dailyCount: MAX_DAILY_REQUESTS, // reached limit yesterday
    });

    // Today's request must reset dailyCount and succeed
    const res = await checkDistributedRateLimit(uid, true, mockDb as any);
    assert.strictEqual(res.allowed, true, "New UTC day must reset daily quota counter");

    const updatedDoc = mockDb.getDoc(path);
    assert.strictEqual(updatedDoc.dailyCount, 1, "Daily count reset to 1 for new day");
    console.log("✔ 6. Daily quota resets deterministically at UTC midnight");
  }

  // 7. Fail-Closed behavior on database / transaction failure for ALL requests
  {
    const mockDb = new MockFirestore();
    mockDb.shouldFail = true; // simulate Firestore outage / transaction conflict

    // Platform request MUST fail closed
    const platformRes = await checkDistributedRateLimit("user_platform", true, mockDb as any);
    assert.strictEqual(platformRes.allowed, false, "Platform request must fail closed on db error");
    assert.ok(platformRes.reason?.includes("temporarily unavailable"));

    // BYOK request MUST ALSO fail closed to protect serverless instances against DDoS
    const byokRes = await checkDistributedRateLimit("user_byok", false, mockDb as any);
    assert.strictEqual(byokRes.allowed, false, "BYOK request must fail closed on db error");
    assert.ok(byokRes.reason?.includes("temporarily unavailable"));
    console.log("✔ 7. Fail-closed behavior verified for both platform and BYOK requests on db failure");
  }

  console.log("\nAll AI Proxy Distributed Rate Limiter & Abuse Control tests passed successfully! 🛡️");
}

runRateLimiterTests().catch((err) => {
  console.error("Rate limiter test failure:", err);
  process.exit(1);
});
