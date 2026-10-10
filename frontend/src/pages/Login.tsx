import { useState, type FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import { login, resetPassword, signup } from "../services/auth";

function friendlyError(err: unknown) {
  const code = (err as { code?: string }).code;
  switch (code) {
    case "auth/invalid-credential":
      return "Wrong email or password.";
    case "auth/email-already-in-use":
      return "That email already has an account. Try logging in.";
    case "auth/weak-password":
      return "Password must be at least 6 characters.";
    case "auth/invalid-email":
      return "Please enter a valid email.";
    case "auth/too-many-requests":
      return "Too many attempts. Please wait a little and try again.";
    default:
      return "Something went wrong. Please try again.";
  }
}

export default function Login() {
  const navigate = useNavigate();
  const [mode, setMode] = useState<"login" | "signup">("login");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [info, setInfo] = useState("");
  const [busy, setBusy] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError("");
    setInfo("");
    setBusy(true);
    try {
      if (mode === "signup") await signup(name, email, password);
      else await login(email, password);
      navigate("/");
    } catch (err) {
      setError(friendlyError(err));
    } finally {
      setBusy(false);
    }
  }

  async function handleReset() {
    setError("");
    setInfo("");
    if (!email.trim()) {
      setError("Type your email above first, then click “Forgot password?”.");
      return;
    }
    try {
      await resetPassword(email.trim());
      setInfo(
        "If there's an account for that email, a reset link is on its way. Check your spam folder too."
      );
    } catch (err) {
      setError(friendlyError(err));
    }
  }

  function switchMode() {
    setMode(mode === "login" ? "signup" : "login");
    setError("");
    setInfo("");
  }

  return (
    <div className="auth-page">
      <form className="card auth-card" onSubmit={handleSubmit}>
        <h1>Focus Mate</h1>
        <p className="auth-sub">
          {mode === "login" ? "Welcome back 👋" : "Create your account ✨"}
        </p>

        {mode === "signup" && (
          <input
            placeholder="Your name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
          />
        )}
        <input
          type="email"
          placeholder="Email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
        />
        <input
          type="password"
          placeholder="Password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
        />

        {mode === "login" && (
          <button type="button" className="link-btn forgot" onClick={() => void handleReset()}>
            Forgot password?
          </button>
        )}

        {error && <p className="auth-error">{error}</p>}
        {info && <p className="saved-note">{info}</p>}

        <button className="btn" type="submit" disabled={busy}>
          {busy ? "Please wait…" : mode === "login" ? "Log in" : "Sign up"}
        </button>

        <button type="button" className="link-btn" onClick={switchMode}>
          {mode === "login"
            ? "New here? Create an account"
            : "Already have an account? Log in"}
        </button>
      </form>
    </div>
  );
}
