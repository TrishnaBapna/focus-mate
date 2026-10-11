import { Link } from "react-router-dom";
import { formatClock } from "../utils/time";
import HandwritingThumb from "./HandwritingThumb";
import type { Note } from "../types";

const ICONS = { typed: "", handwritten: "✍️ ", voice: "🎙️ ", scan: "📷 " } as const;

export default function NoteCard({ note: n }: { note: Note }) {
  const kind = n.type ?? "typed";
  const date = n.updatedAt ? n.updatedAt.toDate() : new Date();
  const snippetLength = kind === "scan" ? 80 : 140;

  return (
    <Link to={`/notes/${n.id}`} className="card note-card">
      <h3>
        {ICONS[kind]}
        {n.title || "Untitled"}
      </h3>

      {kind === "handwritten" && <HandwritingThumb strokesJson={n.strokesJson} />}
      {kind === "scan" && n.thumb && <img className="note-thumb-img" src={n.thumb} alt="" />}

      {kind !== "handwritten" && (
        <p className="note-snippet">
          {kind === "voice" && (
            <span className="voice-length">🎵 {formatClock((n.audioSeconds ?? 0) * 1000)} </span>
          )}
          {n.content.slice(0, snippetLength)}
          {n.content.length > snippetLength && "…"}
        </p>
      )}

      <div className="note-meta">
        <span>
          {n.subjectName ? `${n.subjectEmoji} ${n.subjectName}` : "No subject"}
          {n.topic && ` · ${n.topic}`}
        </span>
        <span>
          {n.sessionId && "🔗 "}
          {date.toLocaleDateString(undefined, { day: "numeric", month: "short" })}
        </span>
      </div>
    </Link>
  );
}
