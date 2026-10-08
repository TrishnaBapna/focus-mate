import { Link } from "react-router-dom";

const OPTIONS = [
  { to: "/notes/new", icon: "⌨️", label: "Type" },
  { to: "/notes/new?type=handwritten", icon: "✍️", label: "Handwrite" },
  { to: "/notes/new?type=scan", icon: "📷", label: "Scan" },
  { to: "/notes/new?type=voice", icon: "🎙️", label: "Voice" },
];

export default function NewNoteChooser({ onClose }: { onClose: () => void }) {
  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="card modal" onClick={(e) => e.stopPropagation()}>
        <h3>How do you want to create your note?</h3>
        <div className="chooser-grid">
          {OPTIONS.map((o) => (
            <Link key={o.label} to={o.to} className="chooser-option">
              <span className="chooser-icon">{o.icon}</span>
              {o.label}
            </Link>
          ))}
        </div>
        <button className="link-btn" onClick={onClose}>
          Cancel
        </button>
      </div>
    </div>
  );
}
