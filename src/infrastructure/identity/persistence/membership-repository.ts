import type { PrismaClient } from "../../../generated/prisma/client";
import { Membership } from "../../../domain/identity/entities/membership";
import type { Membership as MembershipType } from "../../../domain/identity/entities/membership";

export class MembershipRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async findById(id: string): Promise<MembershipType | null> {
    const row = await (this.prisma.membership as any).findUnique({ where: { id } });
    if (!row) return null;
    return this.mapToDomain(row);
  }

  async findActiveByOrgAndUser(orgId: string, userId: string): Promise<MembershipType | null> {
    const row = await (this.prisma.membership as any).findFirst({
      where: { orgId, userId, endedAt: null },
    });
    if (!row) return null;
    return this.mapToDomain(row);
  }

  async findAnyByOrgAndUser(orgId: string, userId: string): Promise<MembershipType | null> {
    const row = await (this.prisma.membership as any).findFirst({
      where: { orgId, userId },
      orderBy: { createdAt: "desc" },
    });
    if (!row) return null;
    return this.mapToDomain(row);
  }

  async findFormerByOrgAndUser(orgId: string, userId: string): Promise<MembershipType | null> {
    const row = await (this.prisma.membership as any).findFirst({
      where: { orgId, userId, endedAt: { not: null } },
      orderBy: { endedAt: "desc" },
    });
    if (!row) return null;
    return this.mapToDomain(row);
  }

  async listActiveByOrgId(orgId: string, params: { cursor?: string; limit?: number }) {
    const limit = params.limit ?? 25;
    const rows = await (this.prisma.membership as any).findMany({
      where: { orgId, endedAt: null },
      orderBy: [{ createdAt: "asc" }, { id: "asc" }],
      take: limit + 1,
      ...(params.cursor ? { cursor: { id: params.cursor }, skip: 1 } : {}),
      include: { user: true },
    });

    const hasNext = rows.length > limit;
    const items = hasNext ? rows.slice(0, -1) : rows;
    const nextCursor = hasNext ? items[items.length - 1].id : null;

    return { items: items.map((r: any) => this.mapToDomain(r)), raw: items, nextCursor };
  }

  async countActiveByOrgId(orgId: string): Promise<Record<string, number>> {
    const groups = await (this.prisma.membership as any).groupBy({
      by: ["role"],
      where: { orgId, endedAt: null },
      _count: true,
    });
    const counts: Record<string, number> = { viewer: 0, member: 0, admin: 0, owner: 0 };
    for (const g of groups) {
      counts[g.role] = g._count;
    }
    return counts;
  }

  async create(membership: MembershipType): Promise<void> {
    await (this.prisma.membership as any).create({
      data: {
        id: membership.id,
        orgId: membership.orgId,
        userId: membership.userId,
        role: membership.role,
        joinedAt: membership.joinedAt,
        endedAt: membership.endedAt,
        endReason: membership.endReason,
        createdAt: membership.createdAt,
        updatedAt: membership.updatedAt,
        version: membership.version,
      },
    });
  }

  async update(membership: MembershipType): Promise<void> {
    await (this.prisma.membership as any).update({
      where: { id: membership.id, version: membership.version - 1 },
      data: {
        role: membership.role,
        joinedAt: membership.joinedAt,
        endedAt: membership.endedAt,
        endReason: membership.endReason,
        updatedAt: membership.updatedAt,
        version: membership.version,
      },
    });
  }

  async countActiveByUserId(userId: string): Promise<number> {
    return (this.prisma.membership as any).count({
      where: { userId, endedAt: null },
    });
  }

  private mapToDomain(row: any): MembershipType {
    return Membership.create({
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
  }
}
