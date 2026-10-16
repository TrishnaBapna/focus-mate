export type Provider = "gemini" | "anthropic";

export const PROVIDER_LABELS: Record<Provider, string> = {
  gemini: "Google Gemini (free)",
  anthropic: "Anthropic Claude (paid)",
};

export const ANTHROPIC_MODELS = [
  { id: "claude-haiku-4-5-20251001", label: "Claude Haiku 4.5: fast, lowest cost" },
  { id: "claude-sonnet-5-5", label: "Claude Sonnet 5.5: smarter, costs more" },
];

// "latest" aliases keep working when Google retires older model names
export const DEFAULT_GEMINI_MODEL = "gemini-flash-latest";

export const LEGACY_KEY_NAMES: Record<Provider, string> = {
  anthropic: "focusmate-ai-key",
  gemini: "focusmate-ai-key-gemini",
};
export const LEGACY_MODEL_NAMES: Record<Provider, string> = {
  anthropic: "focusmate-ai-model",
  gemini: "focusmate-ai-model-gemini",
};
export const LEGACY_PROVIDER_NAME = "focusmate-ai-provider";

let activeAiUid: string | null = null;
const listeners = new Set<() => void>();
const emit = () => listeners.forEach((l) => l());

/**
 * Returns a user-scoped localStorage key.
 * Format: `focusmate_ai_${uid}_${kind}` or `focusmate_ai_${uid}_${kind}_${subkind}`
 */
export function getScopedStorageKey(kind: string, uid: string, subkind?: string): string {
  if (!uid) return "";
  return subkind ? `focusmate_ai_${uid}_${kind}_${subkind}` : `focusmate_ai_${uid}_${kind}`;
}

export function setActiveAiUid(uid: string | null): void {
  const changed = activeAiUid !== uid;
  activeAiUid = uid;

  if (!uid) {
    // When signed out, purge any lingering legacy unscoped keys to prevent another user from claiming them
    purgeLegacyUnscopedKeys();
  }

  if (changed) {
    emit();
  }
}

export function getActiveAiUid(): string | null {
  return activeAiUid;
}

function read(key: string): string {
  if (!key) return "";
  try {
    return localStorage.getItem(key) ?? "";
  } catch {
    return "";
  }
}

function write(key: string, value: string): void {
  if (!key) return;
  try {
    if (value) localStorage.setItem(key, value);
    else localStorage.removeItem(key);
  } catch {
    // storage unavailable
  }
  emit();
}

/**
 * Purges legacy unscoped keys from localStorage.
 */
export function purgeLegacyUnscopedKeys(): void {
  try {
    if (typeof window === "undefined" || !window.localStorage) return;
    window.localStorage.removeItem(LEGACY_KEY_NAMES.anthropic);
    window.localStorage.removeItem(LEGACY_KEY_NAMES.gemini);
    window.localStorage.removeItem(LEGACY_MODEL_NAMES.anthropic);
    window.localStorage.removeItem(LEGACY_MODEL_NAMES.gemini);
    window.localStorage.removeItem(LEGACY_PROVIDER_NAME);
  } catch {
    // ignore
  }
}

/**
 * Checks if there are legacy unscoped AI keys remaining in localStorage.
 */
export function hasLegacyUnscopedKeys(): boolean {
  try {
    if (typeof window === "undefined" || !window.localStorage) return false;
    return !!(
      window.localStorage.getItem(LEGACY_KEY_NAMES.gemini) ||
      window.localStorage.getItem(LEGACY_KEY_NAMES.anthropic)
    );
  } catch {
    return false;
  }
}

/**
 * Safely migrates legacy unscoped keys to the active user's scoped storage.
 * To prevent cross-account key contamination:
 * 1. Only migrates if a valid targetUid is provided.
 * 2. Does not overwrite already configured scoped keys.
 * 3. Immediately removes the unscoped keys upon migration so no other user can inherit them.
 */
export function migrateLegacyKeysForUser(uid: string): boolean {
  if (!uid || typeof window === "undefined" || !window.localStorage) return false;
  try {
    let migrated = false;
    for (const p of ["gemini", "anthropic"] as Provider[]) {
      const legacyKey = window.localStorage.getItem(LEGACY_KEY_NAMES[p]);
      const scopedKeyName = getScopedStorageKey("key", uid, p);
      const existingScoped = window.localStorage.getItem(scopedKeyName);

      if (legacyKey && !existingScoped) {
        window.localStorage.setItem(scopedKeyName, legacyKey);
        migrated = true;
      }
      if (legacyKey) {
        window.localStorage.removeItem(LEGACY_KEY_NAMES[p]);
      }

      const legacyModel = window.localStorage.getItem(LEGACY_MODEL_NAMES[p]);
      const scopedModelName = getScopedStorageKey("model", uid, p);
      if (legacyModel && !window.localStorage.getItem(scopedModelName)) {
        window.localStorage.setItem(scopedModelName, legacyModel);
      }
      if (legacyModel) {
        window.localStorage.removeItem(LEGACY_MODEL_NAMES[p]);
      }
    }

    const legacyProvider = window.localStorage.getItem(LEGACY_PROVIDER_NAME);
    const scopedProviderName = getScopedStorageKey("provider", uid);
    if (legacyProvider && !window.localStorage.getItem(scopedProviderName)) {
      window.localStorage.setItem(scopedProviderName, legacyProvider);
    }
    if (legacyProvider) {
      window.localStorage.removeItem(LEGACY_PROVIDER_NAME);
    }

    if (migrated) emit();
    return migrated;
  } catch {
    return false;
  }
}

/**
 * Clears active user in-memory keys and purges unscoped keys on logout.
 */
export function clearAiSettingsOnLogout(): void {
  setActiveAiUid(null);
}

export function getProvider(uid: string | null = activeAiUid): Provider {
  if (!uid) return "gemini";
  const saved = read(getScopedStorageKey("provider", uid));
  if (saved === "gemini" || saved === "anthropic") return saved;
  // If user configured Anthropic key but not Gemini, default to Anthropic
  const hasAnthropic = !!getApiKeyFor("anthropic", uid);
  const hasGemini = !!getApiKeyFor("gemini", uid);
  return hasAnthropic && !hasGemini ? "anthropic" : "gemini";
}

export function setProvider(p: Provider, uid: string | null = activeAiUid): void {
  if (!uid) return;
  write(getScopedStorageKey("provider", uid), p);
}

export function getApiKeyFor(p: Provider, uid: string | null = activeAiUid): string {
  if (!uid) return "";
  return read(getScopedStorageKey("key", uid, p));
}

export function setApiKeyFor(p: Provider, key: string, uid: string | null = activeAiUid): void {
  if (!uid) return;
  write(getScopedStorageKey("key", uid, p), key);
}

export function getModelFor(p: Provider, uid: string | null = activeAiUid): string {
  if (!uid) {
    return p === "anthropic" ? ANTHROPIC_MODELS[0].id : DEFAULT_GEMINI_MODEL;
  }
  const saved = read(getScopedStorageKey("model", uid, p));
  if (p === "anthropic") {
    return ANTHROPIC_MODELS.some((m) => m.id === saved) ? saved : ANTHROPIC_MODELS[0].id;
  }
  return saved || DEFAULT_GEMINI_MODEL;
}

export function setModelFor(p: Provider, model: string, uid: string | null = activeAiUid): void {
  if (!uid) return;
  write(getScopedStorageKey("model", uid, p), model);
}

// Reacts to cross-tab storage changes
export function subscribeAi(listener: () => void): () => void {
  listeners.add(listener);
  if (typeof window !== "undefined") {
    window.addEventListener("storage", listener);
  }
  return () => {
    listeners.delete(listener);
    if (typeof window !== "undefined") {
      window.removeEventListener("storage", listener);
    }
  };
}
