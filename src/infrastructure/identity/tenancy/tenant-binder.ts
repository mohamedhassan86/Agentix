/**
 * Tenant binder - middleware that resolves user/session and validates active membership + org state
 * Loads CurrentMembershipProjection
 */

import type { PrismaClient } from "../../../generated/prisma/client";
import type { ITenantContext } from "../../../application/identity/ports/tenant-context";

export interface CurrentMembershipProjection {
  userId: string;
  orgId: string;
  role: "viewer" | "member" | "admin" | "owner";
  organizationDeleted: boolean;
  membershipEnded: boolean;
  isPlatformAdmin: boolean;
}

export interface TenantBinderOptions {
  prisma: PrismaClient;
}

export class TenantBinder {
  constructor(private readonly prisma: PrismaClient) {}

  /**
   * Resolve tenant context from session
   * - Validates session not revoked/expired
   * - Validates user not deleted
   * - Validates active org membership if activeOrgId present
   * - Clears active pointer if membership ended/org deleted
   */
  async resolve(params: {
    sessionTokenDigest: Uint8Array;
    now?: Date;
  }): Promise<{ context: ITenantContext; projection: CurrentMembershipProjection | null; session: any; user: any }> {
    const now = params.now ?? new Date();

    const session = await (this.prisma.session as any).findFirst({
      where: {
        sessionTokenDigest: params.sessionTokenDigest,
        revokedAt: null,
        expiresAt: { gt: now },
      },
    });

    if (!session) {
      throw new Error("SESSION_INVALID");
    }

    const user = await (this.prisma.user as any).findFirst({
      where: {
        id: session.userId,
        deletedAt: null,
      },
    });

    if (!user) {
      throw new Error("ACCOUNT_DELETED");
    }

    // Platform admin - must have zero active memberships, no active org
    if (user.isPlatformAdmin) {
      const activeMembershipCount = await (this.prisma.membership as any).count({
        where: { userId: user.id, endedAt: null },
      });
      if (activeMembershipCount > 0) {
        throw new Error("PLATFORM_ADMIN_REQUIRES_ZERO_MEMBERSHIPS");
      }
      // Platform admin context - no active org
      const context: ITenantContext = {
        mode: "PlatformInspect",
        userId: user.id,
        isPlatformAdmin: true,
      };
      return { context, projection: null, session, user };
    }

    // No active org in session -> UnscopedIdentity
    if (!session.activeOrgId) {
      const context: ITenantContext = {
        mode: "UnscopedIdentity",
        userId: user.id,
        isPlatformAdmin: false,
      };
      return { context, projection: null, session, user };
    }

    // Active org present - validate membership and org state
    const org = await (this.prisma.organization as any).findUnique({
      where: { id: session.activeOrgId },
    });

    if (!org || org.deletedAt) {
      // Clear active org pointer - organization deleted
      await (this.prisma.session as any).update({
        where: { id: session.id },
        data: { activeOrgId: null, updatedAt: now },
      });
      const context: ITenantContext = {
        mode: "UnscopedIdentity",
        userId: user.id,
        isPlatformAdmin: false,
      };
      return { context, projection: null, session: { ...session, activeOrgId: null }, user };
    }

    const membership = await (this.prisma.membership as any).findFirst({
      where: {
        orgId: session.activeOrgId,
        userId: user.id,
        endedAt: null,
      },
    });

    if (!membership) {
      // Check if former member
      const former = await (this.prisma.membership as any).findFirst({
        where: {
          orgId: session.activeOrgId,
          userId: user.id,
          endedAt: { not: null },
        },
      });

      // Clear active org pointer
      await (this.prisma.session as any).update({
        where: { id: session.id },
        data: { activeOrgId: null, updatedAt: now },
      });

      if (former) {
        // Former member - will be handled as explicit no-access in isolation policy
        throw new Error("FORMER_MEMBER");
      }

      const context: ITenantContext = {
        mode: "UnscopedIdentity",
        userId: user.id,
        isPlatformAdmin: false,
      };
      return { context, projection: null, session: { ...session, activeOrgId: null }, user };
    }

    // Valid active membership
    const projection: CurrentMembershipProjection = {
      userId: user.id,
      orgId: org.id,
      role: membership.role,
      organizationDeleted: false,
      membershipEnded: false,
      isPlatformAdmin: false,
    };

    const context: ITenantContext = {
      mode: "Member",
      userId: user.id,
      orgId: org.id,
      role: membership.role,
      isPlatformAdmin: false,
    };

    // Touch session
    await (this.prisma.session as any).update({
      where: { id: session.id },
      data: { lastSeenAt: now, updatedAt: now },
    });

    return { context, projection, session, user };
  }

  /**
   * Resolve unscoped identity (no active org) - for registration, sign-in, etc
   */
  async resolveUnscoped(userId: string): Promise<ITenantContext> {
    const user = await (this.prisma.user as any).findUnique({
      where: { id: userId },
    });
    if (!user) throw new Error("USER_NOT_FOUND");
    if (user.deletedAt) throw new Error("ACCOUNT_DELETED");

    if (user.isPlatformAdmin) {
      return { mode: "PlatformInspect", userId: user.id, isPlatformAdmin: true };
    }

    return { mode: "UnscopedIdentity", userId: user.id, isPlatformAdmin: false };
  }
}
