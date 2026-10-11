import { useEffect, useRef, useState, type ChangeEvent } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { useAuth } from "../hooks/useAuth";
import { useMediaUrl } from "../hooks/useMediaUrl";
import { useSubjects } from "../hooks/useSubjects";
import { deleteMedia, loadMedia, saveMedia } from "../services/media";
import { addNote, deleteNote, updateNote } from "../services/notes";
import { newId } from "../utils/exams";
import { OCR_LANGUAGES, recognizePages } from "../utils/ocr";
import { preparePhoto, rotatePage } from "../utils/pages";
import { importPdf } from "../utils/pdf";
import { tidyText } from "../utils/tidy";
import type { Note } from "../types";
import AiToolsPanel from "./AiToolsPanel";

const MAX_PAGES = 40;
const MAX_DOC_CHARS = 900000; // a note must stay under Firestore's ~1 MB limit


interface DraftPage {
  key: string;
  blob?: Blob;
  url?: string;
  imageId?: string;
  pages?: { imageId: string; thumb?: string }[];
  imageMime?: string;
  thumb: string;
  text?: string;
  fromPdfText?: boolean;
}

function draftsFromNote(note?: Note): DraftPage[] {
  if (!note) return [];
  if (note.pages && note.pages.length > 0) {
    return note.pages.map((p) => ({ key: newId(), imageId: p.imageId, thumb: p.thumb ?? "" }));
  }
  if (note.imageId) return [{ key: newId(), imageId: note.imageId, thumb: note.thumb ?? "" }];
  return [];
}

function combinePages(texts: string[]) {
  if (texts.length === 1) return texts[0].trim();
  return texts.map((t, i) => `— Page ${i + 1} —\n${t.trim()}`).join("\n\n");
}

function PagePreview({ page }: { page: DraftPage }) {
  const stored = useMediaUrl(page.url ? undefined : page.imageId);
  const src = page.url ?? stored.url;
  if (!src) return <p className="muted">Loading page…</p>;
  return <img className="scan-image" src={src} alt="Page preview" />;
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
  const [pages, setPages] = useState<DraftPage[]>(() => draftsFromNote(note));
  const [enhance, setEnhance] = useState(true);
  const [lang, setLang] = useState("eng");
  const [status, setStatus] = useState("");
  const [working, setWorking] = useState(false);
  const [previewKey, setPreviewKey] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const stopRef = useRef(false);
  const urlsRef = useRef<string[]>([]);
  const cameraRef = useRef<HTMLInputElement>(null);
  const photosRef = useRef<HTMLInputElement>(null);
  const pdfRef = useRef<HTMLInputElement>(null);

  const sessionId = note?.sessionId ?? params.get("session");
  const busy = working || saving;
  const previewPage = pages.find((p) => p.key === previewKey);

  // Free the preview images when the page is left
  useEffect(() => {
    const urls = urlsRef.current;
    return () => urls.forEach((u) => URL.revokeObjectURL(u));
  }, []);

  function makeDraft(blob: Blob, thumb: string, pdfText?: string): DraftPage {
    const url = URL.createObjectURL(blob);
    urlsRef.current.push(url);
    const hasText = !!pdfText && pdfText.trim().length >= 40;
    return {
      key: newId(),
      blob,
      url,
      thumb,
      text: hasText ? pdfText : undefined,
      fromPdfText: hasText,
    };
  }

  async function addFiles(e: ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? []);
    e.target.value = "";
    if (files.length === 0) return;

    setError("");
    setWorking(true);
    const added: DraftPage[] = [];
    let room = MAX_PAGES - pages.length;

    try {
      for (const file of files) {
        if (room <= 0) {
          setError(`A document can have up to ${MAX_PAGES} pages, so some files were skipped.`);
          break;
        }

        if (file.type === "application/pdf" || file.name.toLowerCase().endsWith(".pdf")) {
          setStatus(`Opening ${file.name}…`);
          const result = await importPdf(file, enhance, room, (done, total) =>
            setStatus(`Preparing PDF page ${Math.min(done + 1, total)} of ${total}…`)
          );
          for (const p of result.pages) added.push(makeDraft(p.blob, p.thumb, p.text));
          room -= result.pages.length;
          if (result.totalPages > result.pages.length) {
            setError(`Only the first ${result.pages.length} pages of that PDF were added (the limit is ${MAX_PAGES}).`);
          }
        } else {
          setStatus(`Preparing photo ${added.length + 1}…`);
          const prepared = await preparePhoto(file, enhance);
          added.push(makeDraft(prepared.blob, prepared.thumb));
          room -= 1;
        }
      }
    } catch (err) {
      console.error("Adding pages failed", err);
      setError("Couldn't read one of those files. Try again, or use a different file.");
    } finally {
      if (added.length > 0) {
        setPages((prev) => [...prev, ...added]);
        // A text-based PDF can fill in the text straight away
        if (!text.trim() && added.some((p) => p.fromPdfText)) {
          setText(combinePages(added.map((p) => p.text ?? "")));
        }
      }
      setWorking(false);
      setStatus("");
    }
  }

  async function rotate(key: string) {
    const page = pages.find((p) => p.key === key);
    if (!page || !user) return;
    setError("");
    setWorking(true);
    setStatus("Rotating…");
    try {
      const blob = page.blob ?? (page.imageId ? await loadMedia(user.uid, page.imageId) : null);
      if (!blob) throw new Error("missing");
      const rotated = await rotatePage(blob);
      const url = URL.createObjectURL(rotated.blob);
      urlsRef.current.push(url);
      if (page.url) URL.revokeObjectURL(page.url);
      // The rotated page is saved as a new image; its text needs reading again
      setPages((prev) =>
        prev.map((p) => (p.key === key ? { key, blob: rotated.blob, url, thumb: rotated.thumb } : p))
      );
    } catch (err) {
      console.error("Rotate failed", err);
      setError("Couldn't rotate that page.");
    } finally {
      setWorking(false);
      setStatus("");
    }
  }

  function move(key: string, delta: number) {
    setPages((prev) => {
      const i = prev.findIndex((p) => p.key === key);
      const j = i + delta;
      if (i < 0 || j < 0 || j >= prev.length) return prev;
      const next = [...prev];
      [next[i], next[j]] = [next[j], next[i]];
      return next;
    });
  }

  function remove(key: string) {
    const page = pages.find((p) => p.key === key);
    if (page?.url) URL.revokeObjectURL(page.url);
    setPages((prev) => prev.filter((p) => p.key !== key));
    if (previewKey === key) setPreviewKey(null);
  }

  async function readText() {
    if (!user || pages.length === 0) return;
    setError("");
    setWorking(true);
    stopRef.current = false;

    try {
      const images: (Blob | null)[] = [];
      for (let i = 0; i < pages.length; i++) {
        const p = pages[i];
        if (p.fromPdfText) {
          images.push(null); // already has real text, no OCR needed
          continue;
        }
        setStatus(`Loading page ${i + 1} of ${pages.length}…`);
        images.push(p.blob ?? (p.imageId ? await loadMedia(user.uid, p.imageId) : null));
      }

      const results = await recognizePages(
        images,
        lang,
        (pageIndex, fraction) =>
          setStatus(`Reading page ${pageIndex + 1} of ${pages.length} (${Math.round(fraction * 100)}%)…`),
        () => stopRef.current
      );

      const updated = pages.map((p, i) => {
        const r = results[i];
        return typeof r === "string" ? { ...p, text: r } : p;
      });
      setPages(updated);
      setText(combinePages(updated.map((p) => p.text ?? "")));
      if (stopRef.current) setError("Stopped. The pages read so far are included.");
    } catch (err) {
      console.error("OCR failed", err);
      setError("Couldn't read the text. Are you online? The first time, it downloads language data.");
    } finally {
      setWorking(false);
      setStatus("");
    }
  }

  async function handleSave() {
    if (!user) return;
    if (pages.length === 0) {
      setError("Add at least one page first.");
      return;
    }
    if (working) {
      setError("Wait for the current step to finish.");
      return;
    }

    const estimate = text.length + pages.reduce((n, p) => n + p.thumb.length + 60, 0);
    if (estimate > MAX_DOC_CHARS) {
      setError("This document's text is too long to save in one note. Remove some pages or text.");
      return;
    }

    setSaving(true);
    setError("");
    const savedNow: string[] = [];

    try {
      const out: { imageId: string; thumb: string }[] = [];
      for (let i = 0; i < pages.length; i++) {
        const p = pages[i];
        if (p.imageId) {
          out.push({ imageId: p.imageId, thumb: p.thumb ?? "" });
          continue;
        }
        if (!p.blob) continue;
        setStatus(`Saving page ${i + 1} of ${pages.length}…`);
        const id = await saveMedia(user.uid, p.blob);
        savedNow.push(id);
        out.push({ imageId: id, thumb: p.thumb ?? "" });
      }

      const subject = subjects.find((s) => s.id === subjectId);
      const data = {
        type: "scan" as const,
        title: title.trim() || "Scanned document",
        content: text,
        imageId: out[0].imageId, // the first page doubles as the cover
        imageMime: "image/jpeg",
        thumb: out[0].thumb,
        pages: out,
        subjectId,
        subjectName: subject?.name ?? note?.subjectName ?? "",
        subjectEmoji: subject?.emoji ?? note?.subjectEmoji ?? "",
        topic: topic.trim(),
        sessionId: sessionId ?? null,
      };

      if (note) await updateNote(user.uid, note.id, data);
      else await addNote(user.uid, data);

      // Remove page images that are no longer part of the note
      const kept = new Set(out.map((p) => p.imageId));
      const oldIds = note
        ? note.pages && note.pages.length > 0
          ? note.pages.map((p) => p.imageId)
          : note.imageId
            ? [note.imageId]
            : []
        : [];
      oldIds.filter((id) => !kept.has(id)).forEach((id) => void deleteMedia(user.uid, id));

      navigate("/notes");
    } catch (err) {
      console.error("Failed to save scanned document", err);
      savedNow.forEach((id) => void deleteMedia(user.uid, id)); // clean up a half-finished save
      setError(
        err instanceof Error && err.message === "too-big"
          ? "One of the pages is too large to save. Try removing it."
          : "Couldn't save the document. Please try again."
      );
      setSaving(false);
      setStatus("");
    }
  }

  async function handleDelete() {
    if (!user || !note) return;
    if (!window.confirm("Delete this note and all of its pages?")) return;
    await deleteNote(user.uid, note.id);
    const ids =
      note.pages && note.pages.length > 0 ? note.pages.map((p) => p.imageId) : note.imageId ? [note.imageId] : [];
    ids.forEach((id) => void deleteMedia(user.uid, id));
    navigate("/notes");
  }

  return (
    <div className="card note-editor">
      <Link to="/notes" className="link-btn back-link">
        ← Back to notes
      </Link>

      <input
        className="note-title-input"
        placeholder="Title (e.g. Physics chapter 4)"
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
          onChange={addFiles}
        />
        <input ref={photosRef} type="file" accept="image/*" multiple hidden onChange={addFiles} />
        <input ref={pdfRef} type="file" accept="application/pdf,.pdf" hidden onChange={addFiles} />

        <button className="btn" onClick={() => cameraRef.current?.click()} disabled={busy}>
          📷 Take photo
        </button>
        <button className="btn secondary" onClick={() => photosRef.current?.click()} disabled={busy}>
          🖼️ Add photos
        </button>
        <button className="btn secondary" onClick={() => pdfRef.current?.click()} disabled={busy}>
          📄 Add PDF
        </button>
      </div>

      <div className="scan-actions">
        <label className="enhance-toggle">
          <input
            type="checkbox"
            checked={enhance}
            onChange={(e) => setEnhance(e.target.checked)}
            disabled={busy}
          />
          Clean up pages (sharper text)
        </label>
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

      {status && <p className="muted ocr-status">{status}</p>}

      {pages.length > 0 && (
        <>
          <p className="muted">
            {pages.length} page{pages.length === 1 ? "" : "s"} (up to {MAX_PAGES}). Tap a page to
            preview it.
          </p>
          <div className="pages-grid">
            {pages.map((p, i) => (
              <div key={p.key} className="page-tile">
                <span className="page-num">{i + 1}</span>
                <img
                  className="page-thumb"
                  src={p.thumb}
                  alt={`Page ${i + 1}`}
                  onClick={() => setPreviewKey(previewKey === p.key ? null : p.key)}
                />
                <div className="page-actions">
                  <button className="mini-btn" title="Move earlier" disabled={busy || i === 0} onClick={() => move(p.key, -1)}>
                    ◀
                  </button>
                  <button className="mini-btn" title="Rotate" disabled={busy} onClick={() => void rotate(p.key)}>
                    ↻
                  </button>
                  <button className="mini-btn" title="Move later" disabled={busy || i === pages.length - 1} onClick={() => move(p.key, 1)}>
                    ▶
                  </button>
                  <button className="mini-btn" title="Remove" disabled={busy} onClick={() => remove(p.key)}>
                    ✕
                  </button>
                </div>
              </div>
            ))}
          </div>

          {previewPage && <PagePreview page={previewPage} />}

          <div className="scan-actions">
            {working && status.startsWith("Reading") ? (
              <button className="btn secondary" onClick={() => (stopRef.current = true)}>
                ⏹ Stop reading
              </button>
            ) : (
              <button className="btn" onClick={() => void readText()} disabled={busy}>
                🔍 Read text from all pages
              </button>
            )}
            <button className="btn secondary" onClick={() => setText((t) => tidyText(t))} disabled={busy || !text.trim()}>
              ✨ Tidy text
            </button>
          </div>
        </>
      )}

      <textarea
        className="note-body voice-text"
        placeholder="The text from your pages appears here. Edit it freely."
        value={text}
        onChange={(e) => setText(e.target.value)}
      />
      <p className="muted voice-hint">
        Works best on printed text; handwriting is hit and miss. Summaries, quizzes, and flashcards
        below use the whole document.
      </p>

      <AiToolsPanel
        text={text}
        onInsert={(t) => setText((c) => (c ? c + "\n\n" : "") + t)}
      />

      {error && <p className="auth-error">{error}</p>}

      <div className="focus-controls">
        <button className="btn" onClick={() => void handleSave()} disabled={busy}>
          {saving ? "Saving…" : "Save note"}
        </button>
        {note && (
          <button className="link-btn danger" onClick={() => void handleDelete()} disabled={busy}>
            Delete
          </button>
        )}
      </div>
    </div>
  );
}