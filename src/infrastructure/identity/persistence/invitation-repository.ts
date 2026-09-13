import type { PrismaClient } from "../../../generated/prisma/client";
import { Invitation } from "../../../domain/identity/entities/invitation";
import type { Invitation as InvitationType } from "../../../domain/identity/entities/invitation";

export class InvitationRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async findById(id: string): Promise<InvitationType | null> {
    const row = await (this.prisma.invitation as any).findUnique({ where: { id } });
    if (!row) return null;
    return this.mapToDomain(row);
  }

  async findPendingByOrgAndEmail(orgId: string, emailNormalized: string): Promise<InvitationType | null> {
    const row = await (this.prisma.invitation as any).findFirst({
      where: {
        orgId,
        emailNormalized: emailNormalized.toLowerCase().trim(),
        status: "pending",
      },
    });
    if (!row) return null;
    return this.mapToDomain(row);
  }

  async existsPendingByOrgAndEmail(orgId: string, emailNormalized: string): Promise<boolean> {
    const count = await (this.prisma.invitation as any).count({
      where: {
        orgId,
        emailNormalized: emailNormalized.toLowerCase().trim(),
        status: "pending",
      },
    });
    return count > 0;
  }

  async listByOrgId(orgId: string, params: { cursor?: string; limit?: number; status?: string }) {
    const limit = params.limit ?? 25;
    const rows = await (this.prisma.invitation as any).findMany({
      where: {
        orgId,
        ...(params.status ? { status: params.status as any } : {}),
      },
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      take: limit + 1,
      ...(params.cursor ? { cursor: { id: params.cursor }, skip: 1 } : {}),
    });

    const hasNext = rows.length > limit;
    const items = hasNext ? rows.slice(0, -1) : rows;
    const nextCursor = hasNext ? items[items.length - 1].id : null;

    return { items: items.map((r: any) => this.mapToDomain(r)), raw: items, nextCursor };
  }

  async create(invitation: InvitationType): Promise<void> {
    await (this.prisma.invitation as any).create({
      data: {
        id: invitation.id,
        orgId: invitation.orgId,
        emailNormalized: invitation.emailNormalized,
        role: invitation.role,
        status: invitation.status,
        inviterUserId: invitation.inviterUserId,
        acceptedUserId: invitation.acceptedUserId,
        expiresAt: invitation.expiresAt,
        acceptedAt: invitation.acceptedAt,
        revokedAt: invitation.revokedAt,
        deliveryState: invitation.deliveryState,
        lastDeliveryErrorCode: invitation.lastDeliveryErrorCode,
        createdAt: invitation.createdAt,
        updatedAt: invitation.updatedAt,
        version: invitation.version,
      },
    });
  }

  async update(invitation: InvitationType): Promise<void> {
    await (this.prisma.invitation as any).update({
      where: { id: invitation.id, version: invitation.version - 1 },
      data: {
        role: invitation.role,
        status: invitation.status,
        acceptedUserId: invitation.acceptedUserId,
        expiresAt: invitation.expiresAt,
        acceptedAt: invitation.acceptedAt,
        revokedAt: invitation.revokedAt,
        deliveryState: invitation.deliveryState,
        lastDeliveryErrorCode: invitation.lastDeliveryErrorCode,
        updatedAt: invitation.updatedAt,
        version: invitation.version,
      },
    });
  }

  async materializeExpiredPending(orgId: string, emailNormalized: string, now: Date): Promise<void> {
    await (this.prisma.invitation as any).updateMany({
      where: {
        orgId,
        emailNormalized: emailNormalized.toLowerCase().trim(),
        status: "pending",
        expiresAt: { lte: now },
      },
      data: {
        status: "expired",
        updatedAt: now,
      },
    });
  }

  private mapToDomain(row: any): InvitationType {
    return Invitation.create({
      id: row.id,
      orgId: row.orgId,
      emailNormalized: row.emailNormalized,
      role: row.role,
      status: row.status,
      inviterUserId: row.inviterUserId,
      acceptedUserId: row.acceptedUserId,
      expiresAt: row.expiresAt,
      acceptedAt: row.acceptedAt,
      revokedAt: row.revokedAt,
      deliveryState: row.deliveryState,
      lastDeliveryErrorCode: row.lastDeliveryErrorCode,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
      version: row.version,
    });
  }
}
