import type { PrismaClient } from "../../../generated/prisma/client";
import type { OneTimeToken } from "../../../domain/identity/entities/one-time-token";

export class TokenRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async findById(id: string): Promise<OneTimeToken | null> {
    const row = await (this.prisma.oneTimeToken as any).findUnique({ where: { id } });
    if (!row) return null;
    return this.mapToDomain(row);
  }

  async findByDigest(purpose: string, digest: Uint8Array): Promise<OneTimeToken | null> {
    const row = await (this.prisma.oneTimeToken as any).findFirst({
      where: { purpose: purpose as any, tokenDigest: digest as any },
    });
    if (!row) return null;
    return this.mapToDomain(row);
  }

  async findLatestByUserAndPurpose(userId: string, purpose: string): Promise<OneTimeToken | null> {
    const row = await (this.prisma.oneTimeToken as any).findFirst({
      where: { userId, purpose: purpose as any },
      orderBy: { version: "desc" },
    });
    if (!row) return null;
    return this.mapToDomain(row);
  }

  async findLatestByInvitation(invitationId: string): Promise<OneTimeToken | null> {
    const row = await (this.prisma.oneTimeToken as any).findFirst({
      where: { invitationId },
      orderBy: { version: "desc" },
    });
    if (!row) return null;
    return this.mapToDomain(row);
  }

  async create(token: OneTimeToken): Promise<void> {
    await (this.prisma.oneTimeToken as any).create({
      data: {
        id: token.id,
        purpose: token.purpose,
        userId: token.userId,
        invitationId: token.invitationId,
        orgId: token.orgId,
        tokenDigest: token.tokenDigest as any,
        version: token.version,
        expiresAt: token.expiresAt,
        consumedAt: token.consumedAt,
        revokedAt: token.revokedAt,
        createdAt: token.createdAt,
      },
    });
  }

  async update(token: OneTimeToken): Promise<void> {
    await (this.prisma.oneTimeToken as any).update({
      where: { id: token.id },
      data: {
        tokenDigest: token.tokenDigest as any,
        version: token.version,
        expiresAt: token.expiresAt,
        consumedAt: token.consumedAt,
        revokedAt: token.revokedAt,
      },
    });
  }

  async revokeAllByInvitationId(invitationId: string, now: Date): Promise<void> {
    await (this.prisma.oneTimeToken as any).updateMany({
      where: { invitationId, consumedAt: null, revokedAt: null },
      data: { revokedAt: now },
    });
  }

  async revokeAllByUserIdAndPurpose(userId: string, purpose: string, now: Date): Promise<void> {
    await (this.prisma.oneTimeToken as any).updateMany({
      where: { userId, purpose: purpose as any, consumedAt: null, revokedAt: null },
      data: { revokedAt: now },
    });
  }

  private mapToDomain(row: any): OneTimeToken {
    const { OneTimeToken } = require("../../../domain/identity/entities/one-time-token");
    return OneTimeToken.create({
      id: row.id,
      purpose: row.purpose,
      userId: row.userId,
      invitationId: row.invitationId,
      orgId: row.orgId,
      tokenDigest: row.tokenDigest,
      version: row.version,
      expiresAt: row.expiresAt,
      consumedAt: row.consumedAt,
      revokedAt: row.revokedAt,
      createdAt: row.createdAt,
    });
  }
}
