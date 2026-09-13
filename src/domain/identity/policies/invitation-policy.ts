/**
 * Invitation policy
 */

import type { OrganizationRole, InvitableRole } from "../value-objects/organization-role";

export class InvitationPolicy {
  static canIssue(role: OrganizationRole | null): boolean {
    return role === "owner" || role === "admin";
  }

  static canList(role: OrganizationRole | null): boolean {
    return role === "owner" || role === "admin";
  }

  static canResend(role: OrganizationRole | null): boolean {
    return role === "owner" || role === "admin";
  }

  static canRevoke(role: OrganizationRole | null): boolean {
    return role === "owner" || role === "admin";
  }

  static isInvitableRole(role: string): role is InvitableRole {
    return ["viewer", "member", "admin"].includes(role);
  }

  static validateInviteTarget(params: {
    targetEmailNormalized: string;
    actorUserId: string;
    existingMemberEmails: string[];
    isPlatformAdminEmail: boolean;
    pendingInvitationEmails: string[];
  }): { valid: boolean; code?: string; message?: string } {
    const normalized = params.targetEmailNormalized.toLowerCase().trim();

    if (params.isPlatformAdminEmail) {
      return { valid: false, code: "INVITATION_CONFLICT", message: "Cannot invite platform administrator" };
    }

    if (params.existingMemberEmails.map((e) => e.toLowerCase().trim()).includes(normalized)) {
      return { valid: false, code: "INVITATION_CONFLICT", message: "User is already a member" };
    }

    if (params.pendingInvitationEmails.map((e) => e.toLowerCase().trim()).includes(normalized)) {
      return { valid: false, code: "INVITATION_CONFLICT", message: "Pending invitation already exists" };
    }

    return { valid: true };
  }

  static canAccept(params: {
    invitationEmailNormalized: string;
    userEmailNormalized: string;
    isExpired: boolean;
    isRevoked: boolean;
    isAccepted: boolean;
  }): { canAccept: boolean; code?: string } {
    if (params.isExpired) return { canAccept: false, code: "INVITATION_EXPIRED" };
    if (params.isRevoked) return { canAccept: false, code: "INVITATION_REVOKED" };
    if (params.isAccepted) return { canAccept: false, code: "INVITATION_ALREADY_ACCEPTED" };
    if (params.invitationEmailNormalized.toLowerCase().trim() !== params.userEmailNormalized.toLowerCase().trim()) {
      return { canAccept: false, code: "INVITATION_EMAIL_MISMATCH" };
    }
    return { canAccept: true };
  }
}
