import type { DayStat } from "../utils/stats";

export default function WeeklyCard({ week }: { week: DayStat[] }) {
  const maxSeconds = Math.max(...week.map((d) => d.seconds), 1);
  const topHours = Math.max(2, Math.ceil(maxSeconds / 3600));

  return (
    <section className="wf-card">
      <h3>Weekly Productivity Analysis</h3>
      <div className="wk-chart">
        <span className="wk-top">{topHours}h</span>
        <div className="wk-line" />
        <div className="wk-bars">
          {week.map((d) => (
            <div key={d.key} className="wk-col">
              <div className="wk-track">
                <div
                  className="wk-fill"
                  style={{ height: `${Math.min(100, (d.seconds / (topHours * 3600)) * 100)}%` }}
                />
              </div>
              <span className={d.isToday ? "today" : ""}>{d.label}</span>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
