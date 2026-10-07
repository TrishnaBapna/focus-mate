import { useState, type FormEvent } from "react";
import { useAuth } from "../hooks/useAuth";
import { useSubjects } from "../hooks/useSubjects";
import { addSubject, deleteSubject } from "../services/subjects";

const COLORS = ["#ffd6c2", "#ffe9a8", "#d4f1d9", "#d9ccff", "#cfe8ff", "#ffd1e1"];

export default function Subjects() {
  const { user } = useAuth();
  const { subjects, loading } = useSubjects();
  const [name, setName] = useState("");
  const [emoji, setEmoji] = useState("📚");
  const [color, setColor] = useState(COLORS[0]);

  async function handleAdd(e: FormEvent) {
    e.preventDefault();
    if (!user || !name.trim()) return;
    await addSubject(user.uid, { name: name.trim(), emoji, color });
    setName("");
  }

  return (
    <>
      <h1 className="page-title">My Subjects</h1>

      <form className="card subject-form" onSubmit={handleAdd}>
        <input
          className="emoji-input"
          value={emoji}
          onChange={(e) => setEmoji(e.target.value)}
          maxLength={2}
          aria-label="Emoji"
        />
        <input
          className="name-input"
          placeholder="Subject name (e.g. Mathematics)"
          value={name}
          onChange={(e) => setName(e.target.value)}
        />
        <div className="swatches">
          {COLORS.map((c) => (
            <button
              key={c}
              type="button"
              className={`swatch ${c === color ? "selected" : ""}`}
              style={{ background: c }}
              onClick={() => setColor(c)}
              aria-label={`Colour ${c}`}
            />
          ))}
        </div>
        <button className="btn" type="submit">Add</button>
      </form>

      {loading ? (
        <p>Loading…</p>
      ) : subjects.length === 0 ? (
        <p className="empty-note">No subjects yet. Add your first one above ✨</p>
      ) : (
        <div className="subject-grid">
          {subjects.map((s) => (
            <div key={s.id} className="card subject-card" style={{ background: s.color }}>
              <span className="subject-emoji">{s.emoji}</span>
              <span className="subject-name">{s.name}</span>
              <button
                className="delete-btn"
                title="Delete subject"
                onClick={() => user && deleteSubject(user.uid, s.id)}
              >
                ✕
              </button>
            </div>
          ))}
        </div>
      )}
    </>
  );
}
