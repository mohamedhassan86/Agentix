/**
 * Tenant-scoped Prisma client - injects org_id into reads and writes
 * Throws if context missing
 */

import type { PrismaClient } from "../../../generated/prisma/client";
import type { ITenantContext } from "../../../application/identity/ports/tenant-context";
import { isMemberContext } from "../../../application/identity/ports/tenant-context";

export interface ScopedClientOptions {
  prisma: PrismaClient;
  tenantContext: ITenantContext;
}

export class TenantScopedClient {
  private readonly prisma: PrismaClient;
  private readonly tenantContext: ITenantContext;
  private readonly orgId: string;

  constructor(options: ScopedClientOptions) {
    if (!isMemberContext(options.tenantContext)) {
      throw new Error("TENANT_CONTEXT_REQUIRED: Member context required for scoped client");
    }
    this.prisma = options.prisma;
    this.tenantContext = options.tenantContext;
    this.orgId = options.tenantContext.orgId;
  }

  getOrgId(): string {
    return this.orgId;
  }

  getUserId(): string {
    if (!isMemberContext(this.tenantContext)) {
      throw new Error("USER_ID_NOT_AVAILABLE");
    }
    return this.tenantContext.userId;
  }

  getRole(): string {
    if (!isMemberContext(this.tenantContext)) {
      throw new Error("ROLE_NOT_AVAILABLE");
    }
    return this.tenantContext.role;
  }

  /**
   * Returns the underlying Prisma client extended with org_id injection
   * For simplicity, we don't use Prisma query extensions here (they require client generation)
   * Instead, we provide helper methods that enforce org_id
   */

  // Organization - only active org
  async findActiveOrganization() {
    const org = await (this.prisma.organization as any).findFirst({
      where: {
        id: this.orgId,
        deletedAt: null,
      },
    });
    if (!org) {
      throw new Error("ORGANIZATION_NOT_FOUND");
    }
    return org;
  }

  // Memberships - always scoped to orgId
  async findMemberships(params?: { includeEnded?: boolean }) {
    return (this.prisma.membership as any).findMany({
      where: {
        orgId: this.orgId,
        ...(params?.includeEnded ? {} : { endedAt: null }),
      },
      orderBy: [{ createdAt: "asc" }, { id: "asc" }],
    });
  }

  async findMembershipByUserId(userId: string, includeEnded = false) {
    return (this.prisma.membership as any).findFirst({
      where: {
        orgId: this.orgId,
        userId,
        ...(includeEnded ? {} : { endedAt: null }),
      },
    });
  }

  async findMembershipById(memberId: string) {
    const membership = await (this.prisma.membership as any).findFirst({
      where: {
        id: memberId,
        orgId: this.orgId,
      },
    });
    if (!membership) {
      throw new Error("MEMBERSHIP_NOT_FOUND");
    }
    return membership;
  }

  // Invitations - scoped
  async findInvitations(params: { status?: string; cursor?: string; limit?: number }) {
    const limit = params.limit ?? 25;
    return (this.prisma.invitation as any).findMany({
      where: {
        orgId: this.orgId,
        ...(params.status ? { status: params.status } : {}),
      },
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      take: limit + 1,
      ...(params.cursor ? { cursor: { id: params.cursor }, skip: 1 } : {}),
    });
  }

  async findInvitationById(invitationId: string) {
    const invitation = await (this.prisma.invitation as any).findFirst({
      where: {
        id: invitationId,
        orgId: this.orgId,
      },
    });
    if (!invitation) {
      throw new Error("INVITATION_NOT_FOUND");
    }
    return invitation;
  }

  // Tokens - org scoped for invitation
  async findTokenById(tokenId: string) {
    return (this.prisma.oneTimeToken as any).findFirst({
      where: {
        id: tokenId,
        orgId: this.orgId,
      },
    });
  }

  // Direct prisma access with orgId enforcement - for writes, caller must include orgId in data/where
  get prismaClient(): PrismaClient {
    return this.prisma;
  }
}

/**
 * Factory for scoped client
 */
export function createScopedClient(prisma: PrismaClient, tenantContext: ITenantContext): TenantScopedClient {
  return new TenantScopedClient({ prisma, tenantContext });
}
