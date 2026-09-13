/**
 * Platform policy - separate from org roles, read-only, zero memberships
 */

export class PlatformPolicy {
  static canGrantPlatformAdmin(activeMembershipCount: number): boolean {
    return activeMembershipCount === 0;
  }

  static canInspect(isPlatformAdmin: boolean): boolean {
    return isPlatformAdmin;
  }

  static canMutate(_isPlatformAdmin: boolean): boolean {
    // Platform admin MUST NOT mutate tenant data
    return false;
  }

  static canCreateOrganization(isPlatformAdmin: boolean): boolean {
    return !isPlatformAdmin;
  }

  static canBeInvited(isPlatformAdmin: boolean): boolean {
    return !isPlatformAdmin;
  }

  static canSwitchOrganization(isPlatformAdmin: boolean): boolean {
    // Platform admin belongs to no org, cannot switch
    return !isPlatformAdmin;
  }

  static validateZeroMemberships(activeMembershipCount: number): void {
    if (activeMembershipCount > 0) {
      throw new Error("PLATFORM_ADMIN_REQUIRES_ZERO_MEMBERSHIPS");
    }
  }
}
