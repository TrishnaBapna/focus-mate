import { useState } from "react";
import NewNoteChooser from "../components/NewNoteChooser";
import NoteCard from "../components/NoteCard";
import { useAuth } from "../hooks/useAuth";
import { useFolders } from "../hooks/useFolders";
import { useNotes } from "../hooks/useNotes";
import { useSubjects } from "../hooks/useSubjects";
import { addFolder, deleteFolder, moveNoteToFolder, renameFolder } from "../services/folders";
import type { Note, NoteFolder } from "../types";

export default function Notes() {
  const { user } = useAuth();
  const { notes, loading: notesLoading } = useNotes();
  const { subjects } = useSubjects();
  const { folders, loading: foldersLoading } = useFolders();

  const [search, setSearch] = useState("");
  const [selectedFolder, setSelectedFolder] = useState<string>("all");
  const [subjectFilter, setSubjectFilter] = useState("all");
  const [chooserOpen, setChooserOpen] = useState(false);

  // Folder modal states
  const [folderModalMode, setFolderModalMode] = useState<"create" | "rename" | "delete" | null>(null);
  const [targetFolder, setTargetFolder] = useState<NoteFolder | null>(null);
  const [folderNameInput, setFolderNameInput] = useState("");
  const [folderModalError, setFolderModalError] = useState("");
  const [folderSubmitting, setFolderSubmitting] = useState(false);

  // Quick move note modal state
  const [movingNote, setMovingNote] = useState<Note | null>(null);

  // Active folder object if a custom folder is selected
  const activeFolder = folders.find((f) => f.id === selectedFolder);

  // Note counts per category
  const allNotesCount = notes.length;
  const unfiledCount = notes.filter((n) => !n.folderId).length;
  const folderCounts = new Map<string, number>();
  for (const n of notes) {
    if (n.folderId) {
      folderCounts.set(n.folderId, (folderCounts.get(n.folderId) ?? 0) + 1);
    }
  }

  // Filter notes
  const term = search.trim().toLowerCase();
  const filtered = notes.filter((n) => {
    // 1. Folder filter
    let matchesFolder = true;
    if (selectedFolder === "unfiled") {
      matchesFolder = !n.folderId;
    } else if (selectedFolder !== "all") {
      matchesFolder = n.folderId === selectedFolder;
    }

    // 2. Subject filter (independent)
    const matchesSubject = subjectFilter === "all" || n.subjectId === subjectFilter;

    // 3. Search filter
    const matchesSearch =
      !term ||
      `${n.title} ${n.content} ${n.topic} ${n.subjectName}`.toLowerCase().includes(term);

    return matchesFolder && matchesSubject && matchesSearch;
  });

  // Folder CRUD handlers
  function openCreateFolder() {
    setFolderNameInput("");
    setFolderModalError("");
    setFolderModalMode("create");
  }

  async function handleCreateFolder() {
    if (!user) return;
    const clean = folderNameInput.trim();
    if (!clean) {
      setFolderModalError("Please enter a folder name.");
      return;
    }
    setFolderSubmitting(true);
    setFolderModalError("");
    try {
      const newId = await addFolder(user.uid, clean);
      setSelectedFolder(newId);
      setFolderModalMode(null);
    } catch (err) {
      console.error(err);
      setFolderModalError("Failed to create folder. Please try again.");
    } finally {
      setFolderSubmitting(false);
    }
  }

  function openRenameFolder(folder: NoteFolder) {
    setTargetFolder(folder);
    setFolderNameInput(folder.name);
    setFolderModalError("");
    setFolderModalMode("rename");
  }

  async function handleRenameFolder() {
    if (!user || !targetFolder) return;
    const clean = folderNameInput.trim();
    if (!clean) {
      setFolderModalError("Please enter a folder name.");
      return;
    }
    setFolderSubmitting(true);
    setFolderModalError("");
    try {
      await renameFolder(user.uid, targetFolder.id, clean);
      setFolderModalMode(null);
    } catch (err) {
      console.error(err);
      setFolderModalError("Failed to rename folder. Please try again.");
    } finally {
      setFolderSubmitting(false);
    }
  }

  function openDeleteFolder(folder: NoteFolder) {
    setTargetFolder(folder);
    setFolderModalError("");
    setFolderModalMode("delete");
  }

  async function handleDeleteFolder() {
    if (!user || !targetFolder) return;
    setFolderSubmitting(true);
    setFolderModalError("");
    try {
      await deleteFolder(user.uid, targetFolder.id);
      if (selectedFolder === targetFolder.id) {
        setSelectedFolder("all");
      }
      setFolderModalMode(null);
    } catch (err) {
      console.error(err);
      setFolderModalError("Failed to delete folder. Please try again.");
    } finally {
      setFolderSubmitting(false);
    }
  }

  // Quick move handler
  async function handleMoveNote(targetFolderId: string | null) {
    if (!user || !movingNote) return;
    const destFolder = folders.find((f) => f.id === targetFolderId);
    try {
      await moveNoteToFolder(
        user.uid,
        movingNote.id,
        targetFolderId,
        destFolder?.name ?? ""
      );
      setMovingNote(null);
    } catch (err) {
      console.error("Failed to move note:", err);
    }
  }

  const isLoading = notesLoading || foldersLoading;

  return (
    <>
      <div className="notes-header">
        <h1>Notes 📝</h1>
        <button className="btn" onClick={() => setChooserOpen(true)}>
          + New note
        </button>
      </div>

      {chooserOpen && (
        <NewNoteChooser
          folderId={activeFolder?.id}
          onClose={() => setChooserOpen(false)}
        />
      )}

      {/* Folders navigation toolbar */}
      <div className="folders-bar-wrap">
        <div className="folders-bar">
          <button
            type="button"
            className={`folder-chip ${selectedFolder === "all" ? "active" : ""}`}
            onClick={() => setSelectedFolder("all")}
          >
            <span className="folder-icon">📚</span>
            <span className="folder-name">All Notes</span>
            <span className="folder-count">{allNotesCount}</span>
          </button>

          <button
            type="button"
            className={`folder-chip ${selectedFolder === "unfiled" ? "active" : ""}`}
            onClick={() => setSelectedFolder("unfiled")}
          >
            <span className="folder-icon">📂</span>
            <span className="folder-name">Unfiled</span>
            <span className="folder-count">{unfiledCount}</span>
          </button>

          {folders.map((f) => (
            <button
              key={f.id}
              type="button"
              className={`folder-chip ${selectedFolder === f.id ? "active" : ""}`}
              onClick={() => setSelectedFolder(f.id)}
            >
              <span className="folder-icon">📁</span>
              <span className="folder-name">{f.name}</span>
              <span className="folder-count">{folderCounts.get(f.id) ?? 0}</span>
            </button>
          ))}

          <button
            type="button"
            className="folder-add-btn"
            onClick={openCreateFolder}
            title="Create new folder"
          >
            + New folder
          </button>
        </div>

        {/* Selected custom folder banner with rename & safe delete */}
        {activeFolder && (
          <div className="active-folder-header">
            <div className="active-folder-info">
              <span className="active-folder-icon">📁</span>
              <span className="active-folder-title">{activeFolder.name}</span>
              <span className="active-folder-badge">
                {folderCounts.get(activeFolder.id) ?? 0}{" "}
                {(folderCounts.get(activeFolder.id) ?? 0) === 1 ? "note" : "notes"}
              </span>
            </div>
            <div className="active-folder-actions">
              <button
                type="button"
                className="folder-action-btn"
                onClick={() => openRenameFolder(activeFolder)}
                title="Rename folder"
              >
                ✏️ Rename
              </button>
              <button
                type="button"
                className="folder-action-btn danger"
                onClick={() => openDeleteFolder(activeFolder)}
                title="Delete folder safely"
              >
                🗑️ Delete
              </button>
            </div>
          </div>
        )}
      </div>

      <input
        className="search-input"
        placeholder={
          activeFolder
            ? `Search in ${activeFolder.name}…`
            : selectedFolder === "unfiled"
            ? "Search unfiled notes…"
            : "Search notes…"
        }
        value={search}
        onChange={(e) => setSearch(e.target.value)}
      />

      {/* Subject filters (independent of folders) */}
      <div className="mode-tabs filter-tabs">
        <button
          type="button"
          className={`chip ${subjectFilter === "all" ? "selected" : ""}`}
          onClick={() => setSubjectFilter("all")}
        >
          All Subjects
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

      {isLoading ? (
        <p>Loading…</p>
      ) : filtered.length === 0 ? (
        <p className="empty-note">
          {notes.length === 0
            ? "No notes yet. Create your first one ✨"
            : selectedFolder !== "all" && !term
            ? selectedFolder === "unfiled"
              ? "All notes are assigned to folders! 📁"
              : `Folder "${activeFolder?.name ?? ""}" is empty. Create a note here or move one in.`
            : "No notes match your filter or search."}
        </p>
      ) : (
        <div className="notes-grid">
          {filtered.map((n) => (
            <NoteCard
              key={n.id}
              note={n}
              onMoveFolder={(note) => setMovingNote(note)}
            />
          ))}
        </div>
      )}

      {/* Modal: Create Folder */}
      {folderModalMode === "create" && (
        <div className="modal-backdrop" onClick={() => setFolderModalMode(null)}>
          <div className="card modal" onClick={(e) => e.stopPropagation()}>
            <h3>Create new folder 📁</h3>
            <input
              className="folder-input"
              placeholder="Folder name (e.g. Physics Revision)"
              value={folderNameInput}
              autoFocus
              onChange={(e) => setFolderNameInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") handleCreateFolder();
              }}
            />
            {folderModalError && <p className="auth-error">{folderModalError}</p>}
            <div className="modal-actions">
              <button
                className="btn"
                onClick={handleCreateFolder}
                disabled={folderSubmitting}
              >
                {folderSubmitting ? "Creating…" : "Create folder"}
              </button>
              <button className="link-btn" onClick={() => setFolderModalMode(null)}>
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal: Rename Folder */}
      {folderModalMode === "rename" && targetFolder && (
        <div className="modal-backdrop" onClick={() => setFolderModalMode(null)}>
          <div className="card modal" onClick={(e) => e.stopPropagation()}>
            <h3>Rename folder ✏️</h3>
            <input
              className="folder-input"
              placeholder="New folder name"
              value={folderNameInput}
              autoFocus
              onChange={(e) => setFolderNameInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") handleRenameFolder();
              }}
            />
            {folderModalError && <p className="auth-error">{folderModalError}</p>}
            <div className="modal-actions">
              <button
                className="btn"
                onClick={handleRenameFolder}
                disabled={folderSubmitting}
              >
                {folderSubmitting ? "Saving…" : "Save"}
              </button>
              <button className="link-btn" onClick={() => setFolderModalMode(null)}>
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal: Safe Delete Folder */}
      {folderModalMode === "delete" && targetFolder && (
        <div className="modal-backdrop" onClick={() => setFolderModalMode(null)}>
          <div className="card modal" onClick={(e) => e.stopPropagation()}>
            <h3>Delete folder?</h3>
            <p>
              Are you sure you want to delete <strong>{targetFolder.name}</strong>?
            </p>
            <p className="muted" style={{ fontSize: "14px", marginTop: "8px" }}>
              🛡️ <strong>Safe deletion:</strong> Any notes inside this folder will be safely moved to <strong>Unfiled</strong>. No notes will be lost.
            </p>
            {folderModalError && <p className="auth-error">{folderModalError}</p>}
            <div className="modal-actions" style={{ marginTop: "16px" }}>
              <button
                className="btn danger"
                onClick={handleDeleteFolder}
                disabled={folderSubmitting}
              >
                {folderSubmitting ? "Deleting…" : "Delete folder"}
              </button>
              <button className="link-btn" onClick={() => setFolderModalMode(null)}>
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal: Quick Move Note */}
      {movingNote && (
        <div className="modal-backdrop" onClick={() => setMovingNote(null)}>
          <div className="card modal folder-move-modal" onClick={(e) => e.stopPropagation()}>
            <h3>Move note 📁</h3>
            <p className="modal-subtitle">
              Move <strong>{movingNote.title || "Untitled"}</strong> to:
            </p>
            <div className="folder-move-list">
              <button
                type="button"
                className={`folder-move-item ${!movingNote.folderId ? "current" : ""}`}
                onClick={() => handleMoveNote(null)}
              >
                <span>📂 Unfiled</span>
                {!movingNote.folderId && <span className="current-badge">(Current)</span>}
              </button>
              {folders.map((f) => (
                <button
                  key={f.id}
                  type="button"
                  className={`folder-move-item ${movingNote.folderId === f.id ? "current" : ""}`}
                  onClick={() => handleMoveNote(f.id)}
                >
                  <span>📁 {f.name}</span>
                  {movingNote.folderId === f.id && <span className="current-badge">(Current)</span>}
                </button>
              ))}
            </div>
            <button className="link-btn" onClick={() => setMovingNote(null)}>
              Cancel
            </button>
          </div>
        </div>
      )}
    </>
  );
}
