import { useState } from "react";
import { useSettings } from "../hooks/useSettings";
import Icon from "./Icon";

// Supported distracting apps and domains
const TILES: Record<string, { emoji: string; bg: string; domain: string }> = {
  youtube: { emoji: "▶️", bg: "#ff3b3b", domain: "youtube.com" },
  instagram: { emoji: "📸", bg: "linear-gradient(135deg,#f9a03f,#e1306c,#833ab4)", domain: "instagram.com" },
  tiktok: { emoji: "🎵", bg: "#1b1b1b", domain: "tiktok.com" },
  x: { emoji: "✖️", bg: "#151515", domain: "x.com" },
  twitter: { emoji: "🐦", bg: "#1da1f2", domain: "twitter.com" },
  telegram: { emoji: "✈️", bg: "#36a9e1", domain: "web.telegram.org" },
  snapchat: { emoji: "👻", bg: "#ffd93a", domain: "snapchat.com" },
  whatsapp: { emoji: "💬", bg: "#4cd264", domain: "web.whatsapp.com" },
  reddit: { emoji: "🤖", bg: "#ff6a33", domain: "reddit.com" },
  facebook: { emoji: "👍", bg: "#3b6fe0", domain: "facebook.com" },
  netflix: { emoji: "🎬", bg: "#b3121f", domain: "netflix.com" },
  games: { emoji: "🎮", bg: "#8a5cf6", domain: "discord.com" },
};

const SUGGESTED = ["YouTube", "Instagram", "TikTok", "X", "Telegram", "WhatsApp", "Snapchat", "Reddit", "Netflix", "Games"];

export default function BlockListCard() {
  const { settings, update } = useSettings();
  const list = settings.blockList ?? [];
  const [adding, setAdding] = useState(false);
  const [custom, setCustom] = useState("");
  const [showSystemGuide, setShowSystemGuide] = useState(false);
  const [copiedBlock, setCopiedBlock] = useState(false);
  const [copiedUnblock, setCopiedUnblock] = useState(false);

  function add(name: string) {
    const clean = name.trim();
    if (!clean || list.some((n) => n.toLowerCase() === clean.toLowerCase())) return;
    update({ blockList: [...list, clean] });
    setCustom("");
  }

  function remove(name: string) {
    update({ blockList: list.filter((n) => n !== name) });
  }

  const suggestions = SUGGESTED.filter((s) => !list.some((n) => n.toLowerCase() === s.toLowerCase()));

  // Generates real macOS hosts block command based on current list
  const domains = list.map((item) => {
    const key = item.toLowerCase();
    return TILES[key]?.domain || `${key}.com`;
  });
  const domainString = domains.flatMap((d) => [d, `www.${d}`]).join(" ");
  const macBlockCommand = `sudo sh -c 'echo "127.0.0.1 ${domainString}" >> /etc/hosts && dscacheutil -flushcache'`;
  const macUnblockCommand = `sudo sed -i '' '/127.0.0.1/d' /etc/hosts && dscacheutil -flushcache`;

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
            Active Focus Shield ({list.length} Blocked)
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
            <strong>🛡️ Enforce Real System-Wide Blocking</strong>
            <button className="link-btn" onClick={() => setShowSystemGuide(false)}>✕</button>
          </div>
          <p className="small muted">
            Want to block {list.slice(0, 3).join(", ") || "YouTube"} across all browsers and apps on your device while you study? Run this 1-line command in your Mac Terminal:
          </p>
          <div className="code-box">
            <code>{macBlockCommand}</code>
            <button className="btn small" onClick={() => copyText(macBlockCommand, true)}>
              {copiedBlock ? "Copied! ✓" : "Copy Block Command"}
            </button>
          </div>
          <div className="code-box unblock-box" style={{ marginTop: "6px" }}>
            <code>{macUnblockCommand}</code>
            <button className="btn small secondary" onClick={() => copyText(macUnblockCommand, false)}>
              {copiedUnblock ? "Copied! ✓" : "Copy Unblock Command"}
            </button>
          </div>
          <p className="tiny muted">
            Active Browser Shield: When Focus mode is running, FocusMate catches tab switching away to blocked apps, sounds an audible distraction alarm, and pauses your streak.
          </p>
        </div>
      )}

      <p className="muted tiny">
        🛡️ Real Focus Shield: While your timer is running, switching tabs to YouTube or social apps will trigger an alert tone, wilt your plant, and pause your study session.
      </p>
    </section>
  );
}
