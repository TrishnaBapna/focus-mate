import { useMemo, useState } from "react";
import WeeklyReportCard from "../components/WeeklyReportCard";
import { useSessions } from "../hooks/useSessions";
import { computeAnalytics, hourLabel, type Range } from "../utils/analytics";
import { formatDuration } from "../utils/time";

const RANGES: { id: Range; label: string; previous: string }[] = [
  { id: "week", label: "Week", previous: "the previous 7 days" },
  { id: "month", label: "Month", previous: "the previous 30 days" },
  { id: "year", label: "Year", previous: "the previous 12 months" },
];

export default function Analytics() {
  const { sessions, loading } = useSessions(2000);
  const [range, setRange] = useState<Range>("week");
  const a = useMemo(() => computeAnalytics(sessions, range), [sessions, range]);

  const previous = RANGES.find((r) => r.id === range)?.previous ?? "";
  const maxBucket = Math.max(...a.buckets.map((b) => b.seconds), 1);
  const maxWeekday = Math.max(...a.weekdays.map((d) => d.seconds), 1);
  const maxHour = Math.max(...a.hours, 1);
  const maxSubject = Math.max(...a.bySubject.map((s) => s.seconds), 1);

  return (
    <>
      <div className="analytics-head">
        <h1>Analytics 📊</h1>
        <div className="mode-tabs">
          {RANGES.map((r) => (
            <button
              key={r.id}
              type="button"
              className={`chip ${range === r.id ? "selected" : ""}`}
              onClick={() => setRange(r.id)}
            >
              {r.label}
            </button>
          ))}
        </div>
      </div>

      {!loading && sessions.length === 0 && (
        <p className="empty-note">Finish a focus session and your analytics will appear here ✨</p>
      )}

      <WeeklyReportCard />

      <div className="stat-grid">
        <div className="card stat-card">
          <span className="stat-label">⏱️ Total focus</span>
          <span className="stat-big">{formatDuration(a.totalSeconds)}</span>
          {a.changePercent === null ? (
            <span className="muted change">No earlier data to compare</span>
          ) : (
            <span className={`change ${a.changePercent >= 0 ? "up" : "down"}`}>
              {a.changePercent >= 0 ? "↑" : "↓"} {Math.abs(a.changePercent)}% vs {previous}
            </span>
          )}
        </div>

        <div className="card stat-card">
          <span className="stat-label">🎯 Sessions</span>
          <span className="stat-big">{a.sessionCount}</span>
        </div>

        <div className="card stat-card">
          <span className="stat-label">⌛ Average session</span>
          <span className="stat-big">{formatDuration(a.avgSessionSeconds)}</span>
        </div>

        <div className="card stat-card">
          <span className="stat-label">📆 Daily average</span>
          <span className="stat-big">{formatDuration(a.dailyAvgSeconds)}</span>
        </div>

        <div className="card stat-card">
          <span className="stat-label">✅ Days studied</span>
          <span className="stat-big">
            {a.daysStudied} / {a.totalDays}
          </span>
        </div>

        <div className="card stat-card">
          <span className="stat-label">🏅 Best day</span>
          <span className="stat-big">{a.bestDay ? formatDuration(a.bestDay.seconds) : "–"}</span>
          {a.bestDay && <span className="muted change">{a.bestDay.label}</span>}
        </div>
      </div>

      <div className="analytics-grid">
        <section className="card wide">
          <h3>{range === "year" ? "Focus per month" : "Focus per day"}</h3>
          <div className={`bars ${range === "month" ? "dense" : ""}`}>
            {a.buckets.map((b) => (
              <div key={b.key} className={`bar-col ${b.isCurrent ? "today" : ""}`}>
                <div className="bar-track">
                  <div
                    className="bar-fill"
                    style={{ height: `${(b.seconds / maxBucket) * 100}%` }}
                    title={formatDuration(b.seconds)}
                  />
                </div>
                <span>{b.label || "\u00A0"}</span>
              </div>
            ))}
          </div>
        </section>

        <section className="card">
          <h3>By subject</h3>
          {a.bySubject.length === 0 ? (
            <p className="empty-note">Nothing in this period yet.</p>
          ) : (
            <ul className="breakdown">
              {a.bySubject.map((s) => (
                <li key={s.name}>
                  <div className="breakdown-head">
                    <span>
                      {s.emoji} {s.name}
                    </span>
                    <strong>{formatDuration(s.seconds)}</strong>
                  </div>
                  <div className="progress">
                    <div
                      className="progress-fill"
                      style={{ width: `${(s.seconds / maxSubject) * 100}%` }}
                    />
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="card">
          <h3>Most productive day</h3>
          <div className="bars weekday-bars">
            {a.weekdays.map((d) => (
              <div key={d.label} className="bar-col">
                <div className="bar-track">
                  <div
                    className="bar-fill"
                    style={{ height: `${(d.seconds / maxWeekday) * 100}%` }}
                    title={formatDuration(d.seconds)}
                  />
                </div>
                <span>{d.label}</span>
              </div>
            ))}
          </div>
          <p className="muted">
            {a.bestWeekday ? `You focus most on ${a.bestWeekday}s.` : "No data in this period yet."}
          </p>
        </section>

        <section className="card">
          <h3>Best time to focus</h3>
          <div className="hour-bars">
            {a.hours.map((seconds, h) => (
              <div key={h} className="hour-col">
                <div
                  className="hour-fill"
                  style={{ height: `${(seconds / maxHour) * 100}%` }}
                  title={`${hourLabel(h)}: ${formatDuration(seconds)}`}
                />
              </div>
            ))}
          </div>
          <div className="hour-axis">
            <span>12 AM</span>
            <span>6 AM</span>
            <span>12 PM</span>
            <span>6 PM</span>
          </div>
          <p className="muted">
            {a.bestWindow ? `You're most focused around ${a.bestWindow}.` : "No data in this period yet."}
          </p>
        </section>

        <section className="card">
          <h3>Consistency (last 12 weeks)</h3>
          <div className="heatmap">
            {a.heatmap.map((c) => (
              <div
                key={c.key}
                className={`hm-cell level-${c.level} ${c.future ? "future" : ""}`}
                title={`${c.key}: ${formatDuration(c.seconds)}`}
              />
            ))}
          </div>
          <div className="heat-legend">
            <span>Less</span>
            {[0, 1, 2, 3, 4].map((l) => (
              <i key={l} className={`hm-cell level-${l}`} />
            ))}
            <span>More</span>
          </div>
        </section>
      </div>
    </>
  );
}
