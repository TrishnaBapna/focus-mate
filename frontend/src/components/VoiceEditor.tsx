import { useRef, useState } from "react";
import AiToolsPanel from "./AiToolsPanel";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { useAuth } from "../hooks/useAuth";
import { useRecorder } from "../hooks/useRecorder";
import { useSubjects } from "../hooks/useSubjects";
import { deleteMedia, saveMedia } from "../services/media";
import { addNote, deleteNote, updateNote } from "../services/notes";
import { formatClock } from "../utils/time";
import AudioPlayer from "./AudioPlayer";
import type { Note } from "../types";

const MAX_SECONDS = 180;

export default function VoiceEditor({ note }: { note?: Note }) {
  const { user } = useAuth();
  const { subjects } = useSubjects();
  const navigate = useNavigate();
  const [params] = useSearchParams();

  const [title, setTitle] = useState(note?.title ?? "");
  const [text, setText] = useState(note?.content ?? "");
  const [subjectId, setSubjectId] = useState(note?.subjectId ?? params.get("subject") ?? "");
  const [topic, setTopic] = useState(note?.topic ?? params.get("topic") ?? "");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  // Whatever was already in the text box when recording starts is kept,
  // and the live transcript is added after it.
  const baseTextRef = useRef("");
  const recorder = useRecorder(MAX_SECONDS, (transcript) => {
    const base = baseTextRef.current;
    setText(base ? `${base}\n${transcript}` : transcript);
  });

  const sessionId = note?.sessionId ?? params.get("session");
  const showOldAudio = !!note?.audioId && !recorder.result && !recorder.recording;

  function startRecording() {
    baseTextRef.current = text.trim();
    recorder.discard();
    void recorder.start();
  }

  async function handleSave() {
    if (!user) return;
    if (recorder.recording) {
      setError("Stop the recording first.");
      return;
    }
    if (!recorder.result && !note?.audioId) {
      setError("Record something first.");
      return;
    }

    setSaving(true);
    setError("");
    try {
      let audioId = note?.audioId ?? "";
      let audioMime = note?.audioMime ?? "";
      let audioSeconds = note?.audioSeconds ?? 0;
      const oldAudioId = note?.audioId;

      if (recorder.result) {
        audioId = await saveMedia(user.uid, recorder.result.blob);
        audioMime = recorder.result.blob.type;
        audioSeconds = recorder.result.seconds;
      }

      const subject = subjects.find((s) => s.id === subjectId);
      const data = {
        type: "voice" as const,
        title: title.trim() || "Voice note",
        content: text,
        audioId,
        audioMime,
        audioSeconds,
        subjectId,
        subjectName: subject?.name ?? note?.subjectName ?? "",
        subjectEmoji: subject?.emoji ?? note?.subjectEmoji ?? "",
        topic: topic.trim(),
        sessionId: sessionId ?? null,
      };

      if (note) await updateNote(user.uid, note.id, data);
      else await addNote(user.uid, data);

      // The old recording was replaced, so remove it
      if (recorder.result && oldAudioId) void deleteMedia(user.uid, oldAudioId);
      navigate("/notes");
    } catch (err) {
      console.error("Failed to save voice note", err);
      setError(
        err instanceof Error && err.message === "too-big"
          ? "That recording is too large to save. Try a shorter one."
          : "Couldn't save the note. Please try again."
      );
      setSaving(false);
    }
  }

  async function handleDelete() {
    if (!user || !note) return;
    if (!window.confirm("Delete this note and its recording?")) return;
    await deleteNote(user.uid, note.id);
    if (note.audioId) void deleteMedia(user.uid, note.audioId);
    navigate("/notes");
  }

  return (
    <div className="card note-editor">
      <Link to="/notes" className="link-btn back-link">
        ← Back to notes
      </Link>

      <input
        className="note-title-input"
        placeholder="Title (e.g. Static friction)"
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

      <div className="voice-recorder">
        {recorder.recording ? (
          <div className="recording-row">
            <span className="rec-dot" />
            <strong>{formatClock(recorder.seconds * 1000)}</strong>
            <span className="muted">/ {formatClock(MAX_SECONDS * 1000)}</span>
            <button className="btn" onClick={recorder.stop}>
              ⏹ Stop
            </button>
          </div>
        ) : recorder.result ? (
          <>
            <audio className="audio-el" controls src={recorder.result.url} />
            <button className="chip" onClick={startRecording}>
              🔄 Re-record
            </button>
          </>
        ) : showOldAudio && note?.audioId ? (
          <>
            <AudioPlayer audioId={note.audioId} />
            <button className="chip" onClick={startRecording}>
              🔄 Record again
            </button>
          </>
        ) : (
          <button className="record-btn" onClick={startRecording}>
            🎙️ Record
          </button>
        )}

        {recorder.error && <p className="auth-error">{recorder.error}</p>}
        <p className="muted voice-hint">
          Up to 3 minutes per note.{" "}
          {recorder.supportsSpeech
            ? "Your words appear as text below while you speak. You can edit them."
            : "This browser can't transcribe live, but you can type the text below."}
        </p>
      </div>

      <textarea
        className="note-body voice-text"
        placeholder="Transcript / notes…"
        value={text}
        onChange={(e) => setText(e.target.value)}
      />

      <AiToolsPanel
        text={text}
        onInsert={(t) => setText((c) => (c ? c + "\n\n" : "") + t)}
      />

      {error && <p className="auth-error">{error}</p>}

      <div className="focus-controls">
        <button className="btn" onClick={handleSave} disabled={saving || recorder.recording}>
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
