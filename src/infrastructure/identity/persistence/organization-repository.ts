import type { PrismaClient } from "../../../generated/prisma/client";
import type { Organization } from "../../../domain/identity/entities/organization";

export class OrganizationRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async findById(id: string): Promise<Organization | null> {
    const row = await (this.prisma.organization as any).findUnique({ where: { id } });
    if (!row) return null;
    return this.mapToDomain(row);
  }

  async findBySlug(slug: string): Promise<Organization | null> {
    const row = await (this.prisma.organization as any).findUnique({
      where: { slug: slug.toLowerCase().trim() },
    });
    if (!row) return null;
    return this.mapToDomain(row);
  }

  async create(org: Organization): Promise<void> {
    await (this.prisma.organization as any).create({
      data: {
        id: org.id,
        name: org.name,
        slug: org.slug,
        ownerUserId: org.ownerUserId,
        deletedAt: org.deletedAt,
        createdAt: org.createdAt,
        updatedAt: org.updatedAt,
        version: org.version,
      },
    });
  }

  async update(org: Organization): Promise<void> {
    await (this.prisma.organization as any).update({
      where: { id: org.id, version: org.version - 1 },
      data: {
        name: org.name,
        slug: org.slug,
        ownerUserId: org.ownerUserId,
        deletedAt: org.deletedAt,
        updatedAt: org.updatedAt,
        version: org.version,
      },
    });
  }

  async existsBySlug(slug: string): Promise<boolean> {
    const count = await (this.prisma.organization as any).count({
      where: { slug: slug.toLowerCase().trim() },
    });
    return count > 0;
  }

  async listByUserId(userId: string, params: { cursor?: string; limit?: number }) {
    const limit = params.limit ?? 25;
    const memberships = await (this.prisma.membership as any).findMany({
      where: { userId, endedAt: null },
      include: { organization: true },
      orderBy: [{ createdAt: "asc" }, { id: "asc" }],
      take: limit + 1,
      ...(params.cursor ? { cursor: { id: params.cursor }, skip: 1 } : {}),
    });

    const hasNext = memberships.length > limit;
    const items = hasNext ? memberships.slice(0, -1) : memberships;
    const nextCursor = hasNext ? items[items.length - 1].id : null;

    return { items, nextCursor };
  }

  private mapToDomain(row: any): Organization {
    const { Organization } = require("../../../domain/identity/entities/organization");
    return Organization.create({
      id: row.id,
      name: row.name,
      slug: row.slug,
      ownerUserId: row.ownerUserId,
      deletedAt: row.deletedAt,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
      version: row.version,
    });
  }
}
