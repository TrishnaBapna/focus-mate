import { useState } from "react";
import { Link } from "react-router-dom";
import { useNotes } from "../hooks/useNotes";
import { useSubjects } from "../hooks/useSubjects";

export default function Notes() {
  const { notes, loading } = useNotes();
  const { subjects } = useSubjects();
  const [search, setSearch] = useState("");
  const [subjectFilter, setSubjectFilter] = useState("all");

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
        <Link to="/notes/new" className="btn">
          + New note
        </Link>
      </div>

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
            return (
              <Link key={n.id} to={`/notes/${n.id}`} className="card note-card">
                <h3>{n.title || "Untitled"}</h3>
                <p className="note-snippet">
                  {n.content.slice(0, 140)}
                  {n.content.length > 140 && "…"}
                </p>
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
