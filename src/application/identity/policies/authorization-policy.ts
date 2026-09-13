import type { OrganizationRole } from "@/domain/identity/value-objects/organization-role";
import { MembershipPolicy } from "@/domain/identity/policies/membership-policy";
import { OrganizationPolicy } from "@/domain/identity/policies/organization-policy";
import { InvitationPolicy } from "@/domain/identity/policies/invitation-policy";
import { OwnerInvariantError, PermissionDeniedError } from "@/domain/identity/errors/identity-errors";
import { identityAppError } from "../map-error";

export class AuthorizationPolicy {
  static assertCanListMembers(role: OrganizationRole | null, isPlatformAdmin: boolean): void {
    if (!OrganizationPolicy.canListMembers(role, isPlatformAdmin)) {
      throw identityAppError(new PermissionDeniedError());
    }
  }

  static assertCanChangeRole(actorRole: OrganizationRole | null, targetRole: OrganizationRole, nextRole: string): void {
    if (!MembershipPolicy.canChangeRole(actorRole, targetRole)) {
      throw identityAppError(new PermissionDeniedError());
    }
    if (targetRole === "owner" || nextRole === "owner") {
      throw identityAppError(new OwnerInvariantError());
    }
  }

  static assertCanRemove(actorRole: OrganizationRole | null, targetRole: OrganizationRole): void {
    if (!MembershipPolicy.canRemoveMember(actorRole, targetRole)) {
      if (targetRole === "owner") throw identityAppError(new OwnerInvariantError());
      throw identityAppError(new PermissionDeniedError());
    }
  }

  static assertCanLeave(role: OrganizationRole | null): void {
    if (!MembershipPolicy.canLeave(role)) {
      throw identityAppError(new OwnerInvariantError("Owner cannot leave without transferring ownership"));
    }
  }

  static assertCanInvite(role: OrganizationRole | null): void {
    if (!InvitationPolicy.canIssue(role)) {
      throw identityAppError(new PermissionDeniedError());
    }
  }

  static assertCanTransfer(role: OrganizationRole | null): void {
    if (!OrganizationPolicy.canTransferOwnership(role)) {
      throw identityAppError(new PermissionDeniedError());
    }
  }
}
