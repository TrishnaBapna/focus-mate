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

const KEY_NAMES: Record<Provider, string> = {
  anthropic: "focusmate-ai-key",
  gemini: "focusmate-ai-key-gemini",
};
const MODEL_NAMES: Record<Provider, string> = {
  anthropic: "focusmate-ai-model",
  gemini: "focusmate-ai-model-gemini",
};
const PROVIDER_NAME = "focusmate-ai-provider";

const listeners = new Set<() => void>();
const emit = () => listeners.forEach((l) => l());

function read(name: string) {
  try {
    return localStorage.getItem(name) ?? "";
  } catch {
    return "";
  }
}

function write(name: string, value: string) {
  try {
    if (value) localStorage.setItem(name, value);
    else localStorage.removeItem(name);
  } catch {
    // storage unavailable; nothing to do
  }
  emit();
}

export function getProvider(): Provider {
  const saved = read(PROVIDER_NAME);
  if (saved === "gemini" || saved === "anthropic") return saved;
  // Someone who already saved an Anthropic key keeps using it
  return read(KEY_NAMES.anthropic) && !read(KEY_NAMES.gemini) ? "anthropic" : "gemini";
}
export const setProvider = (p: Provider) => write(PROVIDER_NAME, p);

export const getApiKeyFor = (p: Provider) => read(KEY_NAMES[p]);
export const setApiKeyFor = (p: Provider, key: string) => write(KEY_NAMES[p], key);

export function getModelFor(p: Provider) {
  const saved = read(MODEL_NAMES[p]);
  if (p === "anthropic") {
    return ANTHROPIC_MODELS.some((m) => m.id === saved) ? saved : ANTHROPIC_MODELS[0].id;
  }
  return saved || DEFAULT_GEMINI_MODEL;
}
export const setModelFor = (p: Provider, model: string) => write(MODEL_NAMES[p], model);

// Also reacts when a key is saved in another tab
export function subscribeAi(listener: () => void) {
  listeners.add(listener);
  window.addEventListener("storage", listener);
  return () => {
    listeners.delete(listener);
    window.removeEventListener("storage", listener);
  };
}
