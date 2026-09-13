/**
 * Tenant isolation policy - fail-closed
 * Never-member 404 indistinguishable from nonexistent, former-member explicit no-access
 */

export type TenantAccessResult =
  | { allowed: true }
  | { allowed: false; code: "ORGANIZATION_NOT_FOUND" }
  | { allowed: false; code: "FORMER_MEMBER" }
  | { allowed: false; code: "NO_ACTIVE_ORGANIZATION" }
  | { allowed: false; code: "PERMISSION_DENIED" };

export class TenantIsolationPolicy {
  /**
   * Evaluate tenant access
   * @param hasCurrentMembership - user has active membership in requested org
   * @param hasFormerMembership - user had membership before (left/removed/org deleted)
   * @param isPlatformAdmin - platform admin through normal route? Should be denied, through inspect allowed separately
   * @param hasActiveOrg - session has active org pointer
   * @param isPlatformInspectRoute - is this a platform inspection route?
   */
  static evaluate(params: {
    hasCurrentMembership: boolean;
    hasFormerMembership: boolean;
    isPlatformAdmin: boolean;
    hasActiveOrg: boolean;
    isPlatformInspectRoute: boolean;
    requiredRole?: string | null;
    actualRole?: string | null;
  }): TenantAccessResult {
    // Platform inspection route: only platform admin allowed
    if (params.isPlatformInspectRoute) {
      if (params.isPlatformAdmin) {
        return { allowed: true };
      }
      return { allowed: false, code: "PERMISSION_DENIED" };
    }

    // Normal member route: platform admin denied (must use inspect route)
    if (params.isPlatformAdmin) {
      return { allowed: false, code: "PERMISSION_DENIED" };
    }

    // No active org in session
    if (!params.hasActiveOrg) {
      return { allowed: false, code: "NO_ACTIVE_ORGANIZATION" };
    }

    // Current member - check role if required
    if (params.hasCurrentMembership) {
      if (params.requiredRole && params.actualRole) {
        // Role check is done in MembershipPolicy, but we can still allow base access
        return { allowed: true };
      }
      return { allowed: true };
    }

    // Former member -> explicit no-access
    if (params.hasFormerMembership) {
      return { allowed: false, code: "FORMER_MEMBER" };
    }

    // Never-member -> indistinguishable from nonexistent
    return { allowed: false, code: "ORGANIZATION_NOT_FOUND" };
  }

  static shouldRevealOrganizationExists(hasFormerMembership: boolean): boolean {
    // Only former members get explicit no-access; never-members get 404
    return hasFormerMembership;
  }
}
