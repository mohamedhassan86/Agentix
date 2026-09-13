import type { PrismaClient } from "../../../generated/prisma/client";
import type { Session } from "../../../domain/identity/entities/session";

export class SessionRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async findById(id: string): Promise<Session | null> {
    const row = await (this.prisma.session as any).findUnique({ where: { id } });
    if (!row) return null;
    return this.mapToDomain(row);
  }

  async findByDigest(digest: Uint8Array): Promise<Session | null> {
    const row = await (this.prisma.session as any).findUnique({
      where: { sessionTokenDigest: digest as any },
    });
    if (!row) return null;
    return this.mapToDomain(row);
  }

  async create(session: Session): Promise<void> {
    await (this.prisma.session as any).create({
      data: {
        id: session.id,
        sessionTokenDigest: session.sessionTokenDigest as any,
        userId: session.userId,
        activeOrgId: session.activeOrgId,
        expiresAt: session.expiresAt,
        lastSeenAt: session.lastSeenAt,
        createdAt: session.createdAt,
        updatedAt: session.updatedAt,
        revokedAt: session.revokedAt,
        version: session.version,
      },
    });
  }

  async update(session: Session): Promise<void> {
    await (this.prisma.session as any).update({
      where: { id: session.id, version: session.version - 1 },
      data: {
        sessionTokenDigest: session.sessionTokenDigest as any,
        activeOrgId: session.activeOrgId,
        expiresAt: session.expiresAt,
        lastSeenAt: session.lastSeenAt,
        updatedAt: session.updatedAt,
        revokedAt: session.revokedAt,
        version: session.version,
      },
    });
  }

  async revokeAllByUserId(userId: string, now: Date): Promise<void> {
    await (this.prisma.session as any).updateMany({
      where: { userId, revokedAt: null },
      data: { revokedAt: now, updatedAt: now },
    });
  }

  async clearActiveOrgForOrg(orgId: string, now: Date): Promise<void> {
    await (this.prisma.session as any).updateMany({
      where: { activeOrgId: orgId, revokedAt: null },
      data: { activeOrgId: null, updatedAt: now },
    });
  }

  async clearActiveOrgForUserInOrg(userId: string, orgId: string, now: Date): Promise<void> {
    await (this.prisma.session as any).updateMany({
      where: { userId, activeOrgId: orgId, revokedAt: null },
      data: { activeOrgId: null, updatedAt: now },
    });
  }

  private mapToDomain(row: any): Session {
    const { Session } = require("../../../domain/identity/entities/session");
    return Session.create({
      id: row.id,
      sessionTokenDigest: row.sessionTokenDigest,
      userId: row.userId,
      activeOrgId: row.activeOrgId,
      expiresAt: row.expiresAt,
      lastSeenAt: row.lastSeenAt,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
      revokedAt: row.revokedAt,
      version: row.version,
    });
  }
}
