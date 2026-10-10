import { Link } from "react-router-dom";
import { useFocus } from "../hooks/useFocus";
import { useSubjects } from "../hooks/useSubjects";
import { useSessions } from "../hooks/useSessions";
import { CHEERS, growthEmoji, plantFor } from "../utils/garden";
import { formatDuration } from "../utils/time";
import type { SessionMode } from "../types";

const PRESETS = [25, 50, 90];
const MODES: { id: SessionMode; label: string }[] = [
  { id: "pomodoro", label: "Pomodoro" },
  { id: "timer", label: "Timer" },
  { id: "stopwatch", label: "Stopwatch" },
];

export default function Focus() {
  const f = useFocus();
  const { subjects } = useSubjects();
  const { sessions } = useSessions(5);

  // ---------- Running (focus or break) ----------
  if (f.phase === "focus" || f.phase === "break") {
    const isBreak = f.phase === "break";
    const strictRun = f.strictActive;
    const wilted = strictRun && f.awayCount > 0;
    const plant = isBreak
      ? "☕"
      : growthEmoji(f.hasTarget ? f.progress : null, Math.floor(f.elapsedSeconds / 60), wilted);
    const cheer = CHEERS[Math.floor(f.elapsedSeconds / 60) % CHEERS.length];

    return (
      <div className={`card focus-running ${strictRun ? "strict" : ""}`}>
        {strictRun && <p className="strict-banner">🔒 STRICT FOCUS</p>}

        <div className="grow">{plant}</div>

        <p className="focus-subject">
          {isBreak ? "Break time. Stretch and sip some water!" : `${f.subject?.emoji} ${f.subject?.name}`}
        </p>
        {!isBreak && f.topic && <p className="focus-topic">{f.topic}</p>}

        <div className="clock">{f.clockText}</div>

        {f.hasTarget && (
          <div className="progress">
            <div className="progress-fill" style={{ width: `${f.progress}%` }} />
          </div>
        )}

        {!isBreak && f.goal && <p className="focus-goal">🎯 {f.goal}</p>}
        {!isBreak && <p className="cheer">{wilted ? "Your plant is wilting. Stay put to keep the rest healthy." : cheer}</p>}

        {strictRun ? (
          <>
            <p className="muted strict-hint">
              Locked until the timer ends. Leaving full screen, the tab, or the app is recorded and
              makes your plant wilt. 🔕 Turn on Do Not Disturb on your device.
            </p>
            {f.awayCount > 0 && (
              <p className="away-chip">
                👀 Left {f.awayCount}× ({formatDuration(f.awaySeconds)})
              </p>
            )}
          </>
        ) : (
          <div className="focus-controls">
            {f.running ? (
              <button className="btn" onClick={f.pause}>Pause</button>
            ) : (
              <button className="btn" onClick={f.resume}>Resume</button>
            )}
            {isBreak ? (
              <button className="btn secondary" onClick={f.backToSetup}>Skip break</button>
            ) : (
              <>
                <button className="btn secondary" onClick={f.finishEarly}>
                  Finish session
                </button>
                <button className="link-btn" onClick={f.cancelSession}>Cancel</button>
              </>
            )}
          </div>
        )}
      </div>
    );
  }

  // ---------- Session complete ----------
  if (f.phase === "focusDone" && f.result) {
    const saved = f.result.status === "saved";
    const wilted = !!f.result.strict && (f.result.leaves ?? 0) > 0;
    const plant = plantFor(f.result.seconds, wilted);
    const noteLink = f.result.sessionId
      ? `/notes/new?${new URLSearchParams({
          subject: f.subjectId,
          session: f.result.sessionId,
          topic: f.topic,
        }).toString()}`
      : "";

    return (
      <div className="card focus-running">
        {saved ? (
          <>
            <div className="grow still">{plant}</div>
            <h2>{wilted ? "Your plant wilted 🥀" : "Nice! You grew a plant 🎉"}</h2>
            <p className="muted">
              {wilted
                ? "You left during the strict session, so it didn't make it. Next time stay put and it will bloom."
                : "It's in your garden on the Home screen."}
            </p>
          </>
        ) : (
          <h2>🎉 Session complete!</h2>
        )}

        <p className="focus-subject">
          {f.subject?.emoji} {f.subject?.name}
          {f.topic && ` · ${f.topic}`}
        </p>
        <div className="clock small">{formatDuration(f.result.seconds)}</div>

        {f.result.strict && !wilted && (
          <p className="strict-result">🔒 Strict session · you stayed in the app the whole time 🎉</p>
        )}
        {f.result.strict && wilted && (
          <p className="strict-result">
            🔒 Strict session · you left {f.result.leaves} time{f.result.leaves === 1 ? "" : "s"} (
            {formatDuration(f.result.awaySeconds ?? 0)})
          </p>
        )}

        {f.result.status === "short" && (
          <p className="empty-note">Under 1 minute, so no plant this time.</p>
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
                onClick={() => {
                  f.setMode(m.id);
                  if (m.id === "stopwatch") f.setStrict(false); // strict needs a timer length
                }}
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

          <label className="strict-toggle">
            <input
              type="checkbox"
              checked={f.strict && f.mode !== "stopwatch"}
              disabled={f.mode === "stopwatch"}
              onChange={(e) => f.setStrict(e.target.checked)}
            />
            <span>
              🔒 Strict mode
              <small>
                {f.mode === "stopwatch"
                  ? "Needs a timer length, so it's off for Stopwatch."
                  : "Full screen, locked until the timer ends. If you leave, your plant wilts 🥀"}
              </small>
            </span>
          </label>

          <details className="strict-tips">
            <summary>Want it unbreakable?</summary>
            <p className="muted">
              A web page can't block your device's own shortcuts (Alt-Tab, Cmd-Tab, closing the
              window), so for a real lock use your device. Menu names vary a little between
              versions:
            </p>
            <ul>
              <li>
                <strong>iPhone / iPad:</strong> Settings → Accessibility → Guided Access, then
                triple-click the side button inside Focus Mate.
              </li>
              <li>
                <strong>Android:</strong> turn on App pinning (screen pinning) in Security
                settings, then pin your browser.
              </li>
              <li>
                <strong>Computer:</strong> close other windows first, and use a separate browser
                profile with no other tabs.
              </li>
              <li>
                <strong>Parents:</strong> Screen Time (iOS) or Family Link (Android) can limit
                other apps while a child studies.
              </li>
            </ul>
          </details>

          <details className="more-options">
            <summary>More options</summary>
            <div className="more-options-body">
              <label>
                Topic
                <input
                  placeholder="e.g. Integration"
                  value={f.topic}
                  onChange={(e) => f.setTopic(e.target.value)}
                />
              </label>

              <label>
                Goal
                <input
                  placeholder="e.g. Complete 10 problems"
                  value={f.goal}
                  onChange={(e) => f.setGoal(e.target.value)}
                />
              </label>

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
            </div>
          </details>

          <button className="btn" disabled={!f.subjectId} onClick={f.startFocus}>
            🌱 START FOCUS
          </button>
        </section>
      )}

      <section className="card recent-sessions">
        <h3>Recent sessions</h3>
        {sessions.length === 0 ? (
          <p className="empty-note">No sessions yet. Your first plant is waiting 🌱</p>
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
