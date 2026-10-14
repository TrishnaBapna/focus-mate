import { useState, type FormEvent } from "react";
import { useSocial } from "../hooks/useSocial";
import { MAX_GROUP_SIZE, describeError } from "../utils/social";
import GroupCard from "./GroupCard";

export default function GroupsTab() {
  const social = useSocial();
  const codes = social.settings?.groupCodes ?? [];

  const [name, setName] = useState("");
  const [code, setCode] = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);

  async function create(e: FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;
    setBusy(true);
    setMessage("");
    try {
      const newCode = await social.createGroup(name);
      setName("");
      setMessage(`Group created! Share the code ${newCode} with your friends.`);
    } catch (err) {
      setMessage(describeError(err));
    } finally {
      setBusy(false);
    }
  }

  async function join(e: FormEvent) {
    e.preventDefault();
    if (!code.trim()) return;
    setBusy(true);
    setMessage("");
    try {
      const problem = await social.joinGroup(code);
      if (problem) setMessage(problem);
      else {
        setCode("");
        setMessage("You're in! 🎉");
      }
    } catch (err) {
      setMessage(describeError(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="friends-stack">
      <div className="group-forms">
        <form className="card" onSubmit={create}>
          <h3>Start a group</h3>
          <p className="muted small">Make one for your class, friends, or study club.</p>
          <input
            placeholder="Group name"
            maxLength={30}
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
          <button className="btn small" type="submit" disabled={busy || !name.trim()}>
            Create group
          </button>
        </form>

        <form className="card" onSubmit={join}>
          <h3>Join a group</h3>
          <p className="muted small">Ask a friend for their 6-letter code.</p>
          <input
            placeholder="e.g. K7X2QM"
            maxLength={6}
            value={code}
            onChange={(e) => setCode(e.target.value.toUpperCase())}
          />
          <button className="btn small" type="submit" disabled={busy || code.length < 6}>
            Join group
          </button>
        </form>
      </div>

      {message && <p className="friends-message">{message}</p>}

      {codes.length === 0 ? (
        <p className="empty-note">
          No groups yet. Start one, or join a friend's. Groups hold up to {MAX_GROUP_SIZE} people.
        </p>
      ) : (
        <div className="group-list">
          {codes.map((c) => (
            <GroupCard key={c} code={c} />
          ))}
        </div>
      )}
    </div>
  );
}
