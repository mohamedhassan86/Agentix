/**
 * Identity persistence port. Implementations live in infrastructure (Prisma)
 * or tests (in-memory). Application handlers never import Prisma.
 */

import type { UserAccount } from "@/domain/identity/entities/user-account";
import type { Organization } from "@/domain/identity/entities/organization";
import type { Membership } from "@/domain/identity/entities/membership";
import type { Invitation } from "@/domain/identity/entities/invitation";
import type { OneTimeToken } from "@/domain/identity/entities/one-time-token";
import type { Session } from "@/domain/identity/entities/session";
import type { IdentityEvent } from "@/domain/identity/events/identity-events";
import type { OrganizationRole } from "@/domain/identity/value-objects/organization-role";
import type { TokenPurpose } from "@/domain/identity/value-objects/opaque-token-digest";

export interface ThrottleRecord {
  emailKey: Uint8Array;
  failedCount: number;
  windowStartedAt: Date;
  lockedUntil: Date | null;
  updatedAt: Date;
}

export interface EncryptedOutboxRecord {
  id: string;
  workType: string;
  orgId: string | null;
  messageKind: "verification" | "invitation";
  recipientHash: string;
  ciphertext: Uint8Array | null;
  nonce: Uint8Array | null;
  tag: Uint8Array | null;
  keyVersion: number;
  status: "pending" | "processing" | "succeeded" | "failed";
  availableAt: Date;
  attemptCount: number;
  lastErrorCode: string | null;
  /** Test-only plaintext action URL. Production implementations MUST leave this undefined. */
  capturedActionUrl?: string;
  capturedRecipient?: string;
  capturedTemplate?: string;
}

export interface OrgMembershipRow {
  organization: Organization;
  membership: Membership;
  user: UserAccount;
}

export interface IdentityStore {
  transaction<T>(fn: (store: IdentityStore) => Promise<T>): Promise<T>;
  withOrgLock<T>(orgId: string, fn: () => Promise<T>): Promise<T>;

  findUserById(id: string): Promise<UserAccount | null>;
  findUserByEmailNormalized(emailNormalized: string): Promise<UserAccount | null>;
  createUser(user: UserAccount): Promise<void>;
  updateUser(user: UserAccount): Promise<void>;

  findOrgById(id: string): Promise<Organization | null>;
  findOrgBySlug(slug: string): Promise<Organization | null>;
  createOrg(org: Organization): Promise<void>;
  updateOrg(org: Organization): Promise<void>;
  listOrgsForUser(
    userId: string,
    params: { cursor?: string; limit: number },
  ): Promise<{ items: OrgMembershipRow[]; nextCursor: string | null }>;

  findMembershipById(id: string): Promise<Membership | null>;
  findActiveMembership(orgId: string, userId: string): Promise<Membership | null>;
  findAnyMembership(orgId: string, userId: string): Promise<Membership | null>;
  listActiveMembershipsByOrg(
    orgId: string,
    params: { cursor?: string; limit: number },
  ): Promise<{ items: OrgMembershipRow[]; nextCursor: string | null }>;
  listActiveMembershipsByUser(userId: string): Promise<Membership[]>;
  countActiveMembershipsByUser(userId: string): Promise<number>;
  countRolesByOrg(orgId: string): Promise<Record<OrganizationRole, number>>;
  createMembership(membership: Membership): Promise<void>;
  updateMembership(membership: Membership): Promise<void>;
  endAllActiveMembershipsForOrg(orgId: string, reason: "organization_deleted", now: Date): Promise<void>;
  endAllActiveMembershipsForUser(userId: string, reason: "account_deleted", now: Date): Promise<void>;

  findInvitationById(id: string): Promise<Invitation | null>;
  findPendingInvitation(orgId: string, emailNormalized: string): Promise<Invitation | null>;
  listInvitationsByOrg(
    orgId: string,
    params: { cursor?: string; limit: number },
  ): Promise<{ items: Invitation[]; nextCursor: string | null }>;
  createInvitation(invitation: Invitation): Promise<void>;
  updateInvitation(invitation: Invitation): Promise<void>;
  materializeExpiredPending(orgId: string, emailNormalized: string, now: Date): Promise<void>;
  revokePendingInvitationsForOrg(orgId: string, now: Date): Promise<void>;

  findTokenById(id: string): Promise<OneTimeToken | null>;
  findTokenByDigest(purpose: TokenPurpose, digest: Uint8Array): Promise<OneTimeToken | null>;
  findLatestTokenByUserPurpose(userId: string, purpose: TokenPurpose): Promise<OneTimeToken | null>;
  findLatestTokenByInvitation(invitationId: string): Promise<OneTimeToken | null>;
  createToken(token: OneTimeToken): Promise<void>;
  updateToken(token: OneTimeToken): Promise<void>;
  revokeOutstandingTokens(params: {
    userId?: string;
    invitationId?: string;
    purpose: TokenPurpose;
    now: Date;
  }): Promise<void>;

  findSessionById(id: string): Promise<Session | null>;
  findSessionByDigest(digest: Uint8Array): Promise<Session | null>;
  createSession(session: Session): Promise<void>;
  updateSession(session: Session): Promise<void>;
  revokeAllSessionsForUser(userId: string, now: Date): Promise<void>;
  clearActiveOrgForOrg(orgId: string, now: Date): Promise<void>;
  clearActiveOrgForUserInOrg(userId: string, orgId: string, now: Date): Promise<void>;

  findThrottle(emailNormalized: string): Promise<ThrottleRecord | null>;
  recordFailedAttempt(emailNormalized: string, now: Date): Promise<ThrottleRecord>;
  resetThrottle(emailNormalized: string): Promise<void>;

  nextEventSequence(): Promise<number>;
  appendEvent(event: IdentityEvent): Promise<void>;
  listEventsByOrg(orgId: string): Promise<IdentityEvent[]>;

  writeEncryptedOutbox(record: EncryptedOutboxRecord): Promise<void>;
  findPendingEncryptedOutbox(limit: number): Promise<EncryptedOutboxRecord[]>;
  findOutboxById(id: string): Promise<EncryptedOutboxRecord | null>;
  updateOutbox(record: EncryptedOutboxRecord): Promise<void>;
  purgeOutboxCiphertext(id: string): Promise<void>;
}

export interface IdentityHandlerDeps {
  store: IdentityStore;
  hasher: import("./password-hasher").PasswordHasher;
  tokens: import("./token-generator").TokenGenerator;
  encryption: import("./message-encryption").MessageEncryption;
  clock: import("@/application/shared/ports/clock").IClock;
  ids: import("@/application/shared/ports/id-generator").IIdGenerator;
  origin: string;
  sessionMaxAgeSeconds: number;
  deliveryKeyVersion: number;
}
