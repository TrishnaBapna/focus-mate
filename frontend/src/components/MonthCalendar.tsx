import { dayKey } from "../utils/stats";

export interface DayMarks {
  plan: boolean;
  task: boolean;
  studied: boolean;
  exam?: boolean;
}

interface Props {
  month: Date; // any date inside the month to show
  selectedKey: string;
  getMarks: (key: string) => DayMarks;
  onSelect: (key: string) => void;
  onPrev: () => void;
  onNext: () => void;
  onToday: () => void;
}

const WEEKDAYS = ["M", "T", "W", "T", "F", "S", "S"];

export default function MonthCalendar({
  month,
  selectedKey,
  getMarks,
  onSelect,
  onPrev,
  onNext,
  onToday,
}: Props) {
  const year = month.getFullYear();
  const m = month.getMonth();
  const offset = (new Date(year, m, 1).getDay() + 6) % 7; // week starts on Monday
  const daysInMonth = new Date(year, m + 1, 0).getDate();
  const todayKey = dayKey(new Date());

  const cells: (string | null)[] = [
    ...Array<null>(offset).fill(null),
    ...Array.from({ length: daysInMonth }, (_, i) => dayKey(new Date(year, m, i + 1))),
  ];

  return (
    <div className="calendar">
      <div className="cal-header">
        <button className="cal-nav" onClick={onPrev} aria-label="Previous month">
          ‹
        </button>
        <strong>{month.toLocaleDateString(undefined, { month: "long", year: "numeric" })}</strong>
        <button className="cal-nav" onClick={onNext} aria-label="Next month">
          ›
        </button>
      </div>

      <div className="cal-grid">
        {WEEKDAYS.map((w, i) => (
          <span key={i} className="cal-weekday">
            {w}
          </span>
        ))}

        {cells.map((key, i) => {
          if (!key) return <span key={`e${i}`} />;
          const marks = getMarks(key);
          return (
            <button
              key={key}
              className={`cal-day ${key === selectedKey ? "selected" : ""} ${key === todayKey ? "today" : ""}`}
              onClick={() => onSelect(key)}
            >
              <span>{Number(key.slice(8))}</span>
              <span className="dots">
                {marks.plan && <i className="dot plan" />}
                {marks.task && <i className="dot task" />}
                {marks.exam && <i className="dot exam" />}
                {marks.studied && <i className="dot studied" />}
              </span>
            </button>
          );
        })}
      </div>

      <div className="cal-footer">
        <span className="legend">
          <i className="dot plan" /> planned <i className="dot task" /> task due{" "}
          <i className="dot exam" /> exam <i className="dot studied" /> studied
        </span>
        <button className="link-btn" onClick={onToday}>
          Today
        </button>
      </div>
    </div>
  );
}
