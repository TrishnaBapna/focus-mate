import { useState } from "react";
import { Link } from "react-router-dom";
import HandwritingThumb from "../components/HandwritingThumb";
import { useNotes } from "../hooks/useNotes";
import { useSubjects } from "../hooks/useSubjects";
import { formatClock } from "../utils/time";

export default function Notes() {
  const { notes, loading } = useNotes();
  const { subjects } = useSubjects();
  const [search, setSearch] = useState("");
  const [subjectFilter, setSubjectFilter] = useState("all");
  const [chooserOpen, setChooserOpen] = useState(false);

  const term = search.trim().toLowerCase();
  const filtered = notes.filter((n) => {
    const matchesSubject = subjectFilter === "all" || n.subjectId === subjectFilter;
    const matchesSearch =
      !term ||
      `${n.title} ${n.content} ${n.topic} ${n.subjectName}`.toLowerCase().includes(term);
    return matchesSubject && matchesSearch;
  });

  return (
    <>
      <div className="notes-header">
        <h1>Notes 📝</h1>
        <button className="btn" onClick={() => setChooserOpen(true)}>
          + New note
        </button>
      </div>

      {chooserOpen && (
        <div className="modal-backdrop" onClick={() => setChooserOpen(false)}>
          <div className="card modal" onClick={(e) => e.stopPropagation()}>
            <h3>How do you want to create your note?</h3>
            <div className="chooser-grid">
              <Link to="/notes/new" className="chooser-option">
                <span className="chooser-icon">⌨️</span>
                Type
              </Link>
              <Link to="/notes/new?type=handwritten" className="chooser-option">
                <span className="chooser-icon">✍️</span>
                Handwrite
              </Link>
              <div className="chooser-option disabled">
                <span className="chooser-icon">📷</span>
                Scan
                <small>Coming soon</small>
              </div>
              <Link to="/notes/new?type=voice" className="chooser-option">
                <span className="chooser-icon">🎙️</span>
                Voice
              </Link>
            </div>
            <button className="link-btn" onClick={() => setChooserOpen(false)}>
              Cancel
            </button>
          </div>
        </div>
      )}

      <input
        className="search-input"
        placeholder="Search notes…"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
      />

      <div className="mode-tabs filter-tabs">
        <button
          type="button"
          className={`chip ${subjectFilter === "all" ? "selected" : ""}`}
          onClick={() => setSubjectFilter("all")}
        >
          All
        </button>
        {subjects.map((s) => (
          <button
            key={s.id}
            type="button"
            className={`chip ${subjectFilter === s.id ? "selected" : ""}`}
            onClick={() => setSubjectFilter(s.id)}
          >
            {s.emoji} {s.name}
          </button>
        ))}
      </div>

      {loading ? (
        <p>Loading…</p>
      ) : filtered.length === 0 ? (
        <p className="empty-note">
          {notes.length === 0
            ? "No notes yet. Create your first one ✨"
            : "No notes match your search."}
        </p>
      ) : (
        <div className="notes-grid">
          {filtered.map((n) => {
            const date = n.updatedAt ? n.updatedAt.toDate() : new Date();
            const handwritten = n.type === "handwritten";
            const voice = n.type === "voice";
            return (
              <Link key={n.id} to={`/notes/${n.id}`} className="card note-card">
                <h3>
                  {handwritten && "✍️ "}
                  {voice && "🎙️ "}
                  {n.title || "Untitled"}
                </h3>

                {handwritten ? (
                  <HandwritingThumb strokesJson={n.strokesJson} />
                ) : (
                  <p className="note-snippet">
                    {voice && (
                      <span className="voice-length">
                        🎵 {formatClock((n.audioSeconds ?? 0) * 1000)}{" "}
                      </span>
                    )}
                    {n.content.slice(0, 140)}
                    {n.content.length > 140 && "…"}
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
          })}
        </div>
      )}
    </>
  );
}
