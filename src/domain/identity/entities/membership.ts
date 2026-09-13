/**
 * Membership entity - association of user to org with exactly one role
 * History via ended_at/end_reason; only ended_at IS NULL is active
 */

import type { OrganizationRole } from "../value-objects/organization-role";

export type MembershipEndReason = "left" | "removed" | "organization_deleted" | "account_deleted";

export interface MembershipProps {
  id: string;
  orgId: string;
  userId: string;
  role: OrganizationRole;
  joinedAt: Date;
  endedAt: Date | null;
  endReason: MembershipEndReason | null;
  createdAt: Date;
  updatedAt: Date;
  version: number;
}

export class Membership {
  readonly id: string;
  orgId: string;
  userId: string;
  role: OrganizationRole;
  joinedAt: Date;
  endedAt: Date | null;
  endReason: MembershipEndReason | null;
  createdAt: Date;
  updatedAt: Date;
  version: number;

  private constructor(props: MembershipProps) {
    this.id = props.id;
    this.orgId = props.orgId;
    this.userId = props.userId;
    this.role = props.role;
    this.joinedAt = props.joinedAt;
    this.endedAt = props.endedAt;
    this.endReason = props.endReason;
    this.createdAt = props.createdAt;
    this.updatedAt = props.updatedAt;
    this.version = props.version;
  }

  static create(props: MembershipProps): Membership {
    return new Membership(props);
  }

  static createActive(params: {
    id: string;
    orgId: string;
    userId: string;
    role: OrganizationRole;
    now: Date;
  }): Membership {
    return new Membership({
      id: params.id,
      orgId: params.orgId,
      userId: params.userId,
      role: params.role,
      joinedAt: params.now,
      endedAt: null,
      endReason: null,
      createdAt: params.now,
      updatedAt: params.now,
      version: 1,
    });
  }

  isActive(): boolean {
    return this.endedAt === null;
  }

  isOwner(): boolean {
    return this.role === "owner" && this.isActive();
  }

  canBeRemoved(): boolean {
    // Owner cannot be removed via general remove
    return this.role !== "owner";
  }

  canLeave(): boolean {
    return this.role !== "owner";
  }

  changeRole(newRole: OrganizationRole, now: Date): void {
    if (!this.isActive()) throw new Error("MEMBERSHIP_NOT_ACTIVE");
    if (this.role === "owner") throw new Error("OWNER_ROLE_CANNOT_BE_CHANGED_VIA_GENERAL");
    if (newRole === "owner") throw new Error("OWNER_ROLE_MUST_USE_TRANSFER");
    if (this.role === newRole) return;
    this.role = newRole;
    this.updatedAt = now;
    this.version += 1;
  }

  transferToOwner(now: Date): void {
    if (!this.isActive()) throw new Error("MEMBERSHIP_NOT_ACTIVE");
    this.role = "owner";
    this.updatedAt = now;
    this.version += 1;
  }

  demoteToAdmin(now: Date): void {
    if (!this.isActive()) throw new Error("MEMBERSHIP_NOT_ACTIVE");
    this.role = "admin";
    this.updatedAt = now;
    this.version += 1;
  }

  end(reason: MembershipEndReason, now: Date): void {
    if (!this.isActive()) throw new Error("MEMBERSHIP_ALREADY_ENDED");
    if (this.role === "owner") throw new Error("OWNER_CANNOT_LEAVE_OR_BE_REMOVED");
    this.endedAt = now;
    this.endReason = reason;
    this.updatedAt = now;
    this.version += 1;
  }

  reactivate(role: OrganizationRole, now: Date): void {
    // Rejoin through later valid invitation reactivates ended row
    if (this.isActive()) throw new Error("MEMBERSHIP_ALREADY_ACTIVE");
    this.role = role;
    this.joinedAt = now;
    this.endedAt = null;
    this.endReason = null;
    this.updatedAt = now;
    this.version += 1;
  }
}
