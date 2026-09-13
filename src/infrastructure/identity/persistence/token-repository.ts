import type { PrismaClient } from "../../../generated/prisma/client";
import { OneTimeToken } from "../../../domain/identity/entities/one-time-token";
import type { OneTimeToken as OneTimeTokenType } from "../../../domain/identity/entities/one-time-token";

export class TokenRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async findById(id: string): Promise<OneTimeTokenType | null> {
    const row = await (this.prisma.oneTimeToken as any).findUnique({ where: { id } });
    if (!row) return null;
    return this.mapToDomain(row);
  }

  async findByDigest(purpose: string, digest: Uint8Array): Promise<OneTimeTokenType | null> {
    const row = await (this.prisma.oneTimeToken as any).findFirst({
      where: { purpose: purpose as any, tokenDigest: digest as any },
    });
    if (!row) return null;
    return this.mapToDomain(row);
  }

  async findLatestByUserAndPurpose(userId: string, purpose: string): Promise<OneTimeTokenType | null> {
    const row = await (this.prisma.oneTimeToken as any).findFirst({
      where: { userId, purpose: purpose as any },
      orderBy: { version: "desc" },
    });
    if (!row) return null;
    return this.mapToDomain(row);
  }

  async findLatestByInvitation(invitationId: string): Promise<OneTimeTokenType | null> {
    const row = await (this.prisma.oneTimeToken as any).findFirst({
      where: { invitationId },
      orderBy: { version: "desc" },
    });
    if (!row) return null;
    return this.mapToDomain(row);
  }

  async create(token: OneTimeTokenType): Promise<void> {
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

  async update(token: OneTimeTokenType): Promise<void> {
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

  private mapToDomain(row: any): OneTimeTokenType {
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
