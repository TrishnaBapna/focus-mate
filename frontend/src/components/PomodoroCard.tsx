import { Link, useNavigate } from "react-router-dom";
import { useFocus } from "../hooks/useFocus";
import { useSubjects } from "../hooks/useSubjects";
import Icon from "./Icon";

function Hourglass() {
  return (
    <svg className="hourglass" viewBox="0 0 64 80" aria-hidden="true">
      <rect x="10" y="4" width="44" height="6" rx="3" fill="#6b5b53" />
      <rect x="10" y="70" width="44" height="6" rx="3" fill="#6b5b53" />
      <path
        d="M16 10h32c0 16-10 22-10 30s10 14 10 30H16c0-16 10-22 10-30S16 26 16 10z"
        fill="rgba(255,255,255,0.55)"
        stroke="#6b5b53"
        strokeWidth="3"
        strokeLinejoin="round"
      />
      <path d="M22 14h20c-1 8-6 12-10 16-4-4-9-8-10-16z" fill="#4cc77a" />
      <path d="M32 44c4 4 9 8 10 22H22c1-14 6-18 10-22z" fill="#4cc77a" />
      <path d="M32 30v14" stroke="#4cc77a" strokeWidth="2" />
    </svg>
  );
}

// The yellow Pomodoro card: pick a subject, set the minutes, press Start
export default function PomodoroCard() {
  const f = useFocus();
  const { subjects } = useSubjects();
  const navigate = useNavigate();
  const running = f.phase === "focus" || f.phase === "break";

  function step(delta: number) {
    f.setFocusMinutes(Math.min(180, Math.max(5, f.focusMinutes + delta)));
  }

  function start() {
    if (running) {
      navigate("/focus");
      return;
    }
    if (!f.subjectId) return;
    f.setMode("pomodoro");
    f.startFocus();
    navigate("/focus");
  }

  return (
    <section className="wf-pomo">
      <h3>Pomodoro Timer</h3>

      <label className="pomo-subject">
        <select
          value={f.subjectId}
          onChange={(e) => f.setSubjectId(e.target.value)}
          disabled={running}
          aria-label="Subject"
        >
          <option value="">Choose a subject</option>
          {subjects.map((s) => (
            <option key={s.id} value={s.id}>
              {s.emoji} {s.name}
            </option>
          ))}
        </select>
        <Icon name="chevron" size={12} />
      </label>

      <Hourglass />

      {running ? (
        <span className="pomo-time">{f.clockText}</span>
      ) : (
        <div className="pomo-stepper">
          <button onClick={() => step(-5)} aria-label="5 minutes less">
            <Icon name="minus" size={14} />
          </button>
          <span className="pomo-time">{String(f.focusMinutes).padStart(2, "0")}:00</span>
          <button onClick={() => step(5)} aria-label="5 minutes more">
            <Icon name="plus" size={14} />
          </button>
        </div>
      )}

      <button className="pomo-start" onClick={start} disabled={!running && !f.subjectId}>
        {running ? "Open timer" : "Start"}
      </button>

      {subjects.length === 0 && (
        <Link to="/subjects" className="pomo-note">
          Add a subject first
        </Link>
      )}
    </section>
  );
}
