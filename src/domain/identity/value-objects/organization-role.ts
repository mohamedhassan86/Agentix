/**
 * OrganizationRole closed enum: viewer < member < admin < owner
 * Capability checks use named policies rather than numeric comparison where exclusions apply
 */

export const ORGANIZATION_ROLES = ["viewer", "member", "admin", "owner"] as const;
export type OrganizationRole = (typeof ORGANIZATION_ROLES)[number];

export const INVITABLE_ROLES = ["viewer", "member", "admin"] as const;
export type InvitableRole = (typeof INVITABLE_ROLES)[number];

const ROLE_ORDER: Record<OrganizationRole, number> = {
  viewer: 0,
  member: 1,
  admin: 2,
  owner: 3,
};

export function isOrganizationRole(value: string): value is OrganizationRole {
  return (ORGANIZATION_ROLES as readonly string[]).includes(value);
}

export function isInvitableRole(value: string): value is InvitableRole {
  return (INVITABLE_ROLES as readonly string[]).includes(value);
}

export function compareRoles(a: OrganizationRole, b: OrganizationRole): number {
  return ROLE_ORDER[a] - ROLE_ORDER[b];
}

export function isAtLeastRole(actual: OrganizationRole, required: OrganizationRole): boolean {
  return ROLE_ORDER[actual] >= ROLE_ORDER[required];
}

export function canInviteRole(role: string): role is InvitableRole {
  return isInvitableRole(role);
}

export function assertInvitableRole(role: string): asserts role is InvitableRole {
  if (!isInvitableRole(role)) {
    throw new Error("ROLE_NOT_INVITABLE");
  }
}

export function getHigherRoles(role: OrganizationRole): OrganizationRole[] {
  return ORGANIZATION_ROLES.filter((r) => ROLE_ORDER[r] > ROLE_ORDER[role]);
}

export function getLowerRoles(role: OrganizationRole): OrganizationRole[] {
  return ORGANIZATION_ROLES.filter((r) => ROLE_ORDER[r] < ROLE_ORDER[role]);
}
