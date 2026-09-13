/**
 * Session lifecycle: start with null active org, rotate, revoke, last_seen, short-lived expiry.
 * Role is NOT stored in the cookie; it is resolved per request via membership projection.
 */

import type { IdentityStore } from "@/application/identity/ports/identity-store";
import type { TokenGenerator } from "@/application/identity/ports/token-generator";
import type { IClock } from "@/application/shared/ports/clock";
import type { IdentityActor } from "@/application/shared/context/request-context";
import { Session } from "@/domain/identity/entities/session";
import { TokenService } from "./token-service";

export class SessionService {
  constructor(
    private readonly store: IdentityStore,
    private readonly tokens: TokenGenerator,
    private readonly clock: IClock,
    private readonly sessionMaxAgeSeconds: number,
  ) {}

  async resolveActor(rawToken: string | null): Promise<IdentityActor | null> {
    if (!rawToken) return null;
    let parsed: { id: string; secret: string };
    try {
      parsed = TokenService.parseRawToken(rawToken);
    } catch {
      return null;
    }
    const digest = await this.tokens.digestSecret(parsed.secret);
    const session = await this.store.findSessionByDigest(digest);
    const now = this.clock.now();
    if (!session || !session.isValid(now)) return null;
    if (!this.tokens.verifyDigest(session.sessionTokenDigest, digest)) return null;

    const user = await this.store.findUserById(session.userId);
    if (!user || user.isDeleted()) return null;

    let activeOrgId = session.activeOrgId;
    let activeRole: IdentityActor["activeRole"] = null;

    if (user.isPlatformAdmin) {
      activeOrgId = null;
      if (session.activeOrgId) {
        session.clearOrganization(now);
        await this.store.updateSession(session);
      }
    } else if (session.activeOrgId) {
      const org = await this.store.findOrgById(session.activeOrgId);
      const membership = await this.store.findActiveMembership(session.activeOrgId, user.id);
      if (!org || org.isDeleted() || !membership) {
        session.clearOrganization(now);
        await this.store.updateSession(session);
        activeOrgId = null;
      } else {
        activeRole = membership.role;
        session.touch(now);
        await this.store.updateSession(session);
      }
    }

    return {
      userId: user.id,
      sessionId: session.id,
      sessionTokenDigest: session.sessionTokenDigest,
      activeOrgId,
      activeRole,
      isPlatformAdmin: user.isPlatformAdmin,
      emailNormalized: user.emailNormalized,
      displayName: user.displayName,
    };
  }

  async start(userId: string): Promise<{ session: Session; rawToken: string }> {
    const now = this.clock.now();
    const issued = await this.tokens.generate();
    const session = Session.start({
      id: issued.id,
      sessionTokenDigest: issued.digest,
      userId,
      expiresAt: new Date(now.getTime() + this.sessionMaxAgeSeconds * 1000),
      now,
    });
    await this.store.createSession(session);
    return { session, rawToken: issued.raw };
  }

  async revoke(sessionId: string): Promise<void> {
    const session = await this.store.findSessionById(sessionId);
    if (!session) return;
    session.revoke(this.clock.now());
    await this.store.updateSession(session);
  }

  async revokeAll(userId: string): Promise<void> {
    await this.store.revokeAllSessionsForUser(userId, this.clock.now());
  }
}
