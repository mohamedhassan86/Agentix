"use client";

export interface InvitationListItem {
  id: string;
  email: string;
  role: string;
  status: string;
  deliveryState: string;
  ageSeconds: number;
}

export interface InvitationListProps {
  items: InvitationListItem[];
  canManage: boolean;
  onResend: (id: string) => void;
  onRevoke: (id: string) => void;
  disabled?: boolean;
}

export function InvitationList({ items, canManage, onResend, onRevoke, disabled = false }: InvitationListProps) {
  if (items.length === 0) {
    return (
      <p style={{ color: "var(--muted)" }} role="status">
        No invitations yet.
      </p>
    );
  }
  return (
    <ul style={{ listStyle: "none", margin: 0, padding: 0 }}>
      {items.map((item) => (
        <li key={item.id} className="card" style={{ marginBottom: "8px" }}>
          <div className="card-header">
            <strong>{item.email}</strong>
            <span className="status-chip">
              <span className="dot" />
              {item.status} · {item.deliveryState}
            </span>
          </div>
          <p style={{ color: "var(--muted)", marginBottom: "8px" }}>
            {item.role} · {Math.floor(item.ageSeconds / 3600)}h ago
          </p>
          {canManage ? (
            <div style={{ display: "flex", gap: "8px" }}>
              <button
                className="btn"
                type="button"
                disabled={disabled || item.status !== "pending"}
                title={item.status !== "pending" ? "Only pending invitations can be resent" : undefined}
                onClick={() => onResend(item.id)}
              >
                Resend
              </button>
              <button
                className="btn"
                type="button"
                disabled={disabled || item.status !== "pending"}
                title={item.status !== "pending" ? "Only pending invitations can be revoked" : undefined}
                onClick={() => onRevoke(item.id)}
              >
                Revoke
              </button>
            </div>
          ) : null}
        </li>
      ))}
    </ul>
  );
}
