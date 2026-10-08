import { useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { useAuth } from "../hooks/useAuth";
import { useSubjects } from "../hooks/useSubjects";
import { addNote, deleteNote, updateNote } from "../services/notes";
import type { Note } from "../types";

export default function TypedEditor({ note }: { note?: Note }) {
  const { user } = useAuth();
  const { subjects } = useSubjects();
  const navigate = useNavigate();
  const [params] = useSearchParams();

  const [title, setTitle] = useState(note?.title ?? "");
  const [content, setContent] = useState(note?.content ?? "");
  const [subjectId, setSubjectId] = useState(note?.subjectId ?? params.get("subject") ?? "");
  const [topic, setTopic] = useState(note?.topic ?? params.get("topic") ?? "");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const sessionId = note?.sessionId ?? params.get("session");

  async function handleSave() {
    if (!user) return;
    if (!title.trim() && !content.trim()) {
      setError("Add a title or some text first.");
      return;
    }

    const subject = subjects.find((s) => s.id === subjectId);
    const data = {
      type: "typed" as const,
      title: title.trim(),
      content,
      subjectId,
      subjectName: subject?.name ?? note?.subjectName ?? "",
      subjectEmoji: subject?.emoji ?? note?.subjectEmoji ?? "",
      topic: topic.trim(),
      sessionId: sessionId ?? null,
    };

    setSaving(true);
    setError("");
    try {
      if (note) await updateNote(user.uid, note.id, data);
      else await addNote(user.uid, data);
      navigate("/notes");
    } catch (err) {
      console.error("Failed to save note", err);
      setError("Couldn't save the note. Please try again.");
      setSaving(false);
    }
  }

  async function handleDelete() {
    if (!user || !note) return;
    if (!window.confirm("Delete this note?")) return;
    await deleteNote(user.uid, note.id);
    navigate("/notes");
  }

  return (
    <div className="card note-editor">
      <Link to="/notes" className="link-btn back-link">
        ← Back to notes
      </Link>

      <input
        className="note-title-input"
        placeholder="Title"
        value={title}
        onChange={(e) => setTitle(e.target.value)}
      />

      <div className="note-fields">
        <select value={subjectId} onChange={(e) => setSubjectId(e.target.value)}>
          <option value="">No subject</option>
          {subjects.map((s) => (
            <option key={s.id} value={s.id}>
              {s.emoji} {s.name}
            </option>
          ))}
        </select>
        <input
          placeholder="Topic (e.g. Friction)"
          value={topic}
          onChange={(e) => setTopic(e.target.value)}
        />
      </div>

      {sessionId && <p className="muted">🔗 Linked to a focus session</p>}

      <textarea
        className="note-body"
        placeholder="Start writing…"
        value={content}
        onChange={(e) => setContent(e.target.value)}
      />

      {error && <p className="auth-error">{error}</p>}

      <div className="focus-controls">
        <button className="btn" onClick={handleSave} disabled={saving}>
          {saving ? "Saving…" : "Save note"}
        </button>
        {note && (
          <button className="link-btn danger" onClick={handleDelete}>
            Delete
          </button>
        )}
      </div>
    </div>
  );
}
