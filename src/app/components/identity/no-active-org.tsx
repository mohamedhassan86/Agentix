export interface NoActiveOrgProps {
  onChoose?: () => void;
}

export function NoActiveOrg({ onChoose }: NoActiveOrgProps) {
  return (
    <div className="card" role="status" aria-live="polite">
      <div className="card-header">
        <h2>No active organization</h2>
        <span className="status-chip">
          <span className="dot" aria-hidden="true" />
          none selected
        </span>
      </div>
      <p className="banner" style={{ marginBottom: onChoose ? "12px" : 0 }}>
        Tenant data is hidden until you explicitly choose an organization. Sign-in never restores a previous selection.
      </p>
      {onChoose ? (
        <button className="btn btn-primary" type="button" onClick={onChoose}>
          Choose organization
        </button>
      ) : null}
    </div>
  );
}
