/**
 * Organization policy - Owner-only operations
 */

import type { OrganizationRole } from "../value-objects/organization-role";

export class OrganizationPolicy {
  static canViewProfile(role: OrganizationRole | null, isPlatformAdmin: boolean): boolean {
    if (isPlatformAdmin) return true;
    return role !== null;
  }

  static canRename(role: OrganizationRole | null): boolean {
    return role === "owner";
  }

  static canChangeSlug(role: OrganizationRole | null): boolean {
    return role === "owner";
  }

  static canDelete(role: OrganizationRole | null): boolean {
    return role === "owner";
  }

  static canTransferOwnership(role: OrganizationRole | null): boolean {
    return role === "owner";
  }

  static canCreateOrganization(isPlatformAdmin: boolean): boolean {
    // Any signed-in non-platform-admin user can create
    return !isPlatformAdmin;
  }

  static canListMembers(role: OrganizationRole | null, isPlatformAdmin: boolean): boolean {
    if (isPlatformAdmin) return true;
    return role !== null;
  }

  static canViewInvitations(role: OrganizationRole | null, isPlatformAdmin: boolean): boolean {
    if (isPlatformAdmin) return true;
    return role === "owner" || role === "admin";
  }
}
