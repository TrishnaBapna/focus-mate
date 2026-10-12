import { Link } from "react-router-dom";

const HEADS = ["M", "T", "W", "T", "F", "S", "S"];

// The small frosted calendar inside the hero card
export default function MiniCalendar() {
  const now = new Date();
  const y = now.getFullYear();
  const m = now.getMonth();
  const offset = (new Date(y, m, 1).getDay() + 6) % 7; // week starts on Monday
  const days = new Date(y, m + 1, 0).getDate();
  const cells: (number | null)[] = [
    ...Array<null>(offset).fill(null),
    ...Array.from({ length: days }, (_, i) => i + 1),
  ];

  return (
    <Link
      to="/planner"
      className="mini-cal"
      title={now.toLocaleDateString(undefined, { month: "long", year: "numeric" })}
    >
      <div className="mini-cal-grid">
        {HEADS.map((d, i) => (
          <span key={i} className="mc-head">
            {d}
          </span>
        ))}
        {cells.map((d, i) =>
          d === null ? (
            <span key={`e${i}`} />
          ) : (
            <span key={i} className={`mc-day ${d === now.getDate() ? "today" : ""}`}>
              {d}
            </span>
          )
        )}
      </div>
    </Link>
  );
}
