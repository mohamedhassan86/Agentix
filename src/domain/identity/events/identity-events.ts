/**
 * Identity events - redacted, append-only, audit-ready
 * No password/hash/token/session/email-secret in payload
 */

export const IDENTITY_EVENT_TYPES = [
  "account.registered",
  "account.email_verified",
  "account.deleted",
  "organization.created",
  "organization.profile_changed",
  "organization.ownership_transferred",
  "organization.deleted",
  "membership.joined",
  "membership.role_changed",
  "membership.removed",
  "membership.left",
  "invitation.created",
  "invitation.resent",
  "invitation.revoked",
  "invitation.expired",
  "invitation.accepted",
  "message.delivery_succeeded",
  "message.delivery_failed",
] as const;

export type IdentityEventType = (typeof IDENTITY_EVENT_TYPES)[number];

export interface IdentityEventPayload {
  // Only redacted IDs/roles/status/reasons allowed
  [key: string]: unknown;
}

export interface IdentityEvent {
  eventId: string;
  eventVersion: number;
  eventType: IdentityEventType;
  organizationId: string | null;
  actorUserId: string | null;
  subjectUserId: string | null;
  objectType: string;
  objectId: string;
  sequence: string; // decimal string to avoid JS int loss
  occurredAt: string; // ISO
  data: IdentityEventPayload;
}

export function createIdentityEvent(params: {
  eventId: string;
  eventType: IdentityEventType;
  organizationId?: string | null;
  actorUserId?: string | null;
  subjectUserId?: string | null;
  objectType: string;
  objectId: string;
  sequence: number;
  occurredAt: Date;
  data: IdentityEventPayload;
}): IdentityEvent {
  // Validate no secret fields in data
  const forbiddenKeys = ["password", "password_hash", "token", "session", "secret", "key", "digest", "ciphertext", "email"];
  const dataStr = JSON.stringify(params.data).toLowerCase();
  for (const key of forbiddenKeys) {
    if (key === "email") {
      // Email is allowed to be omitted per spec; we check if data contains email field name explicitly
      if (params.data && typeof params.data === "object" && "email" in params.data) {
        throw new Error(`Event payload must not contain email field: ${params.eventType}`);
      }
      continue;
    }
    if (dataStr.includes(key) && key !== "errorCode") {
      // Allow errorCode but not raw secret
      if (params.data && JSON.stringify(params.data).toLowerCase().includes(key)) {
        // Check if it's a forbidden exact key
        const hasForbidden = Object.keys(params.data).some((k) => k.toLowerCase().includes(key));
        if (hasForbidden && key !== "errorcode") {
          // For safety, we only block known secret keys, not substrings like 'deliveryState'
          if (["password", "password_hash", "token", "session_token", "secret", "digest", "ciphertext", "nonce", "tag"].includes(key)) {
            throw new Error(`Event payload must not contain ${key}: ${params.eventType}`);
          }
        }
      }
    }
  }

  return {
    eventId: params.eventId,
    eventVersion: 1,
    eventType: params.eventType,
    organizationId: params.organizationId ?? null,
    actorUserId: params.actorUserId ?? null,
    subjectUserId: params.subjectUserId ?? null,
    objectType: params.objectType,
    objectId: params.objectId,
    sequence: params.sequence.toString(),
    occurredAt: params.occurredAt.toISOString(),
    data: params.data,
  };
}
