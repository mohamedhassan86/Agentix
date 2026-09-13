import { UserAccount } from "@/domain/identity/entities/user-account";
import { Organization } from "@/domain/identity/entities/organization";
import { Membership } from "@/domain/identity/entities/membership";
import { Invitation } from "@/domain/identity/entities/invitation";
import { OneTimeToken } from "@/domain/identity/entities/one-time-token";
import { Session } from "@/domain/identity/entities/session";
import type { IdentityEvent } from "@/domain/identity/events/identity-events";
import type { OrganizationRole } from "@/domain/identity/value-objects/organization-role";
import type { TokenPurpose } from "@/domain/identity/value-objects/opaque-token-digest";
import type {
  EncryptedOutboxRecord,
  IdentityStore,
  OrgMembershipRow,
  ThrottleRecord,
} from "@/application/identity/ports/identity-store";
import { createHash } from "node:crypto";
import { THROTTLE_LOCK_MS, THROTTLE_MAX_FAILURES, THROTTLE_WINDOW_MS } from "@/application/identity/policies/throttle-policy";

function cloneUser(u: UserAccount): UserAccount {
  return UserAccount.create({ ...u });
}
function cloneOrg(o: Organization): Organization {
  return Organization.create({ ...o });
}
function cloneMembership(m: Membership): Membership {
  return Membership.create({ ...m });
}
function cloneInvitation(i: Invitation): Invitation {
  return Invitation.create({ ...i });
}
function cloneToken(t: OneTimeToken): OneTimeToken {
  return OneTimeToken.create({ ...t, tokenDigest: new Uint8Array(t.tokenDigest) });
}
function cloneSession(s: Session): Session {
  return Session.create({ ...s, sessionTokenDigest: new Uint8Array(s.sessionTokenDigest) });
}

function digestKey(bytes: Uint8Array): string {
  return Buffer.from(bytes).toString("hex");
}

export class MemoryIdentityStore implements IdentityStore {
  users = new Map<string, UserAccount>();
  usersByEmail = new Map<string, string>();
  orgs = new Map<string, Organization>();
  orgsBySlug = new Map<string, string>();
  memberships = new Map<string, Membership>();
  invitations = new Map<string, Invitation>();
  tokens = new Map<string, OneTimeToken>();
  sessions = new Map<string, Session>();
  sessionsByDigest = new Map<string, string>();
  throttles = new Map<string, ThrottleRecord>();
  events: IdentityEvent[] = [];
  outbox = new Map<string, EncryptedOutboxRecord>();
  sequence = 0;
  private orgLocks = new Map<string, Promise<void>>();

  async transaction<T>(fn: (store: IdentityStore) => Promise<T>): Promise<T> {
    return fn(this);
  }

  async withOrgLock<T>(orgId: string, fn: () => Promise<T>): Promise<T> {
    const previous = this.orgLocks.get(orgId) ?? Promise.resolve();
    let release!: () => void;
    const gate = new Promise<void>((resolve) => {
      release = resolve;
    });
    const chained = previous.then(() => gate);
    this.orgLocks.set(orgId, chained);
    await previous;
    try {
      return await fn();
    } finally {
      release();
    }
  }

  async findUserById(id: string): Promise<UserAccount | null> {
    const u = this.users.get(id);
    return u ? cloneUser(u) : null;
  }
  async findUserByEmailNormalized(emailNormalized: string): Promise<UserAccount | null> {
    const id = this.usersByEmail.get(emailNormalized.toLowerCase().trim());
    return id ? this.findUserById(id) : null;
  }
  async createUser(user: UserAccount): Promise<void> {
    if (this.usersByEmail.has(user.emailNormalized)) throw new Error("EMAIL_CONFLICT");
    this.users.set(user.id, cloneUser(user));
    this.usersByEmail.set(user.emailNormalized, user.id);
  }
  async updateUser(user: UserAccount): Promise<void> {
    this.users.set(user.id, cloneUser(user));
  }

  async findOrgById(id: string): Promise<Organization | null> {
    const o = this.orgs.get(id);
    return o ? cloneOrg(o) : null;
  }
  async findOrgBySlug(slug: string): Promise<Organization | null> {
    const id = this.orgsBySlug.get(slug.toLowerCase().trim());
    return id ? this.findOrgById(id) : null;
  }
  async createOrg(org: Organization): Promise<void> {
    if (this.orgsBySlug.has(org.slug)) throw new Error("SLUG_CONFLICT");
    this.orgs.set(org.id, cloneOrg(org));
    this.orgsBySlug.set(org.slug, org.id);
  }
  async updateOrg(org: Organization): Promise<void> {
    const previous = this.orgs.get(org.id);
    if (previous && previous.slug !== org.slug) {
      this.orgsBySlug.delete(previous.slug);
      if (this.orgsBySlug.has(org.slug)) throw new Error("SLUG_CONFLICT");
      this.orgsBySlug.set(org.slug, org.id);
    }
    this.orgs.set(org.id, cloneOrg(org));
  }
  async listOrgsForUser(
    userId: string,
    params: { cursor?: string; limit: number },
  ): Promise<{ items: OrgMembershipRow[]; nextCursor: string | null }> {
    const rows: OrgMembershipRow[] = [];
    for (const m of this.memberships.values()) {
      if (m.userId !== userId || !m.isActive()) continue;
      const org = this.orgs.get(m.orgId);
      const user = this.users.get(m.userId);
      if (!org || org.isDeleted() || !user) continue;
      rows.push({ organization: cloneOrg(org), membership: cloneMembership(m), user: cloneUser(user) });
    }
    rows.sort((a, b) => {
      const t = a.organization.createdAt.getTime() - b.organization.createdAt.getTime();
      return t !== 0 ? t : a.organization.id.localeCompare(b.organization.id);
    });
    return paginate(rows, params, (r) => r.organization.id);
  }

  async findMembershipById(id: string): Promise<Membership | null> {
    const m = this.memberships.get(id);
    return m ? cloneMembership(m) : null;
  }
  async findActiveMembership(orgId: string, userId: string): Promise<Membership | null> {
    for (const m of this.memberships.values()) {
      if (m.orgId === orgId && m.userId === userId && m.isActive()) return cloneMembership(m);
    }
    return null;
  }
  async findAnyMembership(orgId: string, userId: string): Promise<Membership | null> {
    let found: Membership | null = null;
    for (const m of this.memberships.values()) {
      if (m.orgId === orgId && m.userId === userId) {
        if (!found || m.createdAt > found.createdAt) found = m;
      }
    }
    return found ? cloneMembership(found) : null;
  }
  async listActiveMembershipsByOrg(
    orgId: string,
    params: { cursor?: string; limit: number },
  ): Promise<{ items: OrgMembershipRow[]; nextCursor: string | null }> {
    const rows: OrgMembershipRow[] = [];
    for (const m of this.memberships.values()) {
      if (m.orgId !== orgId || !m.isActive()) continue;
      const org = this.orgs.get(m.orgId);
      const user = this.users.get(m.userId);
      if (!org || !user) continue;
      rows.push({ organization: cloneOrg(org), membership: cloneMembership(m), user: cloneUser(user) });
    }
    rows.sort((a, b) => {
      const t = a.membership.createdAt.getTime() - b.membership.createdAt.getTime();
      return t !== 0 ? t : a.membership.id.localeCompare(b.membership.id);
    });
    return paginate(rows, params, (r) => r.membership.id);
  }
  async listActiveMembershipsByUser(userId: string): Promise<Membership[]> {
    return [...this.memberships.values()].filter((m) => m.userId === userId && m.isActive()).map(cloneMembership);
  }
  async countActiveMembershipsByUser(userId: string): Promise<number> {
    return (await this.listActiveMembershipsByUser(userId)).length;
  }
  async countRolesByOrg(orgId: string): Promise<Record<OrganizationRole, number>> {
    const counts: Record<OrganizationRole, number> = { viewer: 0, member: 0, admin: 0, owner: 0 };
    for (const m of this.memberships.values()) {
      if (m.orgId === orgId && m.isActive()) counts[m.role] += 1;
    }
    return counts;
  }
  async createMembership(membership: Membership): Promise<void> {
    this.memberships.set(membership.id, cloneMembership(membership));
  }
  async updateMembership(membership: Membership): Promise<void> {
    this.memberships.set(membership.id, cloneMembership(membership));
  }
  async endAllActiveMembershipsForOrg(orgId: string, reason: "organization_deleted", now: Date): Promise<void> {
    for (const m of this.memberships.values()) {
      if (m.orgId === orgId && m.isActive()) {
        if (m.role === "owner") {
          m.role = "admin";
        }
        m.endedAt = now;
        m.endReason = reason;
        m.updatedAt = now;
        m.version += 1;
      }
    }
  }
  async endAllActiveMembershipsForUser(userId: string, reason: "account_deleted", now: Date): Promise<void> {
    for (const m of this.memberships.values()) {
      if (m.userId === userId && m.isActive() && m.role !== "owner") {
        m.endedAt = now;
        m.endReason = reason;
        m.updatedAt = now;
        m.version += 1;
      }
    }
  }

  async findInvitationById(id: string): Promise<Invitation | null> {
    const i = this.invitations.get(id);
    return i ? cloneInvitation(i) : null;
  }
  async findPendingInvitation(orgId: string, emailNormalized: string): Promise<Invitation | null> {
    const email = emailNormalized.toLowerCase().trim();
    for (const i of this.invitations.values()) {
      if (i.orgId === orgId && i.emailNormalized === email && i.status === "pending") return cloneInvitation(i);
    }
    return null;
  }
  async listInvitationsByOrg(
    orgId: string,
    params: { cursor?: string; limit: number },
  ): Promise<{ items: Invitation[]; nextCursor: string | null }> {
    const items = [...this.invitations.values()]
      .filter((i) => i.orgId === orgId)
      .sort((a, b) => {
        const t = b.createdAt.getTime() - a.createdAt.getTime();
        return t !== 0 ? t : b.id.localeCompare(a.id);
      })
      .map(cloneInvitation);
    return paginate(items, params, (i) => i.id);
  }
  async createInvitation(invitation: Invitation): Promise<void> {
    this.invitations.set(invitation.id, cloneInvitation(invitation));
  }
  async updateInvitation(invitation: Invitation): Promise<void> {
    this.invitations.set(invitation.id, cloneInvitation(invitation));
  }
  async materializeExpiredPending(orgId: string, emailNormalized: string, now: Date): Promise<void> {
    const email = emailNormalized.toLowerCase().trim();
    for (const i of this.invitations.values()) {
      if (i.orgId === orgId && i.emailNormalized === email && i.status === "pending" && i.expiresAt.getTime() <= now.getTime()) {
        i.status = "expired";
        i.updatedAt = now;
        i.version += 1;
      }
    }
  }
  async revokePendingInvitationsForOrg(orgId: string, now: Date): Promise<void> {
    for (const i of this.invitations.values()) {
      if (i.orgId === orgId && i.status === "pending") {
        i.status = "revoked";
        i.revokedAt = now;
        i.updatedAt = now;
        i.version += 1;
      }
    }
  }

  async findTokenById(id: string): Promise<OneTimeToken | null> {
    const t = this.tokens.get(id);
    return t ? cloneToken(t) : null;
  }
  async findTokenByDigest(purpose: TokenPurpose, digest: Uint8Array): Promise<OneTimeToken | null> {
    for (const t of this.tokens.values()) {
      if (t.purpose === purpose && t.equalsDigest(digest)) return cloneToken(t);
    }
    return null;
  }
  async findLatestTokenByUserPurpose(userId: string, purpose: TokenPurpose): Promise<OneTimeToken | null> {
    let found: OneTimeToken | null = null;
    for (const t of this.tokens.values()) {
      if (t.userId === userId && t.purpose === purpose) {
        if (!found || t.version > found.version) found = t;
      }
    }
    return found ? cloneToken(found) : null;
  }
  async findLatestTokenByInvitation(invitationId: string): Promise<OneTimeToken | null> {
    let found: OneTimeToken | null = null;
    for (const t of this.tokens.values()) {
      if (t.invitationId === invitationId) {
        if (!found || t.version > found.version) found = t;
      }
    }
    return found ? cloneToken(found) : null;
  }
  async createToken(token: OneTimeToken): Promise<void> {
    this.tokens.set(token.id, cloneToken(token));
  }
  async updateToken(token: OneTimeToken): Promise<void> {
    this.tokens.set(token.id, cloneToken(token));
  }
  async revokeOutstandingTokens(params: {
    userId?: string;
    invitationId?: string;
    purpose: TokenPurpose;
    now: Date;
  }): Promise<void> {
    for (const t of this.tokens.values()) {
      if (t.purpose !== params.purpose) continue;
      if (params.userId && t.userId !== params.userId) continue;
      if (params.invitationId && t.invitationId !== params.invitationId) continue;
      if (t.consumedAt || t.revokedAt) continue;
      t.revokedAt = params.now;
    }
  }

  async findSessionById(id: string): Promise<Session | null> {
    const s = this.sessions.get(id);
    return s ? cloneSession(s) : null;
  }
  async findSessionByDigest(digest: Uint8Array): Promise<Session | null> {
    const id = this.sessionsByDigest.get(digestKey(digest));
    return id ? this.findSessionById(id) : null;
  }
  async createSession(session: Session): Promise<void> {
    this.sessions.set(session.id, cloneSession(session));
    this.sessionsByDigest.set(digestKey(session.sessionTokenDigest), session.id);
  }
  async updateSession(session: Session): Promise<void> {
    const previous = this.sessions.get(session.id);
    if (previous) {
      this.sessionsByDigest.delete(digestKey(previous.sessionTokenDigest));
    }
    this.sessions.set(session.id, cloneSession(session));
    this.sessionsByDigest.set(digestKey(session.sessionTokenDigest), session.id);
  }
  async revokeAllSessionsForUser(userId: string, now: Date): Promise<void> {
    for (const s of this.sessions.values()) {
      if (s.userId === userId && !s.revokedAt) {
        s.revokedAt = now;
        s.updatedAt = now;
        s.version += 1;
      }
    }
  }
  async clearActiveOrgForOrg(orgId: string, now: Date): Promise<void> {
    for (const s of this.sessions.values()) {
      if (s.activeOrgId === orgId && !s.revokedAt) {
        s.activeOrgId = null;
        s.updatedAt = now;
        s.version += 1;
      }
    }
  }
  async clearActiveOrgForUserInOrg(userId: string, orgId: string, now: Date): Promise<void> {
    for (const s of this.sessions.values()) {
      if (s.userId === userId && s.activeOrgId === orgId && !s.revokedAt) {
        s.activeOrgId = null;
        s.updatedAt = now;
        s.version += 1;
      }
    }
  }

  async findThrottle(emailNormalized: string): Promise<ThrottleRecord | null> {
    return this.throttles.get(hashEmail(emailNormalized)) ?? null;
  }
  async recordFailedAttempt(emailNormalized: string, now: Date): Promise<ThrottleRecord> {
    const key = hashEmail(emailNormalized);
    const existing = this.throttles.get(key);
    const emailKey = new Uint8Array(createHash("sha256").update(emailNormalized.toLowerCase().trim()).digest());
    if (!existing) {
      const created: ThrottleRecord = {
        emailKey,
        failedCount: 1,
        windowStartedAt: now,
        lockedUntil: null,
        updatedAt: now,
      };
      this.throttles.set(key, created);
      return created;
    }
    if (existing.lockedUntil && existing.lockedUntil.getTime() > now.getTime()) {
      existing.updatedAt = now;
      return existing;
    }
    const windowExpired = now.getTime() - existing.windowStartedAt.getTime() > THROTTLE_WINDOW_MS;
    if (windowExpired) {
      existing.failedCount = 1;
      existing.windowStartedAt = now;
      existing.lockedUntil = null;
    } else {
      existing.failedCount += 1;
      if (existing.failedCount >= THROTTLE_MAX_FAILURES) {
        existing.lockedUntil = new Date(now.getTime() + THROTTLE_LOCK_MS);
      }
    }
    existing.updatedAt = now;
    return existing;
  }
  async resetThrottle(emailNormalized: string): Promise<void> {
    this.throttles.delete(hashEmail(emailNormalized));
  }

  async nextEventSequence(): Promise<number> {
    this.sequence += 1;
    return this.sequence;
  }
  async appendEvent(event: IdentityEvent): Promise<void> {
    this.events.push(event);
  }
  async listEventsByOrg(orgId: string): Promise<IdentityEvent[]> {
    return this.events.filter((e) => e.organizationId === orgId);
  }

  async writeEncryptedOutbox(record: EncryptedOutboxRecord): Promise<void> {
    this.outbox.set(record.id, { ...record });
  }
  async findPendingEncryptedOutbox(limit: number): Promise<EncryptedOutboxRecord[]> {
    return [...this.outbox.values()]
      .filter((r) => r.status === "pending")
      .slice(0, limit)
      .map((r) => ({ ...r }));
  }
  async findOutboxById(id: string): Promise<EncryptedOutboxRecord | null> {
    const r = this.outbox.get(id);
    return r ? { ...r } : null;
  }
  async updateOutbox(record: EncryptedOutboxRecord): Promise<void> {
    this.outbox.set(record.id, { ...record });
  }
  async purgeOutboxCiphertext(id: string): Promise<void> {
    const r = this.outbox.get(id);
    if (!r) return;
    r.ciphertext = null;
    r.nonce = null;
    r.tag = null;
    r.capturedActionUrl = undefined;
  }

  lastCapturedActionUrl(): string | null {
    const msgs = [...this.outbox.values()].filter((m) => m.capturedActionUrl);
    if (msgs.length === 0) return null;
    return msgs[msgs.length - 1].capturedActionUrl ?? null;
  }

  lastCapturedToken(): string | null {
    const url = this.lastCapturedActionUrl();
    if (!url) return null;
    try {
      return new URL(url).searchParams.get("token");
    } catch {
      const match = url.match(/token=([^&]+)/);
      return match ? decodeURIComponent(match[1]) : null;
    }
  }
}

function hashEmail(emailNormalized: string): string {
  return createHash("sha256").update(emailNormalized.toLowerCase().trim()).digest("hex");
}

function paginate<T>(
  items: T[],
  params: { cursor?: string; limit: number },
  idOf: (item: T) => string,
): { items: T[]; nextCursor: string | null } {
  let start = 0;
  if (params.cursor) {
    const idx = items.findIndex((i) => idOf(i) === params.cursor);
    start = idx >= 0 ? idx + 1 : 0;
  }
  const slice = items.slice(start, start + params.limit + 1);
  const hasNext = slice.length > params.limit;
  const page = hasNext ? slice.slice(0, params.limit) : slice;
  return { items: page, nextCursor: hasNext ? idOf(page[page.length - 1]) : null };
}
