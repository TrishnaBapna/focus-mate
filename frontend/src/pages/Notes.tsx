import { useState } from "react";
import NewNoteChooser from "../components/NewNoteChooser";
import NoteCard from "../components/NoteCard";
import { useNotes } from "../hooks/useNotes";
import { useSubjects } from "../hooks/useSubjects";

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

      {chooserOpen && <NewNoteChooser onClose={() => setChooserOpen(false)} />}

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
          {filtered.map((n) => (
            <NoteCard key={n.id} note={n} />
          ))}
        </div>
      )}
    </>
  );
}
