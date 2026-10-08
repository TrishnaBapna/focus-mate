import { useEffect, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { useAuth } from "../hooks/useAuth";
import { useSubjects } from "../hooks/useSubjects";
import { addNote, deleteNote, updateNote } from "../services/notes";
import { parseStrokes, serializeStrokes, type Stroke } from "../utils/drawing";
import DrawingCanvas, { type Tool } from "./DrawingCanvas";
import type { Note } from "../types";

const COLORS = ["#2b2b2b", "#2a5bd7", "#d64545", "#2f9e57", "#ff7a3d"];
const WIDTHS = [
  { label: "Thin", value: 2 },
  { label: "Medium", value: 4 },
  { label: "Thick", value: 9 },
];
const MAX_JSON_CHARS = 900000; // Firestore documents are limited to about 1 MB

export default function HandwrittenEditor({ note }: { note?: Note }) {
  const { user } = useAuth();
  const { subjects } = useSubjects();
  const navigate = useNavigate();
  const [params] = useSearchParams();

  const [title, setTitle] = useState(note?.title ?? "");
  const [subjectId, setSubjectId] = useState(note?.subjectId ?? params.get("subject") ?? "");
  const [topic, setTopic] = useState(note?.topic ?? params.get("topic") ?? "");
  const [strokes, setStrokes] = useState<Stroke[]>(() => parseStrokes(note?.strokesJson));
  const [redo, setRedo] = useState<Stroke[]>([]);
  const [tool, setTool] = useState<Tool>("pen");
  const [color, setColor] = useState(COLORS[0]);
  const [width, setWidth] = useState(4);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const sessionId = note?.sessionId ?? params.get("session");

  function commit(stroke: Stroke) {
    setStrokes((prev) => [...prev, stroke]);
    setRedo([]);
  }

  function undo() {
    if (strokes.length === 0) return;
    setRedo([...redo, strokes[strokes.length - 1]]);
    setStrokes(strokes.slice(0, -1));
  }

  function redoStroke() {
    if (redo.length === 0) return;
    setStrokes([...strokes, redo[redo.length - 1]]);
    setRedo(redo.slice(0, -1));
  }

  function clearPage() {
    if (strokes.length === 0) return;
    if (window.confirm("Clear the whole page?")) {
      setStrokes([]);
      setRedo([]);
    }
  }

  // Cmd/Ctrl+Z = undo, Cmd/Ctrl+Shift+Z = redo
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (!(e.metaKey || e.ctrlKey) || e.key.toLowerCase() !== "z") return;
      const tag = (e.target as HTMLElement).tagName;
      if (tag === "INPUT" || tag === "SELECT") return;
      e.preventDefault();
      if (e.shiftKey) redoStroke();
      else undo();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  async function handleSave() {
    if (!user) return;
    if (!title.trim() && strokes.length === 0) {
      setError("Write something or add a title first.");
      return;
    }
    const json = serializeStrokes(strokes);
    if (json.length > MAX_JSON_CHARS) {
      setError("This page is too full to save. Clear some of it, or start a new note.");
      return;
    }

    const subject = subjects.find((s) => s.id === subjectId);
    const data = {
      type: "handwritten" as const,
      title: title.trim(),
      content: "",
      strokesJson: json,
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
          placeholder="Topic (e.g. Integration)"
          value={topic}
          onChange={(e) => setTopic(e.target.value)}
        />
      </div>

      {sessionId && <p className="muted">🔗 Linked to a focus session</p>}

      <div className="draw-toolbar">
        <div className="tool-group">
          <button
            className={`chip ${tool === "pen" ? "selected" : ""}`}
            onClick={() => setTool("pen")}
          >
            ✏️ Pen
          </button>
          <button
            className={`chip ${tool === "eraser" ? "selected" : ""}`}
            onClick={() => setTool("eraser")}
          >
            🧽 Eraser
          </button>
          <button
            className={`chip ${tool === "hand" ? "selected" : ""}`}
            onClick={() => setTool("hand")}
            title="Scroll the page without drawing"
          >
            ✋ Scroll
          </button>
        </div>

        <div className="tool-group">
          {COLORS.map((c) => (
            <button
              key={c}
              className={`swatch ${tool === "pen" && c === color ? "selected" : ""}`}
              style={{ background: c }}
              onClick={() => {
                setColor(c);
                setTool("pen");
              }}
              aria-label={`Pen colour ${c}`}
            />
          ))}
        </div>

        <div className="tool-group">
          {WIDTHS.map((w) => (
            <button
              key={w.value}
              className={`chip ${width === w.value ? "selected" : ""}`}
              onClick={() => setWidth(w.value)}
            >
              {w.label}
            </button>
          ))}
        </div>

        <div className="tool-group">
          <button className="chip" onClick={undo} disabled={strokes.length === 0} title="Undo">
            ↶ Undo
          </button>
          <button className="chip" onClick={redoStroke} disabled={redo.length === 0} title="Redo">
            ↷ Redo
          </button>
          <button className="chip" onClick={clearPage} disabled={strokes.length === 0}>
            🗑 Clear
          </button>
        </div>
      </div>

      <DrawingCanvas strokes={strokes} tool={tool} color={color} width={width} onCommit={commit} />

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
