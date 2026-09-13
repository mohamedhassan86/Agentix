export interface PermissionDeniedProps {
  detail?: string;
}

export function PermissionDenied({ detail }: PermissionDeniedProps) {
  return (
    <div className="card" role="alert" aria-live="polite">
      <div className="card-header">
        <h2>Permission denied</h2>
        <span className="status-chip">
          <span className="dot" aria-hidden="true" />
          Denied
        </span>
      </div>
      <p className="banner">{detail ?? "You do not have permission to perform this action."}</p>
    </div>
  );
}
