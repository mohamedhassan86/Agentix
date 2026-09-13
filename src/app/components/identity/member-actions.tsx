"use client";

export interface MemberActionsProps {
  memberId: string;
  role: string;
  actorRole: string | null;
  onChangeRole: (memberId: string, role: "viewer" | "member" | "admin") => void;
  onRemove: (memberId: string) => void;
  disabled?: boolean;
}

export function MemberActions({ memberId, role, actorRole, onChangeRole, onRemove, disabled = false }: MemberActionsProps) {
  const canManage = actorRole === "owner" || actorRole === "admin";
  const ownerTarget = role === "owner";
  const reason = ownerTarget ? "Owner must be transferred, not changed" : !canManage ? "Admin or Owner only" : undefined;

  return (
    <div style={{ display: "flex", gap: "8px" }}>
      <label>
        Role
        <select
          value={role === "owner" ? "owner" : role}
          disabled={disabled || !canManage || ownerTarget}
          title={reason}
          onChange={(e) => onChangeRole(memberId, e.target.value as "viewer" | "member" | "admin")}
        >
          {ownerTarget ? <option value="owner">Owner</option> : null}
          <option value="admin">Admin</option>
          <option value="member">Member</option>
          <option value="viewer">Viewer</option>
        </select>
      </label>
      <button className="btn" type="button" disabled={disabled || !canManage || ownerTarget} title={reason} onClick={() => onRemove(memberId)}>
        Remove
      </button>
    </div>
  );
}
