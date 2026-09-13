export interface PlatformInspectViewProps {
  organizationName: string;
  slug: string;
  memberCount: number;
  invitationCount: number;
}

export function PlatformInspectView({ organizationName, slug, memberCount, invitationCount }: PlatformInspectViewProps) {
  return (
    <div className="card">
      <div className="card-header">
        <h1>Platform inspection</h1>
        <span className="status-chip">
          <span className="dot" />
          read-only
        </span>
      </div>
      <p>
        {organizationName} ({slug})
      </p>
      <p style={{ color: "var(--muted)" }}>
        {memberCount} members · {invitationCount} invitations
      </p>
      <p role="status">Invite, remove, and role controls are not available to platform administrators.</p>
    </div>
  );
}
