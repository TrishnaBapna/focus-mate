import { formatDuration } from "../utils/time";

export interface BoardRow {
  id: string;
  nickname: string;
  emoji: string;
  level: number;
  seconds: number;
}

// A ranked list with medals for the top three
export default function BoardList({ rows, meId }: { rows: BoardRow[]; meId: string }) {
  if (rows.length === 0) return <p className="muted">No one here yet.</p>;

  return (
    <ol className="board">
      {rows.map((r, i) => (
        <li key={r.id} className={`board-row ${r.id === meId ? "me" : ""}`}>
          <span className="board-rank">{i === 0 ? "🥇" : i === 1 ? "🥈" : i === 2 ? "🥉" : i + 1}</span>
          <span className="board-emoji">{r.emoji}</span>
          <span className="board-name">
            <strong>
              {r.nickname}
              {r.id === meId && " (you)"}
            </strong>
            <small>Level {r.level}</small>
          </span>
          <span className="board-time">{r.seconds > 0 ? formatDuration(r.seconds) : "0 min"}</span>
        </li>
      ))}
    </ol>
  );
}
