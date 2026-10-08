import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useFocus } from "../hooks/useFocus";
import { useSubjects } from "../hooks/useSubjects";
import { useSessions } from "../hooks/useSessions";
import { formatDuration } from "../utils/time";
import type { SessionMode } from "../types";

const PRESETS = [25, 50, 90];
const MODES: { id: SessionMode; label: string }[] = [
  { id: "pomodoro", label: "Pomodoro" },
  { id: "timer", label: "Timer" },
  { id: "stopwatch", label: "Stopwatch" },
];

// Ending a strict session takes a short pause and a deliberate click
function EndConfirmModal({
  focused,
  onConfirm,
  onCancel,
}: {
  focused: string;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  const [wait, setWait] = useState(5);

  useEffect(() => {
    if (wait <= 0) return;
    const id = window.setTimeout(() => setWait((w) => w - 1), 1000);
    return () => window.clearTimeout(id);
  }, [wait]);

  return (
    <div className="modal-backdrop">
      <div className="card modal">
        <h3>End this session early?</h3>
        <p>You've focused for {focused}. That time will still be saved.</p>
        <div className="focus-controls">
          <button className="btn" onClick={onCancel}>
            Keep focusing
          </button>
          <button className="btn secondary" disabled={wait > 0} onClick={onConfirm}>
            {wait > 0 ? `End session (${wait})` : "End session"}
          </button>
        </div>
      </div>
    </div>
  );
}

export default function Focus() {
  const f = useFocus();
  const { subjects } = useSubjects();
  const { sessions } = useSessions(5);
  const [confirmOpen, setConfirmOpen] = useState(false);

  // ---------- Running (focus or break) ----------
  if (f.phase === "focus" || f.phase === "break") {
    const isBreak = f.phase === "break";
    const strictRun = f.strictActive;

    return (
      <>
        <div className={`card focus-running ${strictRun ? "strict" : ""}`}>
          {strictRun && <p className="strict-banner">⚠️ STRICT FOCUS</p>}

          <p className="focus-subject">
            {isBreak ? "☕ Break time" : `${f.subject?.emoji} ${f.subject?.name}`}
          </p>
          {!isBreak && f.topic && <p className="focus-topic">{f.topic}</p>}

          <div className="clock">{f.clockText}</div>

          {f.hasTarget && (
            <div className="progress">
              <div className="progress-fill" style={{ width: `${f.progress}%` }} />
            </div>
          )}

          {!isBreak && f.goal && <p className="focus-goal">🎯 {f.goal}</p>}

          <div className="focus-controls">
            {!strictRun &&
              (f.running ? (
                <button className="btn" onClick={f.pause}>Pause</button>
              ) : (
                <button className="btn" onClick={f.resume}>Resume</button>
              ))}

            {isBreak ? (
              <button className="btn secondary" onClick={f.backToSetup}>Skip break</button>
            ) : strictRun ? (
              <button className="btn secondary" onClick={() => setConfirmOpen(true)}>
                End session
              </button>
            ) : (
              <>
                <button className="btn secondary" onClick={f.finishEarly}>
                  Finish session
                </button>
                <button className="link-btn" onClick={f.cancelSession}>Cancel</button>
              </>
            )}
          </div>

          {strictRun && (
            <>
              <p className="muted strict-hint">
                Once started, ending the session requires confirmation. 🔕 Turn on Do Not
                Disturb on your device to silence notifications.
              </p>
              {f.awayCount > 0 && (
                <p className="away-chip">
                  👀 Left the tab {f.awayCount}× ({formatDuration(f.awaySeconds)})
                </p>
              )}
            </>
          )}
        </div>

        {strictRun && f.awayNotice !== null && (
          <div className="card away-notice">
            <span>
              👋 Welcome back! You were away for {formatDuration(f.awayNotice)}. Let's get
              back to it.
            </span>
            <button className="task-delete" onClick={f.dismissAwayNotice} aria-label="Dismiss">
              ✕
            </button>
          </div>
        )}

        {confirmOpen && (
          <EndConfirmModal
            focused={formatDuration(f.elapsedSeconds)}
            onCancel={() => setConfirmOpen(false)}
            onConfirm={() => {
              setConfirmOpen(false);
              f.finishEarly();
            }}
          />
        )}
      </>
    );
  }

  // ---------- Session complete ----------
  if (f.phase === "focusDone" && f.result) {
    const noteLink = f.result.sessionId
      ? `/notes/new?${new URLSearchParams({
          subject: f.subjectId,
          session: f.result.sessionId,
          topic: f.topic,
        }).toString()}`
      : "";

    return (
      <div className="card focus-running">
        <h2>🎉 Session complete!</h2>
        <p className="focus-subject">
          {f.subject?.emoji} {f.subject?.name}
          {f.topic && ` · ${f.topic}`}
        </p>
        <div className="clock small">{formatDuration(f.result.seconds)}</div>

        {f.result.strict && (
          <p className="strict-result">
            🔒 Strict session ·{" "}
            {f.result.leaves
              ? `you left the tab ${f.result.leaves} time${f.result.leaves === 1 ? "" : "s"} (${formatDuration(f.result.awaySeconds ?? 0)})`
              : "you stayed in the app the whole time 🎉"}
          </p>
        )}

        {f.result.status === "short" && (
          <p className="empty-note">Under 1 minute, so this one wasn't saved.</p>
        )}
        {f.result.status === "error" && (
          <p className="auth-error">Couldn't save this session. Check your connection.</p>
        )}

        <div className="focus-controls">
          {noteLink && (
            <Link to={noteLink} className="btn">
              📝 Add a note
            </Link>
          )}
          {f.mode === "pomodoro" && (
            <button className="btn secondary" onClick={f.startBreak}>
              Start {f.breakMinutes}-min break
            </button>
          )}
          <button className="btn secondary" onClick={f.backToSetup}>
            Back to Focus
          </button>
        </div>
      </div>
    );
  }

  // ---------- Setup ----------
  return (
    <>
      <h1 className="page-title">Focus ⏱️</h1>

      {subjects.length === 0 ? (
        <section className="card">
          <p>Create a subject first so your sessions can be tracked.</p>
          <Link to="/subjects">Go to Subjects →</Link>
        </section>
      ) : (
        <section className="card focus-setup">
          <div className="mode-tabs">
            {MODES.map((m) => (
              <button
                key={m.id}
                type="button"
                className={`chip ${f.mode === m.id ? "selected" : ""}`}
                onClick={() => f.setMode(m.id)}
              >
                {m.label}
              </button>
            ))}
          </div>

          <label>
            Subject
            <select value={f.subjectId} onChange={(e) => f.setSubjectId(e.target.value)}>
              <option value="">Choose a subject…</option>
              {subjects.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.emoji} {s.name}
                </option>
              ))}
            </select>
          </label>

          <label>
            Topic
            <input
              placeholder="e.g. Integration"
              value={f.topic}
              onChange={(e) => f.setTopic(e.target.value)}
            />
          </label>

          {f.mode !== "stopwatch" && (
            <div>
              <span className="field-label">Focus length</span>
              <div className="mode-tabs">
                {PRESETS.map((p) => (
                  <button
                    key={p}
                    type="button"
                    className={`chip ${f.focusMinutes === p ? "selected" : ""}`}
                    onClick={() => f.setFocusMinutes(p)}
                  >
                    {p} min
                  </button>
                ))}
                <input
                  className="minutes-input"
                  type="number"
                  min={1}
                  value={f.focusMinutes}
                  onChange={(e) => f.setFocusMinutes(Math.max(1, Number(e.target.value) || 1))}
                />
                <span>min</span>
              </div>
            </div>
          )}

          {f.mode === "pomodoro" && (
            <label>
              Break (minutes)
              <input
                className="minutes-input"
                type="number"
                min={1}
                value={f.breakMinutes}
                onChange={(e) => f.setBreakMinutes(Math.max(1, Number(e.target.value) || 1))}
              />
            </label>
          )}

          <label>
            Goal
            <input
              placeholder="e.g. Complete 10 problems"
              value={f.goal}
              onChange={(e) => f.setGoal(e.target.value)}
            />
          </label>

          <label className="strict-toggle">
            <input
              type="checkbox"
              checked={f.strict}
              onChange={(e) => f.setStrict(e.target.checked)}
            />
            <span>
              🔒 Strict mode
              <small>
                No pausing or leaving this page, and ending early needs confirmation.
              </small>
            </span>
          </label>

          <button className="btn" disabled={!f.subjectId} onClick={f.startFocus}>
            START FOCUS
          </button>
        </section>
      )}

      <section className="card recent-sessions">
        <h3>Recent sessions</h3>
        {sessions.length === 0 ? (
          <p className="empty-note">No sessions yet. Your first one will show up here.</p>
        ) : (
          <ul>
            {sessions.map((s) => (
              <li key={s.id}>
                <span>
                  {s.strict && "🔒 "}
                  {s.subjectEmoji} {s.subjectName}
                  {s.topic && ` · ${s.topic}`}
                </span>
                <strong>{formatDuration(s.durationSeconds)}</strong>
              </li>
            ))}
          </ul>
        )}
      </section>
    </>
  );
}
