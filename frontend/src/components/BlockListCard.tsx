import { useState } from "react";
import { useSettings } from "../hooks/useSettings";
import Icon from "./Icon";
import { playDistractionBeep } from "../utils/chime";
import { buildBlockCommand, buildUnblockCommand, normalizeDomain, resolveBlockList } from "../utils/blocklist";

// Supported distracting apps and domains
const TILES: Record<string, { emoji: string; bg: string }> = {
  youtube: { emoji: "▶️", bg: "#ff3b3b" },
  instagram: { emoji: "📸", bg: "linear-gradient(135deg,#f9a03f,#e1306c,#833ab4)" },
  tiktok: { emoji: "🎵", bg: "#1b1b1b" },
  x: { emoji: "✖️", bg: "#151515" },
  twitter: { emoji: "🐦", bg: "#1da1f2" },
  telegram: { emoji: "✈️", bg: "#36a9e1" },
  snapchat: { emoji: "👻", bg: "#ffd93a" },
  whatsapp: { emoji: "💬", bg: "#4cd264" },
  reddit: { emoji: "🤖", bg: "#ff6a33" },
  facebook: { emoji: "👍", bg: "#3b6fe0" },
  netflix: { emoji: "🎬", bg: "#b3121f" },
  games: { emoji: "🎮", bg: "#8a5cf6" },
};

const SUGGESTED = ["YouTube", "Instagram", "TikTok", "X", "Telegram", "WhatsApp", "Snapchat", "Reddit", "Netflix", "Games"];

export default function BlockListCard() {
  const { settings, update } = useSettings();
  const list = settings.blockList ?? [];
  const [adding, setAdding] = useState(false);
  const [custom, setCustom] = useState("");
  const [showSystemGuide, setShowSystemGuide] = useState(false);
  const [blockTab, setBlockTab] = useState<"phone" | "desktop">("phone");
  const [testedSound, setTestedSound] = useState(false);
  const [copiedBlock, setCopiedBlock] = useState(false);
  const [copiedUnblock, setCopiedUnblock] = useState(false);

  function add(name: string) {
    const clean = (normalizeDomain(name) ?? name).trim().slice(0, 40);
    if (!clean || list.some((n) => n.toLowerCase() === clean.toLowerCase())) return;
    update({ blockList: [...list, clean] });
    setCustom("");
  }

  function remove(name: string) {
    update({ blockList: list.filter((n) => n !== name) });
  }

  const suggestions = SUGGESTED.filter((s) => !list.some((n) => n.toLowerCase() === s.toLowerCase()));

  // Real macOS hosts-file commands. Only safe, validated domains are ever included.
  const { domains, skipped } = resolveBlockList(list);
  const macBlockCommand = buildBlockCommand(domains);
  const macUnblockCommand = buildUnblockCommand();

  function copyText(txt: string, isBlock: boolean) {
    void navigator.clipboard.writeText(txt);
    if (isBlock) {
      setCopiedBlock(true);
      setTimeout(() => setCopiedBlock(false), 2000);
    } else {
      setCopiedUnblock(true);
      setTimeout(() => setCopiedUnblock(false), 2000);
    }
  }

  return (
    <section className="wf-card">
      <div className="wf-card-head">
        <div>
          <h3>Distraction Block List</h3>
          <span className="shield-badge">
            <span className="shield-dot" />
            {list.length} on your list
          </span>
        </div>
        <div style={{ display: "flex", gap: "8px", alignItems: "center" }}>
          <button
            className="chip system-block-btn"
            onClick={() => setShowSystemGuide(!showSystemGuide)}
            title="Real Mac / PC System Blocker"
          >
            ⚡ Real Blocker
          </button>
          <button
            className="round-add"
            onClick={() => setAdding(!adding)}
            aria-label={adding ? "Close" : "Add to block list"}
          >
            <Icon name={adding ? "x" : "plus"} size={14} />
          </button>
        </div>
      </div>

      <div className="block-tiles">
        {list.map((name) => {
          const tile = TILES[name.toLowerCase()];
          return (
            <div key={name} className="block-tile" title={name} style={{ background: tile?.bg ?? "#e2d6cf" }}>
              <span className="tile-emoji">{tile?.emoji ?? name.charAt(0).toUpperCase()}</span>
              <span className="tile-label">{name}</span>
              <button className="tile-x" onClick={() => remove(name)} aria-label={`Remove ${name}`}>
                ×
              </button>
            </div>
          );
        })}
        {list.length === 0 && !adding && (
          <p className="muted small">Add YouTube, Instagram, TikTok, or apps you want blocked while focusing.</p>
        )}
      </div>

      {adding && (
        <div className="block-add">
          <div className="chips-row">
            {suggestions.map((s) => (
              <button key={s} className="chip" onClick={() => add(s)}>
                + {s}
              </button>
            ))}
          </div>
          <form
            className="inline-form"
            onSubmit={(e) => {
              e.preventDefault();
              add(custom);
            }}
          >
            <input placeholder="Add app or website…" value={custom} onChange={(e) => setCustom(e.target.value)} />
            <button className="btn small" type="submit">
              Add
            </button>
          </form>
        </div>
      )}

      {showSystemGuide && (
        <div className="system-block-card">
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <strong>🛡️ Focus Shield & Blocker Guide</strong>
            <button className="link-btn" onClick={() => setShowSystemGuide(false)}>✕</button>
          </div>

          <div className="block-tabs">
            <button
              type="button"
              className={`block-tab-btn ${blockTab === "phone" ? "active" : ""}`}
              onClick={() => setBlockTab("phone")}
            >
              📱 Phone (No Terminal)
            </button>
            <button
              type="button"
              className={`block-tab-btn ${blockTab === "desktop" ? "active" : ""}`}
              onClick={() => setBlockTab("desktop")}
            >
              💻 Mac / PC (Terminal)
            </button>
          </div>

          {blockTab === "phone" ? (
            <div className="phone-guide-body">
              <div className="phone-feature-badge">
                <span className="dot-sm" style={{ background: "var(--green)" }} />
                <span><strong>Phone alert (Strict mode only):</strong> FocusMate can't block other apps, but it notices when you leave and warns you.</span>
              </div>

              <div className="phone-step-card" style={{ marginTop: "8px" }}>
                <div className="step-title">1. Leave alert (Strict mode)</div>
                <p className="tiny muted">
                  With Strict mode on, if you switch away from FocusMate during a focus session, it plays an alarm, wilts your plant and records the time you were away. It cannot stop the other app from opening.
                </p>
                <button
                  type="button"
                  className="btn small secondary"
                  style={{ marginTop: "6px" }}
                  onClick={() => {
                    playDistractionBeep();
                    setTestedSound(true);
                    setTimeout(() => setTestedSound(false), 2500);
                  }}
                >
                  {testedSound ? "🔔 Alarm Playing!" : "🔊 Test Phone Alarm Tone"}
                </button>
              </div>

              <div className="phone-step-card" style={{ marginTop: "8px" }}>
                <div className="step-title">2. Real phone lock (set up on your phone)</div>
                <p className="tiny muted">
                  <strong>iPhone / iPad (iOS):</strong> Use <em>Guided Access</em> (Triple-click power button). It keeps your phone inside one app until you turn it off with your passcode, so other apps can't be opened.
                </p>
                <p className="tiny muted" style={{ marginTop: "4px" }}>
                  <strong>Android:</strong> Pull down notification shade and tap <em>Focus Mode</em> (Digital Wellbeing) to pause chosen apps (set it up in Android settings), or use <em>App Pinning</em> to stay in one app.
                </p>
              </div>
            </div>
          ) : (
            <div className="desktop-guide-body">
              <p className="small muted">
                Want to block these websites in every browser on this Mac? Run this command in Terminal (it asks for your Mac password). It only adds lines tagged "focusmate-block", and the second command removes exactly those lines. Websites only: it can't block apps, and browsers using "Secure DNS" may ignore it.
              </p>
              {skipped.length > 0 && (
                <p className="tiny muted">
                  Not included (not a website address): {skipped.join(", ")}. Add the site, for example "discord.com".
                </p>
              )}
              {macBlockCommand === "" ? (
                <p className="small muted">Add a website to your list first.</p>
              ) : (
              <div className="code-box">
                <code>{macBlockCommand}</code>
                <button className="btn small" onClick={() => copyText(macBlockCommand, true)}>
                  {copiedBlock ? "Copied! ✓" : "Copy Block Command"}
                </button>
              </div>
              )}
              <div className="code-box unblock-box" style={{ marginTop: "6px" }}>
                <code>{macUnblockCommand}</code>
                <button className="btn small secondary" onClick={() => copyText(macUnblockCommand, false)}>
                  {copiedUnblock ? "Copied! ✓" : "Copy Unblock Command"}
                </button>
              </div>
            </div>
          )}

          <p className="tiny muted" style={{ marginTop: "4px" }}>
            Honest note: a web page can't block other websites or apps by itself. Strict mode alerts you when you leave; real blocking needs the Mac command above or your phone's own settings.
          </p>
        </div>
      )}

      <p className="muted tiny">
        Your list is a reminder. In Strict mode, leaving FocusMate triggers an alert tone, wilts your plant and records your away time. Your timer keeps running.
      </p>
    </section>
  );
}
