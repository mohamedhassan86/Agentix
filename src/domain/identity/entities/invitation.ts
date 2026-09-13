/**
 * Invitation aggregate
 */

import type { InvitableRole } from "../value-objects/organization-role";
import type { InvitationStatus, DeliveryState } from "../value-objects/invitation-status";
import { effectiveStatus } from "../value-objects/invitation-status";

export interface InvitationProps {
  id: string;
  orgId: string;
  emailNormalized: string;
  role: InvitableRole;
  status: InvitationStatus;
  inviterUserId: string;
  acceptedUserId: string | null;
  expiresAt: Date;
  acceptedAt: Date | null;
  revokedAt: Date | null;
  deliveryState: DeliveryState;
  lastDeliveryErrorCode: string | null;
  createdAt: Date;
  updatedAt: Date;
  version: number;
}

export class Invitation {
  readonly id: string;
  orgId: string;
  emailNormalized: string;
  role: InvitableRole;
  status: InvitationStatus;
  inviterUserId: string;
  acceptedUserId: string | null;
  expiresAt: Date;
  acceptedAt: Date | null;
  revokedAt: Date | null;
  deliveryState: DeliveryState;
  lastDeliveryErrorCode: string | null;
  createdAt: Date;
  updatedAt: Date;
  version: number;

  private constructor(props: InvitationProps) {
    this.id = props.id;
    this.orgId = props.orgId;
    this.emailNormalized = props.emailNormalized;
    this.role = props.role;
    this.status = props.status;
    this.inviterUserId = props.inviterUserId;
    this.acceptedUserId = props.acceptedUserId;
    this.expiresAt = props.expiresAt;
    this.acceptedAt = props.acceptedAt;
    this.revokedAt = props.revokedAt;
    this.deliveryState = props.deliveryState;
    this.lastDeliveryErrorCode = props.lastDeliveryErrorCode;
    this.createdAt = props.createdAt;
    this.updatedAt = props.updatedAt;
    this.version = props.version;
  }

  static create(props: InvitationProps): Invitation {
    return new Invitation(props);
  }

  static issue(params: {
    id: string;
    orgId: string;
    emailNormalized: string;
    role: InvitableRole | string;
    inviterUserId: string;
    expiresAt: Date;
    now: Date;
  }): Invitation {
    if ((params.role as any) === "owner") throw new Error("CANNOT_INVITE_AS_OWNER");
    return new Invitation({
      id: params.id,
      orgId: params.orgId,
      emailNormalized: params.emailNormalized.toLowerCase().trim(),
      role: params.role as InvitableRole,
      status: "pending",
      inviterUserId: params.inviterUserId,
      acceptedUserId: null,
      expiresAt: params.expiresAt,
      acceptedAt: null,
      revokedAt: null,
      deliveryState: "queued",
      lastDeliveryErrorCode: null,
      createdAt: params.now,
      updatedAt: params.now,
      version: 1,
    });
  }

  getEffectiveStatus(now: Date = new Date()): InvitationStatus {
    return effectiveStatus(this.status, this.expiresAt, now);
  }

  isPending(now: Date = new Date()): boolean {
    return this.getEffectiveStatus(now) === "pending";
  }

  canAccept(now: Date = new Date()): boolean {
    return this.getEffectiveStatus(now) === "pending";
  }

  expire(now: Date): void {
    if (this.status !== "pending") throw new Error("INVITATION_NOT_PENDING");
    if (this.expiresAt.getTime() > now.getTime()) throw new Error("INVITATION_NOT_YET_EXPIRED");
    this.status = "expired";
    this.updatedAt = now;
    this.version += 1;
  }

  markExpiredIfNeeded(now: Date): boolean {
    if (this.status === "pending" && this.expiresAt.getTime() <= now.getTime()) {
      this.status = "expired";
      this.updatedAt = now;
      this.version += 1;
      return true;
    }
    return false;
  }

  resend(params: { newExpiresAt: Date; now: Date }): void {
    const effective = this.getEffectiveStatus(params.now);
    if (effective !== "pending" && effective !== "expired") {
      throw new Error("INVITATION_CANNOT_RESEND");
    }
    // Resend issues new token version and fresh expiry, stays pending
    this.status = "pending";
    this.expiresAt = params.newExpiresAt;
    this.deliveryState = "queued";
    this.lastDeliveryErrorCode = null;
    this.updatedAt = params.now;
    this.version += 1;
  }

  revoke(now: Date): void {
    if (this.status !== "pending") throw new Error("INVITATION_CANNOT_REVOKE");
    this.status = "revoked";
    this.revokedAt = now;
    this.updatedAt = now;
    this.version += 1;
  }

  accept(params: { userId: string; now: Date }): void {
    if (!this.canAccept(params.now)) {
      const eff = this.getEffectiveStatus(params.now);
      if (eff === "expired") throw new Error("INVITATION_EXPIRED");
      if (eff === "revoked") throw new Error("INVITATION_REVOKED");
      if (eff === "accepted") throw new Error("INVITATION_ALREADY_ACCEPTED");
      throw new Error("INVITATION_NOT_ACCEPTABLE");
    }
    this.status = "accepted";
    this.acceptedUserId = params.userId;
    this.acceptedAt = params.now;
    this.updatedAt = params.now;
    this.version += 1;
  }

  markDelivery(state: DeliveryState, errorCode: string | null, now: Date): void {
    this.deliveryState = state;
    this.lastDeliveryErrorCode = errorCode;
    this.updatedAt = now;
    this.version += 1;
  }
}
