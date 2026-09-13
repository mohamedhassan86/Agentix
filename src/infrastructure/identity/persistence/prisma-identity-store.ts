import type { PrismaClient } from "../../../generated/prisma/client";
import { UserAccount } from "../../../domain/identity/entities/user-account";
import { Organization } from "../../../domain/identity/entities/organization";
import { Membership } from "../../../domain/identity/entities/membership";
import { Invitation } from "../../../domain/identity/entities/invitation";
import { OneTimeToken } from "../../../domain/identity/entities/one-time-token";
import { Session } from "../../../domain/identity/entities/session";
import type { IdentityEvent } from "../../../domain/identity/events/identity-events";
import type { OrganizationRole } from "../../../domain/identity/value-objects/organization-role";
import type { TokenPurpose } from "../../../domain/identity/value-objects/opaque-token-digest";
import type {
  EncryptedOutboxRecord,
  IdentityStore,
  OrgMembershipRow,
  ThrottleRecord,
} from "../../../application/identity/ports/identity-store";
import { UserRepository } from "./user-repository";
import { OrganizationRepository } from "./organization-repository";
import { MembershipRepository } from "./membership-repository";
import { InvitationRepository } from "./invitation-repository";
import { TokenRepository } from "./token-repository";
import { SessionRepository } from "./session-repository";
import { ThrottleRepository } from "./throttle-repository";
import { IdentityEventRepository } from "./identity-event-repository";
import { IdentityOutboxWriter } from "./outbox-extension";

export class PrismaIdentityStore implements IdentityStore {
  private readonly users: UserRepository;
  private readonly orgs: OrganizationRepository;
  private readonly memberships: MembershipRepository;
  private readonly invitations: InvitationRepository;
  private readonly tokens: TokenRepository;
  private readonly sessions: SessionRepository;
  private readonly throttles: ThrottleRepository;
  private readonly events: IdentityEventRepository;
  private readonly outbox: IdentityOutboxWriter;

  constructor(private readonly prisma: PrismaClient) {
    this.users = new UserRepository(prisma);
    this.orgs = new OrganizationRepository(prisma);
    this.memberships = new MembershipRepository(prisma);
    this.invitations = new InvitationRepository(prisma);
    this.tokens = new TokenRepository(prisma);
    this.sessions = new SessionRepository(prisma);
    this.throttles = new ThrottleRepository(prisma);
    this.events = new IdentityEventRepository(prisma);
    this.outbox = new IdentityOutboxWriter(prisma);
  }

  async transaction<T>(fn: (store: IdentityStore) => Promise<T>): Promise<T> {
    return (this.prisma as any).$transaction(async (tx: PrismaClient) => {
      const inner = new PrismaIdentityStore(tx);
      return fn(inner);
    });
  }

  findUserById(id: string) {
    return this.users.findById(id);
  }
  findUserByEmailNormalized(emailNormalized: string) {
    return this.users.findByEmailNormalized(emailNormalized);
  }
  createUser(user: UserAccount) {
    return this.users.create(user);
  }
  updateUser(user: UserAccount) {
    return this.users.update(user);
  }

  findOrgById(id: string) {
    return this.orgs.findById(id);
  }
  findOrgBySlug(slug: string) {
    return this.orgs.findBySlug(slug);
  }
  createOrg(org: Organization) {
    return this.orgs.create(org);
  }
  updateOrg(org: Organization) {
    return this.orgs.update(org);
  }
  async listOrgsForUser(userId: string, params: { cursor?: string; limit: number }) {
    const result = await this.orgs.listByUserId(userId, params);
    const items: OrgMembershipRow[] = [];
    for (const row of result.items) {
      const org = Organization.create({
        id: row.organization.id,
        name: row.organization.name,
        slug: row.organization.slug,
        ownerUserId: row.organization.ownerUserId,
        deletedAt: row.organization.deletedAt,
        createdAt: row.organization.createdAt,
        updatedAt: row.organization.updatedAt,
        version: row.organization.version,
      });
      const membership = Membership.create({
        id: row.id,
        orgId: row.orgId,
        userId: row.userId,
        role: row.role,
        joinedAt: row.joinedAt,
        endedAt: row.endedAt,
        endReason: row.endReason,
        createdAt: row.createdAt,
        updatedAt: row.updatedAt,
        version: row.version,
      });
      const user = await this.users.findById(row.userId);
      if (!user) continue;
      items.push({ organization: org, membership, user });
    }
    return { items, nextCursor: result.nextCursor };
  }

  findMembershipById(id: string) {
    return this.memberships.findById(id);
  }
  findActiveMembership(orgId: string, userId: string) {
    return this.memberships.findActiveByOrgAndUser(orgId, userId);
  }
  findAnyMembership(orgId: string, userId: string) {
    return this.memberships.findAnyByOrgAndUser(orgId, userId);
  }
  async listActiveMembershipsByOrg(orgId: string, params: { cursor?: string; limit: number }) {
    const result = await this.memberships.listActiveByOrgId(orgId, params);
    const items: OrgMembershipRow[] = [];
    for (const m of result.items) {
      const org = await this.orgs.findById(orgId);
      const user = await this.users.findById(m.userId);
      if (!org || !user) continue;
      items.push({ organization: org, membership: m, user });
    }
    return { items, nextCursor: result.nextCursor };
  }
  async listActiveMembershipsByUser(userId: string) {
    const rows = await (this.prisma.membership as any).findMany({ where: { userId, endedAt: null } });
    return rows.map((row: any) =>
      Membership.create({
        id: row.id,
        orgId: row.orgId,
        userId: row.userId,
        role: row.role,
        joinedAt: row.joinedAt,
        endedAt: row.endedAt,
        endReason: row.endReason,
        createdAt: row.createdAt,
        updatedAt: row.updatedAt,
        version: row.version,
      }),
    );
  }
  countActiveMembershipsByUser(userId: string) {
    return this.memberships.countActiveByUserId(userId);
  }
  async countRolesByOrg(orgId: string) {
    const counts = await this.memberships.countActiveByOrgId(orgId);
    return {
      viewer: counts.viewer ?? 0,
      member: counts.member ?? 0,
      admin: counts.admin ?? 0,
      owner: counts.owner ?? 0,
    } as Record<OrganizationRole, number>;
  }
  createMembership(membership: Membership) {
    return this.memberships.create(membership);
  }
  updateMembership(membership: Membership) {
    return this.memberships.update(membership);
  }
  async endAllActiveMembershipsForOrg(orgId: string, reason: "organization_deleted", now: Date) {
    await (this.prisma.membership as any).updateMany({
      where: { orgId, endedAt: null },
      data: { endedAt: now, endReason: reason, updatedAt: now },
    });
  }
  async endAllActiveMembershipsForUser(userId: string, reason: "account_deleted", now: Date) {
    await (this.prisma.membership as any).updateMany({
      where: { userId, endedAt: null, role: { not: "owner" } },
      data: { endedAt: now, endReason: reason, updatedAt: now },
    });
  }

  findInvitationById(id: string) {
    return this.invitations.findById(id);
  }
  findPendingInvitation(orgId: string, emailNormalized: string) {
    return this.invitations.findPendingByOrgAndEmail(orgId, emailNormalized);
  }
  async listInvitationsByOrg(orgId: string, params: { cursor?: string; limit: number }) {
    const result = await this.invitations.listByOrgId(orgId, params);
    return { items: result.items, nextCursor: result.nextCursor };
  }
  createInvitation(invitation: Invitation) {
    return this.invitations.create(invitation);
  }
  updateInvitation(invitation: Invitation) {
    return this.invitations.update(invitation);
  }
  materializeExpiredPending(orgId: string, emailNormalized: string, now: Date) {
    return this.invitations.materializeExpiredPending(orgId, emailNormalized, now);
  }
  async revokePendingInvitationsForOrg(orgId: string, now: Date) {
    await (this.prisma.invitation as any).updateMany({
      where: { orgId, status: "pending" },
      data: { status: "revoked", revokedAt: now, updatedAt: now },
    });
  }

  findTokenById(id: string) {
    return this.tokens.findById(id);
  }
  findTokenByDigest(purpose: TokenPurpose, digest: Uint8Array) {
    return this.tokens.findByDigest(purpose, digest);
  }
  findLatestTokenByUserPurpose(userId: string, purpose: TokenPurpose) {
    return this.tokens.findLatestByUserAndPurpose(userId, purpose);
  }
  findLatestTokenByInvitation(invitationId: string) {
    return this.tokens.findLatestByInvitation(invitationId);
  }
  createToken(token: OneTimeToken) {
    return this.tokens.create(token);
  }
  updateToken(token: OneTimeToken) {
    return this.tokens.update(token);
  }
  async revokeOutstandingTokens(params: {
    userId?: string;
    invitationId?: string;
    purpose: TokenPurpose;
    now: Date;
  }) {
    if (params.invitationId) {
      await this.tokens.revokeAllByInvitationId(params.invitationId, params.now);
    }
    if (params.userId) {
      await this.tokens.revokeAllByUserIdAndPurpose(params.userId, params.purpose, params.now);
    }
  }

  findSessionById(id: string) {
    return this.sessions.findById(id);
  }
  findSessionByDigest(digest: Uint8Array) {
    return this.sessions.findByDigest(digest);
  }
  createSession(session: Session) {
    return this.sessions.create(session);
  }
  updateSession(session: Session) {
    return this.sessions.update(session);
  }
  revokeAllSessionsForUser(userId: string, now: Date) {
    return this.sessions.revokeAllByUserId(userId, now);
  }
  clearActiveOrgForOrg(orgId: string, now: Date) {
    return this.sessions.clearActiveOrgForOrg(orgId, now);
  }
  clearActiveOrgForUserInOrg(userId: string, orgId: string, now: Date) {
    return this.sessions.clearActiveOrgForUserInOrg(userId, orgId, now);
  }

  findThrottle(emailNormalized: string) {
    return this.throttles.findByEmail(emailNormalized);
  }
  recordFailedAttempt(emailNormalized: string, now: Date) {
    return this.throttles.upsertFailedAttempt(emailNormalized, now);
  }
  resetThrottle(emailNormalized: string) {
    return this.throttles.resetByEmail(emailNormalized);
  }

  async nextEventSequence(): Promise<number> {
    const last = await (this.prisma.identityEvent as any).findFirst({ orderBy: { sequence: "desc" } });
    return Number(last?.sequence ?? 0) + 1;
  }
  appendEvent(event: IdentityEvent) {
    return this.events.create(event);
  }
  async listEventsByOrg(orgId: string): Promise<IdentityEvent[]> {
    const rows = await this.events.findByOrgId(orgId, { limit: 100 });
    return rows.map((row: any) => ({
      eventId: row.id,
      eventVersion: 1,
      eventType: String(row.eventType).replaceAll("_", ".") as IdentityEvent["eventType"],
      organizationId: row.orgId,
      actorUserId: row.actorUserId,
      subjectUserId: row.subjectUserId,
      objectType: row.objectType,
      objectId: row.objectId,
      sequence: String(row.sequence),
      occurredAt: row.occurredAt.toISOString(),
      data: row.payload,
    }));
  }

  async writeEncryptedOutbox(record: EncryptedOutboxRecord): Promise<void> {
    await (this.prisma.outboxMessage as any).create({
      data: {
        id: record.id,
        workType: record.workType,
        schemaVersion: 1,
        scope: record.orgId ? "tenant" : "global",
        orgId: record.orgId,
        idempotencyKey: record.id,
        correlationId: record.id,
        payload: {
          messageKind: record.messageKind,
          recipientHash: record.recipientHash,
          keyVersion: record.keyVersion,
          redacted: true,
        },
        status: record.status,
        availableAt: record.availableAt,
        maxAttempts: 3,
        attemptCount: record.attemptCount,
        messageKind: record.messageKind,
        recipientHash: record.recipientHash,
        ciphertext: record.ciphertext as any,
        nonce: record.nonce as any,
        tag: record.tag as any,
        keyVersion: record.keyVersion,
        encryptedAt: record.availableAt,
      },
    });
  }
  async findPendingEncryptedOutbox(limit: number): Promise<EncryptedOutboxRecord[]> {
    const rows = await this.outbox.findPendingByKind("verification", limit);
    const inviteRows = await this.outbox.findPendingByKind("invitation", limit);
    return [...rows, ...inviteRows].slice(0, limit).map(mapOutbox);
  }
  async findOutboxById(id: string): Promise<EncryptedOutboxRecord | null> {
    const row = await this.outbox.findEncryptedById(id);
    return row ? mapOutbox(row) : null;
  }
  async updateOutbox(record: EncryptedOutboxRecord): Promise<void> {
    await (this.prisma.outboxMessage as any).update({
      where: { id: record.id },
      data: {
        status: record.status,
        attemptCount: record.attemptCount,
        lastErrorCode: record.lastErrorCode,
      },
    });
  }
  purgeOutboxCiphertext(id: string) {
    return this.outbox.purgeCiphertext(id);
  }
}

function mapOutbox(row: any): EncryptedOutboxRecord {
  return {
    id: row.id,
    workType: row.workType,
    orgId: row.orgId,
    messageKind: row.messageKind,
    recipientHash: row.recipientHash,
    ciphertext: row.ciphertext,
    nonce: row.nonce,
    tag: row.tag,
    keyVersion: row.keyVersion ?? 1,
    status: row.status,
    availableAt: row.availableAt,
    attemptCount: row.attemptCount ?? 0,
    lastErrorCode: row.lastErrorCode ?? null,
  };
}

export type { ThrottleRecord };
