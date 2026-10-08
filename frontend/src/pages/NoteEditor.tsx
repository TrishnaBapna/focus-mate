import { Link, useParams, useSearchParams } from "react-router-dom";
import HandwrittenEditor from "../components/HandwrittenEditor";
import ScanEditor from "../components/ScanEditor";
import TypedEditor from "../components/TypedEditor";
import VoiceEditor from "../components/VoiceEditor";
import { useNotes } from "../hooks/useNotes";

// Opens the right editor for the kind of note
export default function NoteEditor() {
  const { id } = useParams();
  const [params] = useSearchParams();
  const { notes, loading } = useNotes();
  const isNew = id === "new";
  const note = isNew ? undefined : notes.find((n) => n.id === id);

  if (!isNew && loading) return <p>Loading…</p>;
  if (!isNew && !note) {
    return (
      <section className="card">
        <p>Note not found.</p>
        <Link to="/notes">← Back to notes</Link>
      </section>
    );
  }

  const kind = note ? (note.type ?? "typed") : (params.get("type") ?? "typed");
  const key = note?.id ?? "new";

  if (kind === "handwritten") return <HandwrittenEditor key={key} note={note} />;
  if (kind === "voice") return <VoiceEditor key={key} note={note} />;
  if (kind === "scan") return <ScanEditor key={key} note={note} />;
  return <TypedEditor key={key} note={note} />;
}
