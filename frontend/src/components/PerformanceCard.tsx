const RADIUS = 46;
const LENGTH = 2 * Math.PI * RADIUS;

// The green ring: how much of today's focus goal is done
export default function PerformanceCard({ percent }: { percent: number }) {
  return (
    <section className="wf-card perf">
      <h3>Focus Performance</h3>
      <span className="perf-today">Today</span>
      <svg
        className="perf-ring"
        viewBox="0 0 120 120"
        role="progressbar"
        aria-valuenow={percent}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label={`${percent}% of today's focus goal`}
      >
        <circle className="ring-bg" cx="60" cy="60" r={RADIUS} />
        <circle
          className="ring-val"
          cx="60"
          cy="60"
          r={RADIUS}
          strokeDasharray={`${(percent / 100) * LENGTH} ${LENGTH}`}
          transform="rotate(-90 60 60)"
        />
        <text className="perf-pct" x="60" y="67" textAnchor="middle">
          {percent}%
        </text>
      </svg>
      <span className="perf-legend">
        <i className="dot-sm" style={{ background: "#5fcf80" }} />
        Productive Hours
      </span>
    </section>
  );
}
