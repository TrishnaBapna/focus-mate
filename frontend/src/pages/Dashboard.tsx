import { useAuth } from "../hooks/useAuth";

export default function Dashboard() {
  const { user } = useAuth();
  const name = user?.displayName?.split(" ")[0] ?? "there";

  return (
    <>
      <h1 className="page-title">Good morning, {name}! 👋</h1>
      <div className="dashboard-grid">
        <section className="card">Focus summary (coming soon)</section>
        <section className="card">Today's tasks (coming soon)</section>
      </div>
    </>
  );
}
