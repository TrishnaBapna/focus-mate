import { useState } from "react";
import { useAiSettings } from "../hooks/useAiSettings";
import { askAi } from "../services/ai";
import {
  ANTHROPIC_MODELS,
  PROVIDER_LABELS,
  setApiKeyFor,
  setModelFor,
  setProvider,
  type Provider,
} from "../utils/aiSettings";

export default function AiSettingsCard() {
  const { provider, apiKey, model } = useAiSettings();
  const [draft, setDraft] = useState("");
  const [status, setStatus] = useState<"idle" | "testing" | "ok" | "error">("idle");
  const [message, setMessage] = useState("");

  function reset() {
    setDraft("");
    setStatus("idle");
    setMessage("");
  }

  function switchProvider(p: Provider) {
    setProvider(p);
    reset();
  }

  function save() {
    const key = draft.trim();
    if (!key) return;
    setApiKeyFor(provider, key);
    reset();
  }

  function remove() {
    setApiKeyFor(provider, "");
    reset();
  }

  async function test() {
    setStatus("testing");
    setMessage("");
    try {
      await askAi({
        provider,
        apiKey,
        model,
        system: "Reply with the single word: ready",
        prompt: "Are you there?",
        maxTokens: 10,
      });
      setStatus("ok");
      setMessage("Your key works ✅");
    } catch (err) {
      setStatus("error");
      setMessage(err instanceof Error ? err.message : "That didn't work.");
    }
  }

  return (
    <section className="card settings-section">
      <h3>AI study tools</h3>

      <div className="settings-row">
        {(["gemini", "anthropic"] as Provider[]).map((p) => (
          <button
            key={p}
            type="button"
            className={`chip ${provider === p ? "selected" : ""}`}
            onClick={() => switchProvider(p)}
          >
            {PROVIDER_LABELS[p]}
          </button>
        ))}
      </div>

      {provider === "gemini" ? (
        <p className="muted settings-hint">
          Free, no credit card. Get a key at aistudio.google.com: sign in with a Google account,
          click <strong>Get API key</strong>, then <strong>Create API key</strong>. The free tier has
          usage limits, and Google may use what you send on it to improve its products, so avoid
          running private information through it.
        </p>
      ) : (
        <p className="muted settings-hint">
          Paid: usage is billed to your own Anthropic account. Get a key at console.anthropic.com
          and consider setting a monthly spending limit there.
        </p>
      )}

      {apiKey ? (
        <div className="settings-row">
          <span>🔑 Key saved in this browser (ends in …{apiKey.slice(-4)})</span>
          <button
            className="btn secondary small"
            onClick={() => void test()}
            disabled={status === "testing"}
          >
            {status === "testing" ? "Testing…" : "Test key"}
          </button>
          <button className="link-btn danger" onClick={remove}>
            Remove
          </button>
        </div>
      ) : (
        <div className="settings-row">
          <input
            type="password"
            autoComplete="off"
            placeholder="Paste your API key"
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
          />
          <button className="btn" onClick={save}>
            Save key
          </button>
        </div>
      )}

      {message && <p className={status === "ok" ? "saved-note" : "auth-error"}>{message}</p>}

      <div className="settings-row">
        {provider === "anthropic" ? (
          <label className="lang-select">
            Model
            <select value={model} onChange={(e) => setModelFor("anthropic", e.target.value)}>
              {ANTHROPIC_MODELS.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.label}
                </option>
              ))}
            </select>
          </label>
        ) : (
          <label className="lang-select">
            Model
            <input
              key={provider}
              defaultValue={model}
              onBlur={(e) => setModelFor("gemini", e.target.value.trim())}
              aria-label="Gemini model name"
            />
          </label>
        )}
      </div>
      {provider === "gemini" && (
        <p className="muted settings-hint">
          Leave the model as it is unless you see a "model not found" message. In that case, type a
          current Flash model name from Google AI Studio.
        </p>
      )}

      <p className="muted settings-hint">
        🔒 The key stays in this browser only. It is never saved to Focus Mate's database and is
        only sent to {provider === "gemini" ? "Google" : "Anthropic"}. Don't use this on a shared
        computer, and note that logging out doesn't remove it (use Remove). Each device needs its
        own key.
      </p>
    </section>
  );
}
