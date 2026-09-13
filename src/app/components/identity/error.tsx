export interface ErrorStateProps {
  title?: string;
  detail?: string;
  onRetry?: () => void;
}

export function ErrorState({ title = "Something went wrong", detail, onRetry }: ErrorStateProps) {
  return (
    <div className="card" role="alert" aria-live="polite">
      <div className="card-header">
        <h2>{title}</h2>
        <span className="status-chip">
          <span className="dot" aria-hidden="true" />
          Error
        </span>
      </div>
      <p className="banner" style={{ marginBottom: onRetry ? "12px" : 0 }}>
        {detail ?? "Please try again."}
      </p>
      {onRetry ? (
        <button className="btn btn-primary" type="button" onClick={onRetry}>
          Retry
        </button>
      ) : null}
    </div>
  );
}
