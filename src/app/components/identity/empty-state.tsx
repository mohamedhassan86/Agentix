export interface EmptyStateProps {
  title: string;
  description: string;
  actionLabel?: string;
  onAction?: () => void;
}

export function EmptyState({ title, description, actionLabel, onAction }: EmptyStateProps) {
  return (
    <div className="card" role="status">
      <div className="card-header">
        <h2>{title}</h2>
      </div>
      <p style={{ color: "var(--muted)", marginBottom: actionLabel ? "12px" : 0 }}>{description}</p>
      {actionLabel && onAction ? (
        <button className="btn btn-primary" type="button" onClick={onAction}>
          {actionLabel}
        </button>
      ) : null}
    </div>
  );
}
