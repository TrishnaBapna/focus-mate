import { useState } from "react";
import { useSettings } from "../hooks/useSettings";
import Icon from "./Icon";

// Simple coloured tiles (emoji and colours, not the real logos)
const TILES: Record<string, { emoji: string; bg: string }> = {
  instagram: { emoji: "📸", bg: "linear-gradient(135deg,#f9a03f,#e1306c,#833ab4)" },
  telegram: { emoji: "✈️", bg: "#36a9e1" },
  x: { emoji: "✖️", bg: "#151515" },
  youtube: { emoji: "▶️", bg: "#ff3b3b" },
  snapchat: { emoji: "👻", bg: "#ffd93a" },
  whatsapp: { emoji: "💬", bg: "#4cd264" },
  tiktok: { emoji: "🎵", bg: "#1b1b1b" },
  reddit: { emoji: "🤖", bg: "#ff6a33" },
  facebook: { emoji: "👍", bg: "#3b6fe0" },
  netflix: { emoji: "🎬", bg: "#b3121f" },
  games: { emoji: "🎮", bg: "#8a5cf6" },
};

const SUGGESTED = ["Instagram", "YouTube", "Snapchat", "X", "Telegram", "WhatsApp", "TikTok", "Games"];

export default function BlockListCard() {
  const { settings, update } = useSettings();
  const list = settings.blockList ?? [];
  const [adding, setAdding] = useState(false);
  const [custom, setCustom] = useState("");

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

  return (
    <section className="wf-card">
      <div className="wf-card-head">
        <h3>Block List</h3>
        <button
          className="round-add"
          onClick={() => setAdding(!adding)}
          aria-label={adding ? "Close" : "Add to block list"}
        >
          <Icon name={adding ? "x" : "plus"} size={14} />
        </button>
      </div>

      <div className="block-tiles">
        {list.map((name) => {
          const tile = TILES[name.toLowerCase()];
          return (
            <div key={name} className="block-tile" title={name} style={{ background: tile?.bg ?? "#e2d6cf" }}>
              <span className="tile-emoji">{tile?.emoji ?? name.charAt(0).toUpperCase()}</span>
              <button className="tile-x" onClick={() => remove(name)} aria-label={`Remove ${name}`}>
                ×
              </button>
            </div>
          );
        })}
        {list.length === 0 && !adding && (
          <p className="muted small">Add the apps and sites you want to stay away from while you focus.</p>
        )}
      </div>

      {adding && (
        <div className="block-add">
          <div className="chips-row">
            {suggestions.map((s) => (
              <button key={s} className="chip" onClick={() => add(s)}>
                {s}
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
            <input placeholder="Something else…" value={custom} onChange={(e) => setCustom(e.target.value)} />
            <button className="btn small" type="submit">
              Add
            </button>
          </form>
        </div>
      )}

      <p className="muted tiny">
        A web page can't block other apps, so this is your reminder list. Use Screen Time or Guided
        Access to enforce it.
      </p>
    </section>
  );
}
