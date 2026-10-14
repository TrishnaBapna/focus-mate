import { useEffect, useState } from "react";
import { useAuth } from "../hooks/useAuth";
import { useSocial } from "../hooks/useSocial";
import { fetchRank, fetchTop } from "../services/social";
import { describeError } from "../utils/social";
import type { BoardEntry } from "../types/social";
import BoardList from "./BoardList";

export default function GlobalTab() {
  const { user } = useAuth();
  const social = useSocial();
  const { settings, weekKey, weekSeconds } = social;
  const globalOn = !!settings?.globalOn;

  const [rows, setRows] = useState<BoardEntry[] | null>(null);
  const [rank, setRank] = useState<number | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [tick, setTick] = useState(0);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        const top = await fetchTop(weekKey, 50);
        if (cancelled) return;
        setRows(top);
        setError("");
        if (globalOn) {
          const place = await fetchRank(weekKey, weekSeconds);
          if (!cancelled) setRank(place);
        } else {
          setRank(null);
        }
      } catch (err) {
        console.error("Couldn't load the global board", err);
        if (!cancelled) setError(describeError(err));
      }
    }

    void load();
    const id = window.setInterval(load, 60000); // refresh every minute
    return () => {
      cancelled = true;
      window.clearInterval(id);
    };
  }, [weekKey, globalOn, weekSeconds, tick]);

  async function toggle(on: boolean) {
    setBusy(true);
    setError("");
    try {
      await social.setGlobal(on);
    } catch (err) {
      setError(describeError(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="friends-stack">
      {!globalOn ? (
        <section className="card">
          <h3>🌍 The global board</h3>
          <p>
            See how you compare with everyone else this week. If you join, you appear on the board
            with only your <strong>nickname, emoji, level, and minutes this week</strong>.
          </p>
          <p className="parent-note">
            Kids: please ask a parent or teacher before joining. The global board can be seen by
            every signed-in Focus Mate user.
          </p>
          <button className="btn" disabled={busy} onClick={() => void toggle(true)}>
            Show me on the global board
          </button>
        </section>
      ) : (
        <section className="card">
          <h3>🌍 Global board</h3>
          <p>
            {rank !== null ? (
              <>
                You're <strong>#{rank}</strong> this week.
              </>
            ) : (
              "Working out your place…"
            )}{" "}
            <button className="link-btn" onClick={() => void toggle(false)} disabled={busy}>
              Leave the board
            </button>
          </p>
        </section>
      )}

      <section className="card">
        <div className="group-head">
          <div>
            <h3>Top 50 this week</h3>
            <span className="muted">Resets every Monday</span>
          </div>
          <button className="link-btn" onClick={() => setTick((t) => t + 1)}>
            Refresh
          </button>
        </div>

        {error && <p className="auth-error">{error}</p>}
        {rows === null ? (
          <p className="muted">Loading…</p>
        ) : (
          <BoardList
            rows={rows.map((r) => ({
              id: r.id,
              nickname: r.nickname,
              emoji: r.emoji,
              level: r.level,
              seconds: r.weekSeconds,
            }))}
            meId={user?.uid ?? ""}
          />
        )}
      </section>
    </div>
  );
}
