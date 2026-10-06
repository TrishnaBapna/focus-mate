export default function Placeholder({ title }: { title: string }) {
  return (
    <>
      <h1 className="page-title">{title}</h1>
      <section className="card">The {title} page is coming soon.</section>
    </>
  );
}