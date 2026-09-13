/**
 * Prisma adapter wrapping the session repository.
 * Digest lookup is constant-time at the token service; this adapter never stores raw tokens.
 */

import type { IdentityStore } from "@/application/identity/ports/identity-store";
import type { TokenGenerator } from "@/application/identity/ports/token-generator";
import type { IClock } from "@/application/shared/ports/clock";
import { Session } from "@/domain/identity/entities/session";

export class IdentityAuthAdapter {
  constructor(
    private readonly store: IdentityStore,
    private readonly tokens: TokenGenerator,
    private readonly clock: IClock,
  ) {}

  async createSession(params: {
    id: string;
    digest: Uint8Array;
    userId: string;
    expiresAt: Date;
  }): Promise<void> {
    const session = Session.start({
      id: params.id,
      sessionTokenDigest: params.digest,
      userId: params.userId,
      expiresAt: params.expiresAt,
      now: this.clock.now(),
    });
    await this.store.createSession(session);
  }

  async getSessionAndUser(digest: Uint8Array) {
    const session = await this.store.findSessionByDigest(digest);
    if (!session || !session.isValid(this.clock.now())) return null;
    const user = await this.store.findUserById(session.userId);
    if (!user || user.isDeleted()) return null;
    return { session, user };
  }

  async deleteSession(sessionId: string): Promise<void> {
    const session = await this.store.findSessionById(sessionId);
    if (!session) return;
    session.revoke(this.clock.now());
    await this.store.updateSession(session);
  }
}
