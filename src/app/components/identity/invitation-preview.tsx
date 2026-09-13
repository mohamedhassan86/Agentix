export interface InvitationPreviewProps {
  organizationName: string;
  invitedEmail: string;
  role: string;
  status: string;
  expiresAt: string;
  accountRequired: boolean;
  error?: string | null;
}

export function InvitationPreview({
  organizationName,
  invitedEmail,
  role,
  status,
  expiresAt,
  accountRequired,
  error = null,
}: InvitationPreviewProps) {
  return (
    <div className="card">
      <div className="card-header">
        <h1>Invitation</h1>
        <span className="status-chip">
          <span className="dot" />
          {status}
        </span>
      </div>
      {error ? (
        <div className="banner" role="alert" aria-live="polite">
          {error}
        </div>
      ) : null}
      <p>
        Join <strong>{organizationName}</strong> as {role}.
      </p>
      <p style={{ color: "var(--muted)" }}>Invited email: {invitedEmail}</p>
      <p style={{ color: "var(--muted)" }}>Expires {expiresAt}</p>
      {accountRequired ? <p>Create an account with this exact email before accepting.</p> : null}
    </div>
  );
}
