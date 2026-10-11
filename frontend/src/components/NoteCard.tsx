import { Link } from "react-router-dom";
import { formatClock } from "../utils/time";
import HandwritingThumb from "./HandwritingThumb";
import import import import import import import import import import import import import import import import import import import import import import import import import import import import import import import import import import import import import import import import import import import import import import import import import import import import import import import import import import import import import import import import import import import import import import import import import import import import import import import import import import import import import import import import import import import import import import import import import import import import import import import import import import import import import import import import import import import import import import import import im className="voice-length">🎵 {formatClock((n.audioSeconds ?? 0) * 1000)} </span>
          )}
          {kind === "scan" && pageCount > 1 && <span className="voice-length">📄 {pageCount} pages </span>}
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
