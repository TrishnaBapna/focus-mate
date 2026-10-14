import { useState } from "react";
import GlobalTab from "../components/GlobalTab";
import GroupsTab from "../components/GroupsTab";
import { useSocial } from "../hooks/useSocial";
import { EMOJI_CHOICES, randomIdentity, validateNickname } from "../utils/nicknames";
import { describeError } from "../utils/social";
import { formatDuration } from "../utils/time";

// Picks an emoji and a nickname (used when joining and when editing)
function IdentityForm({
  initial,
  buttonLabel,
  onSubmit,
  onCancel,
  requireAgree,
}: {
  initial: { nickname: string; emoji: string };
  buttonLabel: string;
  onSubmit: (nickname: string, emoji: string) => Promise<void>;
  onCancel?: () => void;
  requireAgree?: boolean;
}) {
  const [identity, setIdentity] = useState(initial);
  const [agree, setAgree] = useState(!requireAgree);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit() {
    const problem = validateNickname(identity.nickname);
    if (problem) {
      setError(problem);
      return;
    }
    setBusy(true);
    setError("");
    try {
      await onSubmit(identity.nickname.trim().replace(/\s+/g, " "), identity.emoji);
    } catch (err) {
      setError(describeError(err));
      setBusy(false);
    }
  }

  return (
    <div className="identity-form">
      <div className="emoji-grid">
        {EMOJI_CHOICES.map((e) => (
          <button
            key={e}
            type="button"
            className={`emoji-btn ${identity.emoji === e ? "on" : ""}`}
            onClick={() => setIdentity({ ...identity, emoji: e })}
            aria-label={`Use ${e}`}
          >
            {e}
          </button>
        ))}
      </div>

      <div className="nick-row">
        <input
          value={identity.nickname}
          maxLength={20}
          onChange={(e) => setIdentity({ ...identity, nickname: e.target.value })}
          aria-label="Nickname"
        />
        <button type="button" className="btn secondary small" onClick={() => setIdentity(randomIdentity())}>
          🎲 New name
        </button>
      </div>

      {requireAgree && (
        <>
          <p className="parent-note">
            Kids: please ask a parent or teacher before joining. Only your nickname, emoji, level,
            and minutes this week are shared. You can leave and delete it all at any time.
          </p>
          <label className="agree">
            <input type="checkbox" checked={agree} onChange={(e) => setAgree(e.target.checked)} />I
            understand, and a parent or teacher knows (if I'm a kid)
          </label>
        </>
      )}

      {error && <p className="auth-error">{error}</p>}

      <div className="focus-controls">
        <button className="btn" disabled={busy || !agree} onClick={() => void submit()}>
          {buttonLabel}
        </button>
        {onCancel && (
          <button className="link-btn" onClick={onCancel}>
            Cancel
          </button>
        )}
      </div>
    </div>
  );
}

export default function Friends() {
  const social = useSocial();
  const { settings, loading } = social;
  const [tab, setTab] = useState<"groups" | "global">("groups");
  const [editing, setEditing] = useState(false);

  if (loading) return <p>Loading…</p>;

  // Not joined yet: a friendly welcome
  if (!settings || !settings.nickname) {
    return (
      <section className="card friends-welcome">
        <h2>Study with friends 🏆</h2>
        <p>
          Make a group with your friends or class and see who focuses the most each week, or join
          the global board. It's friendly, it resets every Monday, and it's completely optional.
        </p>
        <ul className="share-list">
          <li>✅ Shared: a nickname, an emoji, your level, and minutes focused this week</li>
          <li>🚫 Never shared: your name, email, notes, photos, or what you study</li>
        </ul>
        <h3>Pick how you'll appear</h3>
        <IdentityForm
          initial={randomIdentity()}
          buttonLabel="Join"
          requireAgree
          onSubmit={(nickname, emoji) => social.setIdentity(nickname, emoji)}
        />
      </section>
    );
  }

  async function stop() {
    if (!window.confirm("Stop sharing? You'll leave all groups and the global board, and your entries are deleted.")) {
      return;
    }
    try {
      await social.stopSharing();
    } catch (err) {
      window.alert(describeError(err));
    }
  }

  return (
    <div className="friends-stack">
      <section className="card me-card">
        <div className="me-head">
          <span className="me-emoji">{settings.emoji}</span>
          <div className="me-text">
            <strong>{settings.nickname}</strong>
            <span className="muted">
              Level {social.level} ·{" "}
              {social.weekSeconds > 0 ? formatDuration(social.weekSeconds) : "0 min"} this week
            </span>
          </div>
          {!editing && (
            <button className="link-btn" onClick={() => setEditing(true)}>
              Edit
            </button>
          )}
        </div>

        {editing && (
          <IdentityForm
            initial={{ nickname: settings.nickname, emoji: settings.emoji }}
            buttonLabel="Save"
            onCancel={() => setEditing(false)}
            onSubmit={async (nickname, emoji) => {
              await social.setIdentity(nickname, emoji);
              setEditing(false);
            }}
          />
        )}
      </section>

      <div className="mode-tabs">
        <button className={`chip ${tab === "groups" ? "selected" : ""}`} onClick={() => setTab("groups")}>
          👥 My groups
        </button>
        <button className={`chip ${tab === "global" ? "selected" : ""}`} onClick={() => setTab("global")}>
          🌍 Global
        </button>
      </div>

      {tab === "groups" ? <GroupsTab /> : <GlobalTab />}

      <button className="link-btn danger align-start" onClick={() => void stop()}>
        Stop sharing and delete my entries
      </button>
    </div>
  );
}
