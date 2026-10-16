import {
  clearAiSettingsOnLogout,
  getActiveAiUid,
  getApiKeyFor,
  getModelFor,
  getProvider,
  getScopedStorageKey,
  hasLegacyUnscopedKeys,
  LEGACY_KEY_NAMES,
  LEGACY_PROVIDER_NAME,
  migrateLegacyKeysForUser,
  setActiveAiUid,
  setApiKeyFor,
  setModelFor,
  setProvider,
} from "./aiSettings.ts";

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

// Polyfill window & localStorage for Node test runner
if (typeof window === "undefined" || !window.localStorage) {
  const store = new Map<string, string>();
  const mockLocalStorage = {
    getItem: (k: string) => store.get(k) ?? null,
    setItem: (k: string, v: string) => store.set(k, String(v)),
    removeItem: (k: string) => store.delete(k),
    clear: () => store.clear(),
    get length() {
      return store.size;
    },
    key: (i: number) => Array.from(store.keys())[i] ?? null,
  };

  (globalThis as unknown as { window: unknown }).window = {
    localStorage: mockLocalStorage,
    addEventListener: () => {},
    removeEventListener: () => {},
  };
  (globalThis as unknown as { localStorage: unknown }).localStorage = mockLocalStorage;
}

console.log("Running AI Key Account Isolation and Security tests...");

// Reset storage before tests
localStorage.clear();
setActiveAiUid(null);

// 1. Signed-out state
{
  assert.strictEqual(getActiveAiUid(), null);
  assert.strictEqual(getApiKeyFor("gemini"), "");
  assert.strictEqual(getApiKeyFor("anthropic"), "");
  assert.strictEqual(getProvider(), "gemini");
  console.log("✔ Signed-out state safely returns empty keys without errors");
}

// 2. User A key setting and isolated retrieval
{
  const aliceUid = "uid_alice_123";
  setActiveAiUid(aliceUid);
  assert.strictEqual(getActiveAiUid(), aliceUid);

  // Set Alice keys (using synthetic dummy test tokens, never real secrets)
  setApiKeyFor("gemini", "dummy_token_alice_gemini");
  setApiKeyFor("anthropic", "dummy_token_alice_anthropic");
  setProvider("anthropic");
  setModelFor("anthropic", "claude-sonnet-5-5");

  assert.strictEqual(getApiKeyFor("gemini", aliceUid), "dummy_token_alice_gemini");
  assert.strictEqual(getApiKeyFor("anthropic", aliceUid), "dummy_token_alice_anthropic");
  assert.strictEqual(getProvider(aliceUid), "anthropic");
  assert.strictEqual(getModelFor("anthropic", aliceUid), "claude-sonnet-5-5");

  // Verify key is stored under scoped key in localStorage
  const scopedKey = getScopedStorageKey("key", aliceUid, "gemini");
  assert.strictEqual(localStorage.getItem(scopedKey), "dummy_token_alice_gemini");
  console.log("✔ User A keys are successfully scoped by UID");
}

// 3. Logout / Sign-out clears in-memory state and blocks access
{
  clearAiSettingsOnLogout();
  assert.strictEqual(getActiveAiUid(), null);

  // Both providers must now yield empty strings
  assert.strictEqual(getApiKeyFor("gemini"), "");
  assert.strictEqual(getApiKeyFor("anthropic"), "");
  console.log("✔ Logout completely clears active AI keys and in-memory references");
}

// 4. Account switching: User B does NOT inherit User A's keys
{
  const bobUid = "uid_bob_456";
  setActiveAiUid(bobUid);
  assert.strictEqual(getActiveAiUid(), bobUid);

  // Bob has no keys configured yet
  assert.strictEqual(getApiKeyFor("gemini", bobUid), "");
  assert.strictEqual(getApiKeyFor("anthropic", bobUid), "");

  // Bob sets his own key
  setApiKeyFor("gemini", "dummy_token_bob_gemini");
  assert.strictEqual(getApiKeyFor("gemini", bobUid), "dummy_token_bob_gemini");
  assert.strictEqual(getApiKeyFor("anthropic", bobUid), "");

  // Verify Alice's key in storage was unaffected
  assert.strictEqual(getApiKeyFor("gemini", "uid_alice_123"), "dummy_token_alice_gemini");
  assert.strictEqual(getApiKeyFor("anthropic", "uid_alice_123"), "dummy_token_alice_anthropic");
  console.log("✔ Account switching prevents cross-account key inheritance");
}

// 5. Switching back to User A restores User A's keys
{
  const aliceUid = "uid_alice_123";
  setActiveAiUid(aliceUid);

  assert.strictEqual(getApiKeyFor("gemini"), "dummy_token_alice_gemini");
  assert.strictEqual(getApiKeyFor("anthropic"), "dummy_token_alice_anthropic");
  assert.strictEqual(getProvider(), "anthropic");
  console.log("✔ Returning to User A cleanly restores User A's private settings");
}

// 6. Backward compatibility & non-cross-contamination legacy migration
{
  // Simulate an existing pre-update browser state with unscoped keys
  localStorage.setItem(LEGACY_KEY_NAMES.gemini, "dummy_legacy_gemini_key");
  localStorage.setItem(LEGACY_PROVIDER_NAME, "gemini");

  const charlieUid = "uid_charlie_789";
  setActiveAiUid(charlieUid);

  // Charlie migrates their own legacy key
  const migrated = migrateLegacyKeysForUser(charlieUid);
  assert.strictEqual(migrated, true);

  // Charlie now has the scoped key
  assert.strictEqual(getApiKeyFor("gemini", charlieUid), "dummy_legacy_gemini_key");

  // CRITICAL SECURITY CHECK: The unscoped key MUST be deleted from localStorage
  assert.strictEqual(localStorage.getItem(LEGACY_KEY_NAMES.gemini), null);

  // Now simulate a different user (David) signing in
  const davidUid = "uid_david_999";
  setActiveAiUid(davidUid);

  // David's migration must return false because the legacy key was already consumed and purged
  const davidMigrated = migrateLegacyKeysForUser(davidUid);
  assert.strictEqual(davidMigrated, false);
  assert.strictEqual(getApiKeyFor("gemini", davidUid), "");
  console.log("✔ Legacy migration safely assigns to owner and prevents cross-account leak");
}

// 7. Logout purges any remaining unscoped legacy keys
{
  localStorage.setItem(LEGACY_KEY_NAMES.anthropic, "stray_unscoped_key");
  assert.ok(localStorage.getItem(LEGACY_KEY_NAMES.anthropic));

  // Trigger logout
  clearAiSettingsOnLogout();

  // Stray unscoped keys must be gone
  assert.strictEqual(localStorage.getItem(LEGACY_KEY_NAMES.anthropic), null);
  console.log("✔ Logout purges any stray unscoped legacy keys from browser storage");
}

// 8. Shared browser scenario: User A signs out, User B signs in before any migration
{
  // User A has an unmigrated legacy key left in storage
  localStorage.setItem(LEGACY_KEY_NAMES.gemini, "user_a_legacy_secret");
  assert.strictEqual(hasLegacyUnscopedKeys(), true);

  // User A is active
  const userAUid = "uid_shared_user_a";
  setActiveAiUid(userAUid);

  // User A has their own scoped key for anthropic
  setApiKeyFor("anthropic", "user_a_scoped_anthropic", userAUid);
  assert.strictEqual(getApiKeyFor("anthropic", userAUid), "user_a_scoped_anthropic");

  // User A signs out BEFORE any migration occurs
  clearAiSettingsOnLogout();
  assert.strictEqual(getActiveAiUid(), null);

  // Crucial security assertions on sign-out:
  // 1. In-memory keys are wiped
  assert.strictEqual(getApiKeyFor("anthropic"), "");
  assert.strictEqual(getApiKeyFor("gemini"), "");
  // 2. Unscoped legacy keys were purged so the next user cannot claim them
  assert.strictEqual(localStorage.getItem(LEGACY_KEY_NAMES.gemini), null);
  assert.strictEqual(hasLegacyUnscopedKeys(), false);

  // User B signs in on the same shared computer
  const userBUid = "uid_shared_user_b";
  setActiveAiUid(userBUid);

  // User B MUST NOT inherit User A's keys
  assert.strictEqual(getApiKeyFor("gemini", userBUid), "");
  assert.strictEqual(getApiKeyFor("anthropic", userBUid), "");

  // Even if User B tries to call migration, it returns false
  const userBMigrated = migrateLegacyKeysForUser(userBUid);
  assert.strictEqual(userBMigrated, false);
  assert.strictEqual(getApiKeyFor("gemini", userBUid), "");

  // User B sets their own key
  setApiKeyFor("gemini", "user_b_own_key", userBUid);
  assert.strictEqual(getApiKeyFor("gemini", userBUid), "user_b_own_key");

  // User A's scoped key remained intact under User A's UID and was not overwritten or exposed
  assert.strictEqual(getApiKeyFor("anthropic", userAUid), "user_a_scoped_anthropic");
  assert.strictEqual(getApiKeyFor("gemini", userAUid), "");

  console.log("✔ Shared browser test passed: User A logout prevents User B from inheriting keys");
}

console.log("\nAll AI Key Account Isolation and Security tests passed successfully! 🎉");

