import type { PrismaClient } from "../../../generated/prisma/client";
import type { UserAccount } from "../../../domain/identity/entities/user-account";

export class UserRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async findById(id: string): Promise<UserAccount | null> {
    const row = await (this.prisma.user as any).findUnique({ where: { id } });
    if (!row) return null;
    return this.mapToDomain(row);
  }

  async findByEmailNormalized(emailNormalized: string): Promise<UserAccount | null> {
    const row = await (this.prisma.user as any).findUnique({
      where: { emailNormalized: emailNormalized.toLowerCase().trim() },
    });
    if (!row) return null;
    return this.mapToDomain(row);
  }

  async create(user: UserAccount): Promise<void> {
    await (this.prisma.user as any).create({
      data: {
        id: user.id,
        emailNormalized: user.emailNormalized,
        displayName: user.displayName,
        passwordHash: user.passwordHash,
        emailVerifiedAt: user.emailVerifiedAt,
        isPlatformAdmin: user.isPlatformAdmin,
        deletedAt: user.deletedAt,
        createdAt: user.createdAt,
        updatedAt: user.updatedAt,
        version: user.version,
      },
    });
  }

  async update(user: UserAccount): Promise<void> {
    await (this.prisma.user as any).update({
      where: { id: user.id, version: user.version - 1 },
      data: {
        emailNormalized: user.emailNormalized,
        displayName: user.displayName,
        passwordHash: user.passwordHash,
        emailVerifiedAt: user.emailVerifiedAt,
        isPlatformAdmin: user.isPlatformAdmin,
        deletedAt: user.deletedAt,
        updatedAt: user.updatedAt,
        version: user.version,
      },
    });
  }

  async existsByEmailNormalized(emailNormalized: string): Promise<boolean> {
    const count = await (this.prisma.user as any).count({
      where: { emailNormalized: emailNormalized.toLowerCase().trim() },
    });
    return count > 0;
  }

  async countActiveMemberships(userId: string): Promise<number> {
    return (this.prisma.membership as any).count({
      where: { userId, endedAt: null },
    });
  }

  private mapToDomain(row: any): UserAccount {
    const { UserAccount } = require("../../../domain/identity/entities/user-account");
    return UserAccount.create({
      id: row.id,
      emailNormalized: row.emailNormalized,
      displayName: row.displayName,
      passwordHash: row.passwordHash,
      emailVerifiedAt: row.emailVerifiedAt,
      isPlatformAdmin: row.isPlatformAdmin,
      deletedAt: row.deletedAt,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
      version: row.version,
    });
  }
}
