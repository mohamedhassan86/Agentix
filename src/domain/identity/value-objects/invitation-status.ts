/**
 * InvitationStatus closed values: pending, accepted, expired, revoked
 * Delivery state separate: queued, sent, failed
 */

export const INVITATION_STATUSES = ["pending", "accepted", "expired", "revoked"] as const;
export type InvitationStatus = (typeof INVITATION_STATUSES)[number];

export const DELIVERY_STATES = ["queued", "sent", "failed"] as const;
export type DeliveryState = (typeof DELIVERY_STATES)[number];

export function isInvitationStatus(value: string): value is InvitationStatus {
  return (INVITATION_STATUSES as readonly string[]).includes(value);
}

export function isDeliveryState(value: string): value is DeliveryState {
  return (DELIVERY_STATES as readonly string[]).includes(value);
}

export function isTerminalInvitationStatus(status: InvitationStatus): boolean {
  return status === "accepted" || status === "revoked";
}

export function canResendInvitation(status: InvitationStatus): boolean {
  // Resend allowed for pending or expired only per spec FR-028
  return status === "pending" || status === "expired";
}

export function canRevokeInvitation(status: InvitationStatus): boolean {
  // Revoke allowed for pending only per spec FR-029
  return status === "pending";
}

export function canAcceptInvitation(status: InvitationStatus, expiresAt: Date, now: Date = new Date()): boolean {
  if (status !== "pending") return false;
  return expiresAt.getTime() > now.getTime();
}

export function effectiveStatus(status: InvitationStatus, expiresAt: Date, now: Date = new Date()): InvitationStatus {
  if (status === "pending" && expiresAt.getTime() <= now.getTime()) {
    return "expired";
  }
  return status;
}
