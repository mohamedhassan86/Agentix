export interface LoadingStateProps {
  label?: string;
}

export function LoadingState({ label = "Loading…" }: LoadingStateProps) {
  return (
    <div className="card" role="status" aria-live="polite" aria-busy="true">
      <p style={{ color: "var(--muted)" }}>{label}</p>
    </div>
  );
}
