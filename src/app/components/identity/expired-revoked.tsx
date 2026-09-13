export type InviteTerminalStatus = "expired" | "revoked";

export interface ExpiredRevokedProps {
  status: InviteTerminalStatus;
  organizationName?: string;
}

export function ExpiredRevoked({ status, organizationName }: ExpiredRevokedProps) {
  const label = status === "expired" ? "Invitation expired" : "Invitation revoked";
  const detail =
    status === "expired"
      ? "This invitation is older than seven days and can no longer be accepted. Ask an Owner or Admin to resend it."
      : "This invitation was revoked and can no longer be accepted.";
  return (
    <div className="card" role="status" aria-live="polite">
      <div className="card-header">
        <h2>{label}</h2>
        <span className="status-chip">
          <span className="dot" aria-hidden="true" />
          {status}
        </span>
      </div>
      <p className="banner">
        {organizationName ? `${organizationName}: ${detail}` : detail}
      </p>
    </div>
  );
}
