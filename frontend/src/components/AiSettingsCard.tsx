import { useState } from "react";
import { useAuth } from "../hooks/useAuth";
import { useAiSettings } from "../hooks/useAiSettings";
import { askAi } from "../services/ai";
import {
  ANTHROPIC_MODELS,
  hasLegacyUnscopedKeys,
  hasCustomApiKeyFor,
  migrateLegacyKeysForUser,
  PROVIDER_LABELS,
  purgeLegacyUnscopedKeys,
  getAllowDirectBrowserFallback,
  setAllowDirectBrowserFallback,
  setApiKeyFor,
  setModelFor,
  setProvider,
  type Provider,
} from "../utils/aiSettings";

export default function AiSettingsCard() {
  const { user } = useAuth();
  const uid = user?.uid ?? null;
  const { provider, apiKey, model } = useAiSettings();
  const [draft, setDraft] = useState("");
  const [status, setStatus] = useState<"idle" | "testing" | "ok" | "error">("idle");
  const [message, setMessage] = useState("");
  const [hasLegacyKeys, setHasLegacyKeys] = useState(() => hasLegacyUnscopedKeys());
  const [directFallback, setDirectFallback] = useState(() => getAllowDirectBrowserFallback(uid));
  const [showCustomInput, setShowCustomInput] = useState(false);

  function reset() {
    setDraft("");
    setStatus("idle");
    setMessage("");
    setShowCustomInput(false);
  }

  function switchProvider(p: Provider) {
    setProvider(p, uid);
    reset();
  }

  function save() {
    const key = draft.trim();
    if (!key) return;
    setApiKeyFor(provider, key, uid);
    reset();
  }

  function remove() {
    setApiKeyFor(provider, "", uid);
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

      {hasLegacyKeys && uid && (
        <div
          className="settings-notice"
          style={{
            background: "var(--card-hover, #fdf6ec)",
            border: "1px dashed #d97706",
            padding: "12px",
            borderRadius: "8px",
            marginBottom: "1rem",
          }}
        >
          <p style={{ margin: "0 0 8px 0", fontSize: "0.9rem" }}>
            ⚠️ <strong>Unassigned API Key Detected:</strong> We found an unassigned API key from a
            previous version of FocusMate in this browser. To protect account privacy on shared
            computers, keys are not assigned automatically.
          </p>
          <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
            <button
              type="button"
              className="btn small"
              onClick={() => {
                migrateLegacyKeysForUser(uid);
                setHasLegacyKeys(false);
                setMessage("Legacy key imported to your account ✅");
                setStatus("ok");
              }}
            >
              Import key to my account
            </button>
            <button
              type="button"
              className="btn secondary small danger"
              onClick={() => {
                purgeLegacyUnscopedKeys();
                setHasLegacyKeys(false);
                setMessage("Unassigned key discarded.");
                setStatus("idle");
              }}
            >
              Discard key
            </button>
          </div>
        </div>
      )}

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
        <>
          <div className="settings-row">
            <span>
              {hasCustomApiKeyFor(provider, uid)
                ? `🔑 Personal key active (ends in …${apiKey.slice(-4)})`
                : `✨ Built-in Gemini is active for all students (ends in …${apiKey.slice(-4)})`}
            </span>
            <button
              className="btn secondary small"
              onClick={() => void test()}
              disabled={status === "testing"}
            >
              {status === "testing" ? "Testing…" : "Test key"}
            </button>
            {hasCustomApiKeyFor(provider, uid) && (
              <button className="link-btn danger" onClick={remove} title="Switch back to shared built-in key">
                Use built-in key
              </button>
            )}
          </div>

          {!hasCustomApiKeyFor(provider, uid) && (
            <div className="settings-row" style={{ marginTop: "6px" }}>
              {!showCustomInput ? (
                <button
                  type="button"
                  className="link-btn"
                  style={{ fontSize: "0.85rem" }}
                  onClick={() => setShowCustomInput(true)}
                >
                  + Use a private API key (optional for power users)
                </button>
              ) : (
                <div style={{ display: "flex", gap: "8px", width: "100%", alignItems: "center" }}>
                  <input
                    type="password"
                    autoComplete="off"
                    placeholder="Paste your private API key"
                    value={draft}
                    onChange={(e) => setDraft(e.target.value)}
                    style={{ flex: 1 }}
                  />
                  <button className="btn small" onClick={() => { save(); setShowCustomInput(false); }}>
                    Save private key
                  </button>
                  <button
                    type="button"
                    className="link-btn small"
                    onClick={() => { setDraft(""); setShowCustomInput(false); }}
                  >
                    Cancel
                  </button>
                </div>
              )}
            </div>
          )}
        </>
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
      {apiKey && (
        <div style={{ margin: "6px 0 12px 0" }}>
          <label style={{ display: "flex", alignItems: "center", gap: "8px", cursor: "pointer", fontSize: "0.85rem" }}>
            <input
              type="checkbox"
              checked={directFallback}
              onChange={(e) => {
                const next = e.target.checked;
                setDirectFallback(next);
                setAllowDirectBrowserFallback(next, uid);
              }}
            />
            <span style={{ color: "var(--text-muted, #666)" }}>
              Allow direct browser connection if server proxy is unavailable
            </span>
          </label>
        </div>
      )}

      {message && <p className={status === "ok" ? "saved-note" : "auth-error"}>{message}</p>}

      <div className="settings-row">
        {provider === "anthropic" ? (
          <label className="lang-select">
            Model
            <select value={model} onChange={(e) => setModelFor("anthropic", e.target.value, uid)}>
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
              onBlur={(e) => setModelFor("gemini", e.target.value.trim(), uid)}
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
