/**
 * Platform inspection client - read-only, separate from tenant-scoped client
 * Exposes only 3 typed read repositories: org profile, members, invitations
 */

import type { PrismaClient } from "../../../generated/prisma/client";
import type { ITenantContext } from "../../../application/identity/ports/tenant-context";
import { isPlatformInspectContext } from "../../../application/identity/ports/tenant-context";

export class PlatformInspectionClient {
  private readonly prisma: PrismaClient;
  private readonly tenantContext: ITenantContext;

  constructor(prisma: PrismaClient, tenantContext: ITenantContext) {
    if (!isPlatformInspectContext(tenantContext)) {
      throw new Error("PLATFORM_INSPECT_CONTEXT_REQUIRED");
    }
    this.prisma = prisma;
    this.tenantContext = tenantContext;
  }

  // Read-only organization profile
  async findOrganizationById(organizationId: string) {
    const org = await (this.prisma.organization as any).findUnique({
      where: { id: organizationId },
    });
    if (!org) {
      throw new Error("ORGANIZATION_NOT_FOUND");
    }
    return org;
  }

  async findOrganizationBySlug(slug: string) {
    const org = await (this.prisma.organization as any).findUnique({
      where: { slug },
    });
    if (!org) {
      throw new Error("ORGANIZATION_NOT_FOUND");
    }
    return org;
  }

  // Read-only members
  async listMembers(organizationId: string, params: { cursor?: string; limit?: number }) {
    const limit = params.limit ?? 25;
    const items = await (this.prisma.membership as any).findMany({
      where: {
        orgId: organizationId,
        endedAt: null,
      },
      orderBy: [{ createdAt: "asc" }, { id: "asc" }],
      take: limit + 1,
      ...(params.cursor ? { cursor: { id: params.cursor }, skip: 1 } : {}),
      include: {
        user: true,
      },
    });

    const hasNext = items.length > limit;
    const result = hasNext ? items.slice(0, -1) : items;
    const nextCursor = hasNext ? result[result.length - 1].id : null;

    // Role counts
    const counts = await (this.prisma.membership as any).groupBy({
      by: ["role"],
      where: { orgId: organizationId, endedAt: null },
      _count: true,
    });

    const roleCounts = {
      viewer: 0,
      member: 0,
      admin: 0,
      owner: 0,
    };
    for (const c of counts) {
      (roleCounts as any)[c.role] = c._count;
    }

    return { items: result, roleCounts, nextCursor };
  }

  // Read-only invitations
  async listInvitations(organizationId: string, params: { cursor?: string; limit?: number }) {
    const limit = params.limit ?? 25;
    const items = await (this.prisma.invitation as any).findMany({
      where: { orgId: organizationId },
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      take: limit + 1,
      ...(params.cursor ? { cursor: { id: params.cursor }, skip: 1 } : {}),
    });

    const hasNext = items.length > limit;
    const result = hasNext ? items.slice(0, -1) : items;
    const nextCursor = hasNext ? result[result.length - 1].id : null;

    return { items: result, nextCursor };
  }

  // No mutation methods - read-only by design
}

export function createPlatformInspectionClient(prisma: PrismaClient, tenantContext: ITenantContext): PlatformInspectionClient {
  return new PlatformInspectionClient(prisma, tenantContext);
}
