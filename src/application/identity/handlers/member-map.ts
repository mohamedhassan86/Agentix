import type { OrgMembershipRow } from "../ports/identity-store";
import type { Member } from "../dto/member";

export function toMemberDto(row: OrgMembershipRow): Member {
  return {
    id: row.membership.id,
    userId: row.user.id,
    displayName: row.user.displayName,
    email: row.user.emailNormalized,
    role: row.membership.role,
    joinedAt: row.membership.joinedAt.toISOString(),
  };
}
