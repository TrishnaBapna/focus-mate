import { useState, type FormEvent } from "react";
import { useAuth } from "../hooks/useAuth";
import { useFriendships, useMyProfile, useProfiles } from "../hooks/useSocial";
import {
  MAX_FRIENDS,
  acceptRequest,
  isValidNickname,
  removeFriendship,
  saveNickname,
  sendRequest,
} from "../services/social";
import { formatDuration } from "../utils/time";
import { weekStartKey } from "../utils/week";

function errorText(err: unknown) {
  const msg = (err as Error).message;
  switch (msg) {
    case "nickname-taken":
      return "That nickname is taken. Try another.";
    case "not-found":
      return "No one has that nickname.";
    case "self":
      return "That's you! 😄";
    case "exists":
      return "You already have a request or friendship with that person.";
    default:
      return "Something went wrong. Please try again.";
  }
}

const MEDALS = ["🥇", "🥈", "🥉"];

export default function Friends() {
  const { user } = useAuth();
  const { profile, loading } = useMyProfile();
  const friendships = useFriendships();

  const [nick, setNick] = useState("");
  const [editingNick, setEditingNick] = useState(false);
  const [friendNick, setFriendNick] = useState("");
  const [error, setError] = useState("");
  const [info, setInfo] = useState("");

  const uid = user?.uid ?? "";
  const other = (f: { members: string[] }) => f.members.find((m) => m !== uid) ?? "";
  const otherName = (f: { from: string; fromNickname: string; toNickname: string }) =>
    f.from === uid ? f.toNickname : f.fromNickname;

  const accepted = friendships.filter((f) => f.status === "accepted");
  const incoming = friendships.filter((f) => f.status === "pending" && f.to === uid);
  const outgoing = friendships.filter((f) => f.status === "pending" && f.from === uid);

  const ids = uid ? [uid, ...accepted.map(other)] : [];
  const profiles = useProfiles(ids);
  const thisWeek = weekStartKey(new Date());

  if (!user) return null;
  if (loading) return <p>Loading…</p>;

  async function run(action: () => Promise<unknown>, success = "") {
    setError("");
    setInfo("");
    try {
      await action();
      setInfo(success);
      return true;
    } catch (err) {
      console.error(err);
      setError(errorText(err));
      return false;
    }
  }

  async function handleNickname(e: FormEvent) {
    e.preventDefault();
    const value = nick.trim();
    if (!isValidNickname(value)) {
      setError("Use 3–20 letters, numbers or underscores.");
      return;
    }
    const ok = await run(() => saveNickname(uid, value, profile?.nicknameLower));
    if (ok) {
      setEditingNick(false);
      setNick("");
    }
  }

  async function handleAddFriend(e: FormEvent) {
    e.preventDefault();
    if (!profile || !friendNick.trim()) return;
    if (accepted.length >= MAX_FRIENDS) {
      setError(`You can have up to ${MAX_FRIENDS} friends.`);
      return;
    }
    const existing = friendships.map(other);
    const ok = await run(
      () => sendRequest({ uid, nickname: profile.nickname }, friendNick.trim(), existing),
      "Request sent! ✨"
    );
    if (ok) setFriendNick("");
  }

  // ---------- Pick a nickname ----------
  if (!profile || editingNick) {
    return (
      <>
        <h1 className="page-title">Friends 🏆</h1>
        <form className="card friends-card" onSubmit={handleNickname}>
          <h3>{profile ? "Change your nickname" : "Choose a nickname"}</h3>
          <p className="muted">
            Friends find you by this name. Others only see your nickname and your weekly focus
            time, never your subjects or notes.
          </p>
          <input
            className="friend-input"
            placeholder="e.g. trishna_studies"
            value={nick}
            onChange={(e) => setNick(e.target.value)}
            maxLength={20}
          />
          {error && <p className="auth-error">{error}</p>}
          <div className="focus-controls">
            <button className="btn" type="submit">Save</button>
            {profile && (
              <button type="button" className="link-btn" onClick={() => setEditingNick(false)}>
                Cancel
              </button>
            )}
          </div>
        </form>
      </>
    );
  }

  // ---------- Leaderboard ----------
  const rows = ids
    .map((id) => {
      const p = profiles[id];
      const friendship = accepted.find((f) => other(f) === id);
      return {
        id,
        name: id === uid ? profile.nickname : (p?.nickname ?? (friendship ? otherName(friendship) : "?")),
        seconds: p?.weekKey === thisWeek ? (p.weekSeconds ?? 0) : 0,
        friendshipId: friendship?.id,
      };
    })
    .sort((a, b) => b.seconds - a.seconds || a.name.localeCompare(b.name));

  return (
    <>
      <h1 className="page-title">Friends 🏆</h1>

      <div className="stats-grid">
        <section className="card friends-card">
          <h3>Weekly leaderboard</h3>
          <p className="muted">Focus time since Monday</p>
          <ol className="leaderboard">
            {rows.map((r, i) => (
              <li key={r.id} className={r.id === uid ? "me" : ""}>
                <span className="rank">{MEDALS[i] ?? i + 1}</span>
                <span className="lb-name">
                  {r.name}
                  {r.id === uid && " (you)"}
                </span>
                <strong>{formatDuration(r.seconds)}</strong>
                {r.friendshipId && (
                  <button
                    className="delete-btn static"
                    title="Remove friend"
                    onClick={() => {
                      if (window.confirm(`Remove ${r.name}?`)) {
                        void run(() => removeFriendship(r.friendshipId!));
                      }
                    }}
                  >
                    ✕
                  </button>
                )}
              </li>
            ))}
          </ol>
          {accepted.length === 0 && (
            <p className="empty-note">Add a friend to start competing ✨</p>
          )}
        </section>

        <section className="card friends-card">
          <h3>Add a friend</h3>
          <form className="friend-form" onSubmit={handleAddFriend}>
            <input
              className="friend-input"
              placeholder="Their nickname"
              value={friendNick}
              onChange={(e) => setFriendNick(e.target.value)}
            />
            <button className="btn" type="submit">Send</button>
          </form>
          {error && <p className="auth-error">{error}</p>}
          {info && <p className="muted">{info}</p>}

          {incoming.length > 0 && (
            <>
              <h4>Requests for you</h4>
              <ul className="request-list">
                {incoming.map((f) => (
                  <li key={f.id}>
                    <span>{f.fromNickname}</span>
                    <span>
                      <button className="btn small" onClick={() => void run(() => acceptRequest(f.id))}>
                        Accept
                      </button>
                      <button className="link-btn" onClick={() => void run(() => removeFriendship(f.id))}>
                        Decline
                      </button>
                    </span>
                  </li>
                ))}
              </ul>
            </>
          )}

          {outgoing.length > 0 && (
            <>
              <h4>Waiting for a reply</h4>
              <ul className="request-list">
                {outgoing.map((f) => (
                  <li key={f.id}>
                    <span>{f.toNickname}</span>
                    <button className="link-btn" onClick={() => void run(() => removeFriendship(f.id))}>
                      Cancel
                    </button>
                  </li>
                ))}
              </ul>
            </>
          )}

          <p className="muted nick-line">
            Your nickname: <strong>{profile.nickname}</strong>{" "}
            <button
              className="link-btn"
              onClick={() => {
                setError("");
                setEditingNick(true);
              }}
            >
              Change
            </button>
          </p>
        </section>
      </div>
    </>
  );
}
