import { useEffect, useState } from "react";
import { useAuth } from "../hooks/useAuth";
import { useSocial } from "../hooks/useSocial";
import { fetchGroup, fetchMembers } from "../services/social";
import type { BoardEntry, GroupInfo } from "../types/social";
import BoardList from "./BoardList";

export default function GroupCard({ code }: { code: string }) {
  const { user } = useAuth();
  const social = useSocial();

  // undefined = loading, null = the group no longer exists
  const [info, setInfo] = useState<GroupInfo | null | undefined>(undefined);
  const [members, setMembers] = useState<BoardEntry[]>([]);
  const [error, setError] = useState("");
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        const group = await fetchGroup(code);
        if (cancelled) return;
        setInfo(group);
        if (!group) return;
        const list = await fetchMembers(code);
        if (cancelled) return;
        setMembers(list);
        setError("");
      } catch (err) {
        console.error("Couldn't load group", err);
        if (!cancelled) setError("Couldn't load this group right now.");
      }
    }

    void load();
    const id = window.setInterval(load, 60000); // refresh every minute
    return () => {
      cancelled = true;
      window.clearInterval(id);
    };
  }, [code]);

  // The group was closed by its owner: quietly remove it from your list
  useEffect(() => {
    if (info === null) void social.forgetGroup(code);
  }, [info, code, social]);

  if (info === undefined) return <section className="card group-card">Loading group…</section>;
  if (info === null) return null;

  const isOwner = !!user && info.ownerUid === user.uid;
  const rows = members
    .map((m) => ({
      id: m.id,
      nickname: m.nickname,
      emoji: m.emoji,
      level: m.level,
      seconds: m.weekKey === social.weekKey ? m.weekSeconds : 0,
    }))
    .sort((a, b) => b.seconds - a.seconds);

  async function copyInvite() {
    try {
      await navigator.clipboard.writeText(
        `Join my Focus Mate group “${info?.name}” with the code ${code}`
      );
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      // clipboard not available; the code is shown on screen anyway
    }
  }

  async function leave() {
    const message = isOwner
      ? `Close “${info?.name}”? It will be removed for everyone in it.`
      : `Leave “${info?.name}”?`;
    if (!window.confirm(message)) return;
    try {
      await social.leaveGroup(code, isOwner);
    } catch {
      setError("Couldn't do that. Please try again.");
    }
  }

  return (
    <section className="card group-card">
      <div className="group-head">
        <div>
          <h3>{info.name}</h3>
          <span className="muted">
            {members.length} {members.length === 1 ? "member" : "members"} · resets Monday
          </span>
        </div>
        <button className="code-pill" onClick={() => void copyInvite()} title="Copy an invite message">
          {copied ? "Copied ✓" : code}
        </button>
      </div>

      <BoardList rows={rows} meId={user?.uid ?? ""} />

      {error && <p className="auth-error">{error}</p>}

      <button className="link-btn danger align-start" onClick={() => void leave()}>
        {isOwner ? "Close group" : "Leave group"}
      </button>
    </section>
  );
}
