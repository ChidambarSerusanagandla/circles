export default function Loading() {
  return (
    <div className="page" aria-label="Loading conversations" role="status">
      <div className="skeleton skeleton-title" />
      <div className="conversation-grid">
        {[0, 1, 2].map((n) => (
          <div key={n} className="skeleton skeleton-card" />
        ))}
      </div>
      <span className="sr-only">Loading conversations…</span>
    </div>
  );
}
