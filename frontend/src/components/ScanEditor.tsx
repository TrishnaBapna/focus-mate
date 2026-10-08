import { useEffect, useRef, useState, type ChangeEvent } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { useAuth } from "../hooks/useAuth";
import { useMediaUrl } from "../hooks/useMediaUrl";
import { useSubjects } from "../hooks/useSubjects";
import { deleteMedia, saveMedia } from "../services/media";
import { addNote, deleteNote, updateNote } from "../services/notes";
import { prepareImage } from "../utils/image";
import { OCR_LANGUAGES, recognizeText } from "../utils/ocr";
import type { Note } from "../types";

interface NewImage {
  blob: Blob;
  url: string;
  thumb: string;
}

export default function ScanEditor({ note }: { note?: Note }) {
  const { user } = useAuth();
  const { subjects } = useSubjects();
  const navigate = useNavigate();
  const [params] = useSearchParams();

  const [title, setTitle] = useState(note?.title ?? "");
  const [text, setText] = useState(note?.content ?? "");
  const [subjectId, setSubjectId] = useState(note?.subjectId ?? params.get("subject") ?? "");
  const [topic, setTopic] = useState(note?.topic ?? params.get("topic") ?? "");
  const [image, setImage] = useState<NewImage | null>(null);
  const [lang, setLang] = useState("eng");
  const [ocr, setOcr] = useState<"idle" | "working" | "done" | "error">("idle");
  const [progress, setProgress] = useState(0);
  const [preparing, setPreparing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const stored = useMediaUrl(note?.imageId);
  const cameraRef = useRef<HTMLInputElement>(null);
  const uploadRef = useRef<HTMLInputElement>(null);

  const sessionId = note?.sessionId ?? params.get("session");
  const shownUrl = image?.url ?? stored.url;
  const busy = preparing || ocr === "working";

  // Free the preview URL when the photo is replaced or the page is left
  useEffect(() => {
    return () => {
      if (image) URL.revokeObjectURL(image.url);
    };
  }, [image]);

  async function runOcr(blob: Blob) {
    setOcr("working");
    setProgress(0);
    try {
      const result = await recognizeText(blob, lang, setProgress);
      setText(result.trim());
      setOcr("done");
    } catch (err) {
      console.error("OCR failed", err);
      setOcr("error");
    }
  }

  async function handleFile(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = ""; // lets you pick the same file again later
    if (!file) return;

    setError("");
    setPreparing(true);
    try {
      const prepared = await prepareImage(file);
      setImage({
        blob: prepared.blob,
        url: URL.createObjectURL(prepared.blob),
        thumb: prepared.thumb,
      });
      setPreparing(false);
      void runOcr(prepared.blob);
    } catch (err) {
      console.error("Image preparation failed", err);
      setError("Couldn't read that image. Try another photo.");
      setPreparing(false);
    }
  }

  async function rereadText() {
    try {
      let blob = image?.blob;
      if (!blob && stored.url) blob = await (await fetch(stored.url)).blob();
      if (blob) void runOcr(blob);
    } catch {
      setOcr("error");
    }
  }

  async function handleSave() {
    if (!user) return;
    if (!image && !note?.imageId) {
      setError("Add a photo first.");
      return;
    }
    if (ocr === "working") {
      setError("Wait for the text to finish loading.");
      return;
    }

    setSaving(true);
    setError("");
    try {
      let imageId = note?.imageId ?? "";
      let imageMime = note?.imageMime ?? "";
      let thumb = note?.thumb ?? "";
      const oldImageId = note?.imageId;

      if (image) {
        imageId = await saveMedia(user.uid, image.blob);
        imageMime = image.blob.type;
        thumb = image.thumb;
      }

      const subject = subjects.find((s) => s.id === subjectId);
      const data = {
        type: "scan" as const,
        title: title.trim() || "Scanned note",
        content: text,
        imageId,
        imageMime,
        thumb,
        subjectId,
        subjectName: subject?.name ?? note?.subjectName ?? "",
        subjectEmoji: subject?.emoji ?? note?.subjectEmoji ?? "",
        topic: topic.trim(),
        sessionId: sessionId ?? null,
      };

      if (note) await updateNote(user.uid, note.id, data);
      else await addNote(user.uid, data);

      // The old photo was replaced, so remove it
      if (image && oldImageId) void deleteMedia(user.uid, oldImageId);
      navigate("/notes");
    } catch (err) {
      console.error("Failed to save scanned note", err);
      setError(
        err instanceof Error && err.message === "too-big"
          ? "That photo is too large to save. Try a smaller or simpler one."
          : "Couldn't save the note. Please try again."
      );
      setSaving(false);
    }
  }

  async function handleDelete() {
    if (!user || !note) return;
    if (!window.confirm("Delete this note and its photo?")) return;
    await deleteNote(user.uid, note.id);
    if (note.imageId) void deleteMedia(user.uid, note.imageId);
    navigate("/notes");
  }

  return (
    <div className="card note-editor">
      <Link to="/notes" className="link-btn back-link">
        ← Back to notes
      </Link>

      <input
        className="note-title-input"
        placeholder="Title (e.g. Friction, textbook p. 42)"
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

      <div className="scan-actions">
        <input
          ref={cameraRef}
          type="file"
          accept="image/*"
          capture="environment"
          hidden
          onChange={handleFile}
        />
        <input ref={uploadRef} type="file" accept="image/*" hidden onChange={handleFile} />

        <button className="btn" onClick={() => cameraRef.current?.click()} disabled={busy}>
          📷 Take photo
        </button>
        <button className="btn secondary" onClick={() => uploadRef.current?.click()} disabled={busy}>
          🖼️ Upload image
        </button>
        <label className="lang-select">
          Text language
          <select value={lang} onChange={(e) => setLang(e.target.value)} disabled={busy}>
            {OCR_LANGUAGES.map((l) => (
              <option key={l.code} value={l.code}>
                {l.label}
              </option>
            ))}
          </select>
        </label>
      </div>

      {preparing && <p className="muted">Preparing your photo…</p>}

      {shownUrl && <img className="scan-image" src={shownUrl} alt="Scanned note" />}

      {ocr === "working" && (
        <div>
          <div className="progress">
            <div className="progress-fill" style={{ width: `${Math.round(progress * 100)}%` }} />
          </div>
          <p className="muted">
            Reading text… {Math.round(progress * 100)}% (the first time, it downloads language data)
          </p>
        </div>
      )}
      {ocr === "error" && (
        <p className="auth-error">Couldn't read the text (are you online?). You can type it instead.</p>
      )}

      {shownUrl && !busy && (
        <button className="chip align-start" onClick={rereadText}>
          🔍 Read text again
        </button>
      )}

      <textarea
        className="note-body voice-text"
        placeholder="The text from your scan appears here. Edit it freely."
        value={text}
        onChange={(e) => setText(e.target.value)}
      />
      <p className="muted voice-hint">
        Works best on printed text. Handwriting is hit and miss, so check the result.
      </p>

      {error && <p className="auth-error">{error}</p>}

      <div className="focus-controls">
        <button className="btn" onClick={handleSave} disabled={saving || busy}>
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
