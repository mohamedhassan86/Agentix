/**
 * Membership policy - role hierarchy and restrictions
 */

import type { OrganizationRole, InvitableRole } from "../value-objects/organization-role";

export class MembershipPolicy {
  static canInvite(role: OrganizationRole | null): boolean {
    return role === "owner" || role === "admin";
  }

  static canResendInvite(role: OrganizationRole | null): boolean {
    return role === "owner" || role === "admin";
  }

  static canRevokeInvite(role: OrganizationRole | null): boolean {
    return role === "owner" || role === "admin";
  }

  static canChangeRole(actorRole: OrganizationRole | null, targetRole: OrganizationRole): boolean {
    if (actorRole !== "owner" && actorRole !== "admin") return false;
    if (targetRole === "owner") return false; // Owner cannot be assigned via general role change
    return true;
  }

  static canRemoveMember(actorRole: OrganizationRole | null, targetRole: OrganizationRole): boolean {
    if (actorRole !== "owner" && actorRole !== "admin") return false;
    if (targetRole === "owner") return false; // Cannot remove Owner
    return true;
  }

  static canLeave(role: OrganizationRole | null): boolean {
    if (role === null) return false;
    if (role === "owner") return false; // Owner cannot leave unless transfer
    return true;
  }

  static canViewCost(role: OrganizationRole | null): boolean {
    // Viewer can read cost/spend per spec (reserved but permission is read-only)
    return role !== null;
  }

  static canCreateProject(role: OrganizationRole | null): boolean {
    // Reserved: Admin and Owner only
    return role === "owner" || role === "admin";
  }

  static canManageSecrets(role: OrganizationRole | null): boolean {
    return role === "owner" || role === "admin";
  }

  static canManageBilling(role: OrganizationRole | null): boolean {
    return role === "owner";
  }

  static isValidRoleTransition(from: OrganizationRole, to: InvitableRole): boolean {
    // Owner cannot be changed via general endpoint
    if (from === "owner") return false;
    if ((to as string) === "owner") return false;
    return true;
  }

  static requiresOwnerConfirmation(action: string): boolean {
    return ["delete", "transfer"].includes(action);
  }
}
